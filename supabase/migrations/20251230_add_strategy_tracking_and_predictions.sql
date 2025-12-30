-- ============================================
-- Migration: 피드백 루프 및 예측 검증 시스템
-- Date: 2025-12-30
-- Description:
--   1. strategy_tracking: 전략 효과 추적 테이블
--   2. prediction_verification: 예측 정확도 검증 테이블
--   3. strategy_templates: 학습 스타일별 전략 템플릿 (선택)
--   4. 관련 인덱스 및 RLS 정책
-- ============================================

-- =============================================
-- 1. 전략 효과 추적 테이블 (strategy_tracking)
-- =============================================

CREATE TABLE IF NOT EXISTS strategy_tracking (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  strategy_index INTEGER NOT NULL,           -- 해당 리포트의 몇 번째 전략인지 (0부터)
  strategy_content JSONB NOT NULL,           -- 전략 내용 (ActionablePrescriptionItem)

  -- 실행 추적
  execution_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (execution_status IN ('pending', 'in_progress', 'completed', 'skipped', 'partial')),
  execution_notes TEXT,                      -- 실행 관련 메모
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 효과 측정
  target_concept TEXT,                       -- 해당 전략이 다루는 개념
  pre_score DECIMAL(5,2),                    -- 전략 실행 전 해당 개념 정답률 (%)
  post_score DECIMAL(5,2),                   -- 전략 실행 후 해당 개념 정답률 (%)
  improvement_rate DECIMAL(5,2),             -- 개선율 (post - pre)

  -- 평가
  effectiveness_rating INTEGER               -- 1-5 효과 평가 (교사/학생 평가)
    CHECK (effectiveness_rating BETWEEN 1 AND 5),
  difficulty_rating INTEGER                  -- 1-5 실행 난이도 (1=쉬움, 5=어려움)
    CHECK (difficulty_rating BETWEEN 1 AND 5),
  feedback TEXT,                             -- 피드백 코멘트

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE strategy_tracking IS '전략 효과 추적 - 피드백 루프의 핵심 데이터';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_strategy_tracking_report
  ON strategy_tracking(report_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tracking_student
  ON strategy_tracking(student_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tracking_concept
  ON strategy_tracking(target_concept);
CREATE INDEX IF NOT EXISTS idx_strategy_tracking_status
  ON strategy_tracking(execution_status);
CREATE INDEX IF NOT EXISTS idx_strategy_tracking_effectiveness
  ON strategy_tracking(effectiveness_rating DESC NULLS LAST);

-- RLS 정책
ALTER TABLE strategy_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategy_tracking_all_teacher"
ON strategy_tracking
FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));

CREATE POLICY "strategy_tracking_select_parent"
ON strategy_tracking
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students
  WHERE students.id = strategy_tracking.student_id
  AND students.parent_id = auth.uid()
));

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_strategy_tracking_updated_at
  BEFORE UPDATE ON strategy_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 2. 예측 검증 테이블 (prediction_verification)
-- =============================================

CREATE TABLE IF NOT EXISTS prediction_verification (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- 예측 내용
  prediction_date DATE NOT NULL,             -- 예측 생성일
  target_date DATE NOT NULL,                 -- 예측 대상일 (1개월/3개월/6개월 후)
  timeframe TEXT NOT NULL                    -- '1개월' | '3개월' | '6개월' | '1년'
    CHECK (timeframe IN ('1개월', '3개월', '6개월', '1년')),
  predicted_score INTEGER NOT NULL           -- 예측 점수
    CHECK (predicted_score BETWEEN 0 AND 100),
  confidence_level INTEGER NOT NULL          -- 신뢰도 (0-100)
    CHECK (confidence_level BETWEEN 0 AND 100),
  assumptions JSONB,                         -- 예측 가정

  -- 실제 결과
  actual_score INTEGER                       -- 실제 점수 (해당 시점에 업데이트)
    CHECK (actual_score IS NULL OR actual_score BETWEEN 0 AND 100),
  actual_test_id INTEGER REFERENCES reports(id), -- 실제 시험 리포트 ID

  -- 정확도 분석
  error_amount INTEGER,                      -- 오차 (actual - predicted)
  error_percentage DECIMAL(5,2),             -- 오차율 (%)
  is_accurate BOOLEAN,                       -- 오차 10% 이내면 true

  -- 메타데이터
  verified_at TIMESTAMPTZ,                   -- 검증 완료 시점
  verification_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE prediction_verification IS '예측 정확도 검증 - 예측 모델 고도화를 위한 피드백';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_prediction_student
  ON prediction_verification(student_id);
CREATE INDEX IF NOT EXISTS idx_prediction_target_date
  ON prediction_verification(target_date);
CREATE INDEX IF NOT EXISTS idx_prediction_unverified
  ON prediction_verification(target_date)
  WHERE actual_score IS NULL;
CREATE INDEX IF NOT EXISTS idx_prediction_accuracy
  ON prediction_verification(is_accurate);

-- RLS 정책
ALTER TABLE prediction_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prediction_verification_all_teacher"
ON prediction_verification
FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));

CREATE POLICY "prediction_verification_select_parent"
ON prediction_verification
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students
  WHERE students.id = prediction_verification.student_id
  AND students.parent_id = auth.uid()
));

-- =============================================
-- 3. 전략 템플릿 테이블 (strategy_templates)
-- =============================================

CREATE TABLE IF NOT EXISTS strategy_templates (
  id SERIAL PRIMARY KEY,
  learning_style TEXT NOT NULL               -- 'visual' | 'verbal' | 'logical'
    CHECK (learning_style IN ('visual', 'verbal', 'logical')),
  weakness_type TEXT NOT NULL,               -- '계산 실수' | '개념 이해' | '문제 해석' 등

  -- 전략 템플릿
  strategy_type TEXT NOT NULL                -- '개념 교정' | '습관 교정' | '전략 개선'
    CHECK (strategy_type IN ('개념 교정', '습관 교정', '전략 개선')),
  strategy_title TEXT NOT NULL,
  strategy_description TEXT NOT NULL,
  what_to_do TEXT NOT NULL,                  -- 무엇을
  where_to TEXT NOT NULL,                    -- 어디서
  how_much TEXT NOT NULL,                    -- 얼마나
  how_to TEXT NOT NULL,                      -- 어떻게
  measurement TEXT NOT NULL,                 -- 측정 방법

  -- 효과 통계 (피드백 루프 데이터로 업데이트)
  usage_count INTEGER DEFAULT 0,
  avg_improvement_rate DECIMAL(5,2) DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,       -- 10% 이상 개선 비율

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(learning_style, weakness_type, strategy_title)
);

COMMENT ON TABLE strategy_templates IS '학습 스타일별 전략 템플릿 - AI 전략 제안 개선용';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_strategy_templates_style
  ON strategy_templates(learning_style);
CREATE INDEX IF NOT EXISTS idx_strategy_templates_weakness
  ON strategy_templates(weakness_type);
CREATE INDEX IF NOT EXISTS idx_strategy_templates_effectiveness
  ON strategy_templates(avg_improvement_rate DESC);

-- RLS 정책
ALTER TABLE strategy_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategy_templates_all_teacher"
ON strategy_templates
FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));

CREATE POLICY "strategy_templates_select_all"
ON strategy_templates
FOR SELECT
USING (is_active = TRUE);

-- updated_at 트리거
CREATE TRIGGER update_strategy_templates_updated_at
  BEFORE UPDATE ON strategy_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 4. 분석 함수 (Supabase RPC용)
-- =============================================

-- 전략 유형별 효과 분석
CREATE OR REPLACE FUNCTION get_strategy_effectiveness_by_type(p_student_id INTEGER DEFAULT NULL)
RETURNS TABLE (
  strategy_type TEXT,
  total_count BIGINT,
  completed_count BIGINT,
  completion_rate DECIMAL,
  avg_improvement DECIMAL,
  avg_rating DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (st.strategy_content->>'type')::TEXT as strategy_type,
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE st.execution_status = 'completed')::BIGINT as completed_count,
    ROUND(COUNT(*) FILTER (WHERE st.execution_status = 'completed')::DECIMAL /
          NULLIF(COUNT(*)::DECIMAL, 0) * 100, 2) as completion_rate,
    ROUND(AVG(st.improvement_rate) FILTER (WHERE st.execution_status = 'completed'), 2) as avg_improvement,
    ROUND(AVG(st.effectiveness_rating) FILTER (WHERE st.effectiveness_rating IS NOT NULL), 2) as avg_rating
  FROM strategy_tracking st
  WHERE (p_student_id IS NULL OR st.student_id = p_student_id)
  GROUP BY st.strategy_content->>'type'
  ORDER BY avg_improvement DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 개념별 개선 추이 분석
CREATE OR REPLACE FUNCTION get_concept_improvement_trend(p_student_id INTEGER)
RETURNS TABLE (
  concept TEXT,
  occurrence_count BIGINT,
  first_score DECIMAL,
  latest_score DECIMAL,
  total_improvement DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH concept_scores AS (
    SELECT
      st.target_concept,
      st.pre_score,
      st.post_score,
      st.completed_at,
      ROW_NUMBER() OVER (PARTITION BY st.target_concept ORDER BY st.completed_at ASC) as first_rn,
      ROW_NUMBER() OVER (PARTITION BY st.target_concept ORDER BY st.completed_at DESC) as last_rn
    FROM strategy_tracking st
    WHERE st.student_id = p_student_id
      AND st.target_concept IS NOT NULL
      AND st.execution_status = 'completed'
  )
  SELECT
    cs.target_concept as concept,
    COUNT(*) FILTER (WHERE cs.first_rn >= 1)::BIGINT as occurrence_count,
    MAX(cs.pre_score) FILTER (WHERE cs.first_rn = 1) as first_score,
    MAX(cs.post_score) FILTER (WHERE cs.last_rn = 1) as latest_score,
    MAX(cs.post_score) FILTER (WHERE cs.last_rn = 1) -
    MAX(cs.pre_score) FILTER (WHERE cs.first_rn = 1) as total_improvement
  FROM concept_scores cs
  GROUP BY cs.target_concept
  ORDER BY total_improvement DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 예측 정확도 통계
CREATE OR REPLACE FUNCTION get_prediction_accuracy_stats(p_student_id INTEGER DEFAULT NULL)
RETURNS TABLE (
  timeframe TEXT,
  total_predictions BIGINT,
  verified_count BIGINT,
  accurate_count BIGINT,
  accuracy_rate DECIMAL,
  avg_error_percentage DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pv.timeframe,
    COUNT(*)::BIGINT as total_predictions,
    COUNT(*) FILTER (WHERE pv.actual_score IS NOT NULL)::BIGINT as verified_count,
    COUNT(*) FILTER (WHERE pv.is_accurate = TRUE)::BIGINT as accurate_count,
    ROUND(COUNT(*) FILTER (WHERE pv.is_accurate = TRUE)::DECIMAL /
          NULLIF(COUNT(*) FILTER (WHERE pv.actual_score IS NOT NULL)::DECIMAL, 0) * 100, 2) as accuracy_rate,
    ROUND(AVG(pv.error_percentage) FILTER (WHERE pv.actual_score IS NOT NULL), 2) as avg_error_percentage
  FROM prediction_verification pv
  WHERE (p_student_id IS NULL OR pv.student_id = p_student_id)
  GROUP BY pv.timeframe
  ORDER BY
    CASE pv.timeframe
      WHEN '1개월' THEN 1
      WHEN '3개월' THEN 2
      WHEN '6개월' THEN 3
      WHEN '1년' THEN 4
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 가장 효과적인 전략 패턴 추출
CREATE OR REPLACE FUNCTION get_top_effective_strategies(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  strategy_type TEXT,
  strategy_title TEXT,
  target_concept TEXT,
  usage_count BIGINT,
  avg_improvement DECIMAL,
  avg_rating DECIMAL,
  success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (st.strategy_content->>'type')::TEXT as strategy_type,
    (st.strategy_content->>'title')::TEXT as strategy_title,
    st.target_concept,
    COUNT(*)::BIGINT as usage_count,
    ROUND(AVG(st.improvement_rate), 2) as avg_improvement,
    ROUND(AVG(st.effectiveness_rating), 2) as avg_rating,
    ROUND(COUNT(*) FILTER (WHERE st.improvement_rate >= 10)::DECIMAL /
          NULLIF(COUNT(*)::DECIMAL, 0) * 100, 2) as success_rate
  FROM strategy_tracking st
  WHERE st.execution_status = 'completed'
    AND st.improvement_rate IS NOT NULL
  GROUP BY
    st.strategy_content->>'type',
    st.strategy_content->>'title',
    st.target_concept
  HAVING COUNT(*) >= 2  -- 최소 2번 이상 사용된 전략만
  ORDER BY avg_improvement DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 5. 초기 전략 템플릿 데이터 삽입
-- =============================================

INSERT INTO strategy_templates
  (learning_style, weakness_type, strategy_type, strategy_title, strategy_description,
   what_to_do, where_to, how_much, how_to, measurement)
VALUES
  -- Visual 학습자용
  ('visual', '계산 실수', '습관 교정', '시각적 계산 검증법',
   '계산 과정을 색깔 펜으로 구분하여 시각화',
   '3색 볼펜 (검정, 빨강, 파랑)', '모든 계산 문제', '매일 10문제',
   '각 단계를 다른 색으로 표시하며 검산. 검정=식 세우기, 빨강=계산, 파랑=검산',
   '계산 실수 50% 감소 (2주 후 측정)'),

  ('visual', '개념 이해', '개념 교정', '마인드맵 개념 정리',
   '새로운 개념을 마인드맵으로 시각화하여 연결 관계 파악',
   '마인드맵 노트 또는 앱', '새로 배운 단원', '단원당 1개 마인드맵',
   '중심 개념 → 하위 개념 → 예시 → 관련 공식 순으로 가지 확장',
   '개념 적용 정답률 80% 달성'),

  ('visual', '문제 해석', '전략 개선', '조건 형광펜 표시법',
   '문제의 조건을 형광펜으로 색깔별 구분하여 표시',
   '형광펜 3색 세트', '서술형/응용 문제', '문제당 30초 투자',
   '노랑=주어진 것, 초록=구하는 것, 분홍=힌트/조건',
   '조건 누락 오류 0건 달성'),

  -- Verbal 학습자용
  ('verbal', '계산 실수', '습관 교정', '계산 과정 말하기',
   '계산하면서 각 단계를 소리 내어 말하기',
   '조용한 공부 공간', '계산 문제', '매일 5문제',
   '각 단계를 "~이니까 ~이다"라고 말하며 풀이',
   '계산 정확도 90% 달성'),

  ('verbal', '개념 이해', '개념 교정', '개념 설명 노트 작성',
   '배운 개념을 자신의 말로 설명하는 노트 작성',
   '개념 설명 노트', '새로 배운 개념마다', '개념당 A4 반 페이지',
   '친구에게 설명하듯이 구어체로 작성. "이건 ~하는 거야"',
   '개념 테스트 정답률 80% 달성'),

  ('verbal', '문제 해석', '전략 개선', '문제 다시 쓰기',
   '문제를 자신의 말로 바꿔 써보기',
   '연습장', '어려운 서술형 문제', '문제당 1분',
   '문제의 핵심을 3문장으로 요약. "주어진 것은~, 구해야 할 것은~, 조건은~"',
   '문제 해석 오류 50% 감소'),

  -- Logical 학습자용
  ('logical', '계산 실수', '습관 교정', '체크리스트 검산법',
   '계산 후 체크리스트로 검산 항목 확인',
   '개인 검산 체크리스트', '모든 계산 문제', '문제당 30초 추가',
   '1.부호 확인 2.단위 확인 3.대입 검증 4.범위 확인',
   '계산 실수 70% 감소'),

  ('logical', '개념 이해', '개념 교정', '공식 유도 연습',
   '공식을 암기하지 않고 유도 과정 반복',
   '공식 유도 노트', '핵심 공식', '주 3회, 공식당 2분',
   '기본 정의에서 출발하여 공식 유도. 왜 이렇게 되는지 논리적으로 작성',
   '공식 적용 정확도 95% 달성'),

  ('logical', '문제 해석', '전략 개선', '조건 번호 체크법',
   '문제의 모든 조건을 번호 붙여 나열 후 사용 여부 체크',
   '조건 분석표', '서술형 문제', '문제당 1분',
   '조건 번호 | 내용 | 사용여부 | 사용 위치 형태로 표 작성',
   '조건 누락 0건 달성')
ON CONFLICT (learning_style, weakness_type, strategy_title) DO NOTHING;

-- ============================================
-- Migration Complete
-- ============================================
