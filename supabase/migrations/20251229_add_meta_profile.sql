-- ============================================
-- Migration: 학생 메타 프로필 및 6대 리포트 타입 추가
-- Date: 2025-12-29
-- Description:
--   1. students 테이블에 meta_profile JSONB 컬럼 추가
--   2. reports 테이블의 report_type CHECK constraint 업데이트
--   3. 관련 인덱스 생성
-- ============================================

-- 1. students 테이블에 meta_profile 컬럼 추가
-- StudentMetaProfile: baseline, errorSignature, absorptionRate, solvingStamina, metaCognitionLevel
ALTER TABLE students
ADD COLUMN IF NOT EXISTS meta_profile JSONB DEFAULT NULL;

-- meta_profile 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN students.meta_profile IS '학생 메타 프로필 (5대 핵심 지표): baseline, errorSignature, absorptionRate, solvingStamina, metaCognitionLevel';

-- 2. reports 테이블의 report_type CHECK constraint 업데이트
-- 기존 constraint 삭제 후 새로운 constraint 추가
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_report_type_check;

ALTER TABLE reports
ADD CONSTRAINT reports_report_type_check
CHECK (report_type IN (
  'level_test',     -- 진단/레벨 테스트 (신규 등록 시)
  'test',           -- 일반 시험 분석
  'weekly',         -- 주간 리포트
  'monthly',        -- 월간 리포트
  'semi_annual',    -- 반기 리포트
  'annual',         -- 연간 리포트
  'consolidated'    -- 레거시: 통합 리포트
));

-- 3. 인덱스 추가
-- meta_profile이 null이 아닌 학생만 조회하는 인덱스
CREATE INDEX IF NOT EXISTS idx_students_has_meta_profile
ON students ((meta_profile IS NOT NULL))
WHERE meta_profile IS NOT NULL;

-- meta_profile 내 특정 필드 조회용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_students_meta_profile_gin
ON students USING GIN (meta_profile);

-- 4. 학생 메타 프로필 업데이트 히스토리 테이블 추가
CREATE TABLE IF NOT EXISTS student_meta_profile_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
  indicator_type TEXT NOT NULL CHECK (indicator_type IN (
    'baseline',
    'errorSignature',
    'absorptionRate',
    'solvingStamina',
    'metaCognitionLevel',
    'full_profile'
  )),
  previous_value JSONB,
  new_value JSONB NOT NULL,
  change_reason TEXT,
  changed_by TEXT NOT NULL CHECK (changed_by IN ('ai', 'teacher')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE student_meta_profile_history IS '학생 메타 프로필 변경 이력 추적';

-- 히스토리 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_meta_profile_history_student
ON student_meta_profile_history(student_id);

CREATE INDEX IF NOT EXISTS idx_meta_profile_history_date
ON student_meta_profile_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_profile_history_indicator
ON student_meta_profile_history(indicator_type);

-- 5. RLS 정책 추가
ALTER TABLE student_meta_profile_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_profile_history_all_teacher"
ON student_meta_profile_history
FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));

CREATE POLICY "meta_profile_history_select_parent"
ON student_meta_profile_history
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students
  WHERE students.id = student_meta_profile_history.student_id
  AND students.parent_id = auth.uid()
));

-- 6. 메타 프로필 초기화 함수
-- 새로운 학생 등록 시 기본 메타 프로필 구조 생성
CREATE OR REPLACE FUNCTION initialize_student_meta_profile(p_student_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_profile JSONB;
  v_now TEXT;
BEGIN
  v_now := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  v_profile := jsonb_build_object(
    'baseline', jsonb_build_object(
      'assessmentDate', NULL,
      'levelTestReportId', NULL,
      'initialLevel', jsonb_build_object(
        'grade', NULL,
        'percentile', NULL,
        'evaluatedAt', NULL
      ),
      'domainScores', '[]'::jsonb,
      'initialStrengths', '[]'::jsonb,
      'initialWeaknesses', '[]'::jsonb,
      'initialLearningStyle', NULL
    ),
    'errorSignature', jsonb_build_object(
      'primaryErrorTypes', '[]'::jsonb,
      'signaturePatterns', '[]'::jsonb,
      'domainVulnerability', '[]'::jsonb,
      'lastUpdated', v_now
    ),
    'absorptionRate', jsonb_build_object(
      'overallScore', 50,
      'byDomain', '[]'::jsonb,
      'learningType', 'steady-grower',
      'optimalConditions', '[]'::jsonb,
      'recentTrend', '[]'::jsonb,
      'lastUpdated', v_now
    ),
    'solvingStamina', jsonb_build_object(
      'overallScore', 50,
      'optimalDuration', 60,
      'accuracyBySequence', '[]'::jsonb,
      'fatiguePattern', 'consistent',
      'recoveryStrategies', '[]'::jsonb,
      'lastUpdated', v_now
    ),
    'metaCognitionLevel', jsonb_build_object(
      'overallScore', 50,
      'subScores', jsonb_build_object(
        'selfAssessmentAccuracy', 50,
        'errorRecognition', 50,
        'strategySelection', 50,
        'timeManagement', 50
      ),
      'developmentStage', 'developing',
      'improvementAreas', '[]'::jsonb,
      'lastUpdated', v_now
    ),
    'lastUpdated', v_now,
    'version', '1.0'
  );

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql;

-- 7. 메타 프로필 업데이트 후 히스토리 기록 트리거
CREATE OR REPLACE FUNCTION log_meta_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 메타 프로필이 변경된 경우에만 기록
  IF OLD.meta_profile IS DISTINCT FROM NEW.meta_profile THEN
    INSERT INTO student_meta_profile_history (
      student_id,
      indicator_type,
      previous_value,
      new_value,
      changed_by
    ) VALUES (
      NEW.id,
      'full_profile',
      OLD.meta_profile,
      NEW.meta_profile,
      'ai'  -- 기본값, 실제로는 애플리케이션에서 설정
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_meta_profile_change ON students;
CREATE TRIGGER on_meta_profile_change
  AFTER UPDATE OF meta_profile ON students
  FOR EACH ROW
  EXECUTE FUNCTION log_meta_profile_change();

-- 8. 메타 프로필 요약 조회용 뷰
CREATE OR REPLACE VIEW v_student_meta_profile_summary AS
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.grade,
  s.meta_profile->>'lastUpdated' AS profile_last_updated,
  s.meta_profile->'baseline'->>'assessmentDate' AS baseline_date,
  (s.meta_profile->'absorptionRate'->>'overallScore')::INTEGER AS absorption_rate,
  (s.meta_profile->'solvingStamina'->>'overallScore')::INTEGER AS solving_stamina,
  (s.meta_profile->'metaCognitionLevel'->>'overallScore')::INTEGER AS meta_cognition,
  jsonb_array_length(COALESCE(s.meta_profile->'errorSignature'->'primaryErrorTypes', '[]'::jsonb)) AS error_type_count,
  jsonb_array_length(COALESCE(s.meta_profile->'errorSignature'->'signaturePatterns', '[]'::jsonb)) AS signature_pattern_count
FROM students s
WHERE s.meta_profile IS NOT NULL;

COMMENT ON VIEW v_student_meta_profile_summary IS '학생 메타 프로필 요약 정보 조회용 뷰';

-- 9. Growth Loop 상태 테이블 (선택적)
CREATE TABLE IF NOT EXISTS growth_loop_status (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  loop_type TEXT NOT NULL CHECK (loop_type IN ('micro_weekly', 'micro_monthly', 'macro_semi_annual', 'macro_annual')),
  cycle_number INTEGER NOT NULL DEFAULT 1,
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'skipped')) DEFAULT 'active',
  goals JSONB DEFAULT '[]'::jsonb,
  performance_data JSONB DEFAULT '{}'::jsonb,
  adjustments JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, loop_type, cycle_number)
);

COMMENT ON TABLE growth_loop_status IS 'Growth Loop 사이클 상태 추적';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_growth_loop_student
ON growth_loop_status(student_id);

CREATE INDEX IF NOT EXISTS idx_growth_loop_type
ON growth_loop_status(loop_type);

CREATE INDEX IF NOT EXISTS idx_growth_loop_active
ON growth_loop_status(student_id, loop_type)
WHERE status = 'active';

-- RLS
ALTER TABLE growth_loop_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "growth_loop_all_teacher"
ON growth_loop_status
FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher'));

CREATE POLICY "growth_loop_select_parent"
ON growth_loop_status
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM students
  WHERE students.id = growth_loop_status.student_id
  AND students.parent_id = auth.uid()
));

-- 10. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_growth_loop_status_updated_at
  BEFORE UPDATE ON growth_loop_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Migration Complete
-- ============================================
