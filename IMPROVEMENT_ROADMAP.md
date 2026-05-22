# 프로젝트 개선 로드맵 및 실행 계획

> **목표**: "종합 학습 컨설팅 시스템"으로 진화

**작성일**: 2025-11-25
**최종 업데이트**: 2026-04-29
**프로젝트**: Math Learning Platform (Next.js + Supabase + Vercel)
**참고 문서**: CLAUDE.md, MathLearning_PRD_v3.2_Implementation.md, docs/ML_Engine_Enhancement_Plan_v1.0.md, docs/AI_HYBRID_ROUTING_PLAN.md

---

## 📋 목차

1. [현재 상태 요약](#1-현재-상태-요약)
2. [핵심 개선 방향](#2-핵심-개선-방향)
3. [Phase 0: 긴급 개선 ✅ 완료](#3-phase-0-긴급-개선)
4. [Phase 1: 품질 고도화 ✅ 완료](#4-phase-1-품질-고도화)
5. [Phase 2: 데이터 기반 지능화 ✅ 완료](#5-phase-2-데이터-기반-지능화)
6. [Phase 3: 플랫폼화 🔄 진행중](#6-phase-3-플랫폼화)
7. [Phase 3.5: 게이미피케이션 대시보드 🆕 신규](#7-phase-35-게이미피케이션-대시보드)
8. [Phase 4: ML 엔진 고도화](#8-phase-4-ml-엔진-고도화)
9. [실행 체크리스트](#9-실행-체크리스트)

---

## 1. 현재 상태 요약

### ✅ 구현 완료된 기능

| 영역 | 점수 | 평가 |
|---|---|---|
| **Next.js App Router 구조** | ⭐⭐⭐⭐⭐ | 완벽한 라우팅 및 서버 컴포넌트 활용 |
| **Supabase 연동** | ⭐⭐⭐⭐⭐ | PostgreSQL + Auth + RLS 구현 완료 |
| **AI 프롬프트 (5가지 관점)** | ⭐⭐⭐⭐⭐ | 심층 분석 프롬프트 구현 완료 |
| **타입 안전성** | ⭐⭐⭐⭐⭐ | 엄격한 TypeScript 타입 정의 |
| **반응형 UI** | ⭐⭐⭐⭐⭐ | 모바일/태블릿/데스크톱 완벽 대응 |
| **보안 (API 키 보호)** | ⭐⭐⭐⭐⭐ | 서버사이드 API Route 패턴 적용 |

### 🔄 개선 필요 부분

| 영역 | 점수 | 문제점 | 영향도 |
|---|---|---|---|
| **피드백 루프** | ⭐⭐ | 전략 효과 측정 시스템 부재 | 🔴 높음 |
| **예측 모델** | ⭐⭐⭐ | 단순 선형 예측, 정확도 검증 없음 | 🔴 높음 |
| **데이터 활용** | ⭐⭐⭐ | 축적된 데이터 분석 기능 부족 | 🟡 중간 |
| **학부모 기능** | ⭐⭐⭐ | 기본 열람만 가능, 상호작용 부족 | 🟡 중간 |

### 🎯 핵심 문제 진단

**현재 시스템의 핵심 과제:**

1. **피드백 루프 부재**: AI가 제안한 전략이 실제로 효과가 있었는지 추적하지 못함
2. **예측 정확도 미검증**: 3개월/6개월 예측이 실제와 맞는지 확인하는 메커니즘 없음
3. **데이터 사일로**: 축적된 시험 데이터를 패턴 분석에 활용하지 못함

---

## 2. 핵심 개선 방향

### 🎯 개선 원칙

1. **"데이터가 지능을 만든다"**: 축적된 데이터로 예측 정확도 향상
2. **"측정 가능한 목표"**: 모든 전략은 측정 가능한 성과 지표 연결
3. **"피드백 루프 필수"**: 전략 → 실행 → 결과 → 개선 사이클 구축
4. **"점진적 고도화"**: 단계적으로 시스템 지능화

### 📊 성공 지표 (KPI)

| 지표 | 현재 | 목표 (Phase 1 후) | 목표 (Phase 2 후) |
|---|---|---|---|
| **분석 정확도** | 85% | 90% | 95% |
| **전략 실행률** | 30% | 60% | 80% |
| **예측 정확도** | TBD | 70% | 85% |
| **학생 성적 향상** | TBD | +5점/3개월 | +10점/3개월 |
| **교사 만족도** | TBD | 8/10 | 9/10 |

---

## 3. Phase 0: 긴급 개선 ✅ 완료

> **상태**: 완료 (2025-12-22)
> **성과**: 프롬프트 품질 대폭 향상, 타입 시스템 강화

### 3.1. 프롬프트 전면 개선 ✅

#### 완료된 작업

**`src/lib/gemini.ts` - 5가지 관점 분석 프롬프트:**

```typescript
const SYSTEM_PROMPT = `당신은 학생의 수학 학습을 종합적으로 컨설팅하는 전문 AI 교육 컨설턴트입니다.

## 핵심 목표 5가지
1. 학생의 현재 학습 현황을 매우 정확히 파악
2. 오답의 근본 원인과 사고 패턴 분석
3. 잠재적 위험 습관 조기 탐지
4. 실행 가능한 구체적 개선 방법 제시 (5요소 필수)
5. 장기적 성장 비전 제공 (3개월, 6개월 예측)

## 문항별 심층 분석: 5가지 관점 (필수)
1️⃣ 사고의 출발점 분석
2️⃣ 풀이 진행 과정 분석
3️⃣ 계산 및 실수 패턴
4️⃣ 문제 해석 능력
5️⃣ 풀이 습관 관찰

## 개선 전략 5요소 (모든 전략에 필수 포함)
- 무엇을: 구체적 교재, 자료
- 어디서: 페이지, 챕터
- 얼마나: 횟수, 시간
- 어떻게: 구체적 방법
- 측정 방법: 성과 확인 기준`;
```

### 3.2. 타입 시스템 강화 ✅

**`src/types/index.ts` - 완료된 타입 정의:**

```typescript
// 5요소 실행 전략
interface ActionablePrescriptionItem {
  priority: number;           // 1=긴급, 2=중요, 3=장기
  type: '개념 교정' | '습관 교정' | '전략 개선';
  title: string;
  description: string;
  whatToDo: string;           // 무엇을
  where: string;              // 어디서
  howMuch: string;            // 얼마나
  howTo: string;              // 어떻게
  measurementMethod: string;  // 측정 방법
  expectedEffect?: string;
}

// 학습 습관 분석
interface LearningHabit {
  type: 'good' | 'bad';
  description: string;
  frequency: 'always' | 'often' | 'sometimes';
}

// 위험 요인 탐지
interface RiskFactor {
  factor: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

// 성장 예측
interface GrowthPrediction {
  timeframe: '1개월' | '3개월' | '6개월' | '1년';
  predictedScore: number;
  confidenceLevel: number;  // 0-100
  assumptions: string[];
}
```

### Phase 0 완료 체크리스트

- [x] 5가지 관점 분석 프롬프트 구현
- [x] 5요소 개선 전략 타입 정의
- [x] 학습 습관/위험 요인 타입 추가
- [x] 성장 예측 타입 추가
- [x] Next.js API Route에서 Gemini 호출
- [x] Supabase에 분석 결과 저장 (JSONB)

---

## 4. Phase 1: 품질 고도화 ✅ 완료

> **목표**: 코드 품질 개선 및 사용자 경험 향상
> **성과**: Growth Loop 시스템 구축 완료, 학부모 대시보드 개선

### 4.1. 리포트 타입 확장 ✅

**Growth Loop System 구축 완료:**

| 리포트 타입 | 경로 | Loop | 상태 |
|---|---|---|---|
| 레벨 테스트 | `/admin/reports/level-test/new` | Baseline | ✅ 완료 |
| 시험 분석 | `/admin/reports/new` | Micro | ✅ 완료 |
| 주간 리포트 | `/admin/reports/weekly/new` | Micro | ✅ 완료 |
| 월간 리포트 | `/admin/reports/monthly/new` | Micro | ✅ 완료 |
| 반기 종합 | `/admin/reports/semi-annual/new` | Macro | ✅ 완료 |
| 연간 종합 | `/admin/reports/annual/new` | Macro | ✅ 완료 |
| 통합 분석 | `/admin/reports/consolidated/new` | - | ✅ 완료 |

**Growth Loop API Routes:**

| API | 용도 | 상태 |
|---|---|---|
| `/api/level-test/analyze` | Baseline 설정, 메타프로필 초기화 | ✅ 완료 |
| `/api/weekly-report/generate` | 주간 리포트 AI 생성 | ✅ 완료 |
| `/api/monthly-report/generate` | 월간 리포트 AI 생성 | ✅ 완료 |
| `/api/semi-annual-report/generate` | 반기 종합 AI 분석 | ✅ 완료 |
| `/api/annual-report/generate` | 연간 종합 AI 분석 | ✅ 완료 |
| `/api/meta-profile/update` | Anchor Loop 실행 | ✅ 완료 |

### 4.2. 학부모 대시보드 ✅

**완료된 기능:**

```typescript
// src/app/parent/page.tsx - Growth Loop Status 컴포넌트 추가
function GrowthLoopStatus({ reports }: { reports: Report[] }) {
  // 6단계 진행률 시각화 (Baseline → 시험 → 주간 → 월간 → 반기 → 연간)
  // 성장 서사 요약 (연간/반기 리포트에서 추출)
  // Baseline 미설정 경고
  // 장기 비전 표시
}
```

- [x] Growth Loop 진행 상황 시각화
- [x] 리포트 타입별 배지 색상
- [x] 성장 서사 요약 표시
- [x] Baseline 미설정 경고

### 4.3. PDF 내보내기 개선 ⏳ (Phase 2로 이동)

**개선 사항:**
- [ ] 한글 폰트 임베드 (Pretendard)
- [ ] 고해상도 차트 렌더링 (scale: 3)
- [ ] 인쇄 최적화 CSS
- [ ] 페이지 나누기 자동화

### Phase 1 체크리스트

- [x] 시험 분석 리포트 페이지
- [x] 주간/월간 리포트 페이지
- [x] 통합 분석 리포트 페이지
- [x] **레벨 테스트 (Baseline) 페이지** ✨
- [x] **반기 종합 (Macro Loop) 페이지** ✨
- [x] **연간 종합 (Macro Loop) 페이지** ✨
- [x] **Anchor Loop (메타프로필 자동 업데이트)** ✨
- [x] **학부모 대시보드 Growth Loop 상태 표시** ✨
- [ ] PDF 내보내기 개선 → Phase 2로 이동
- [ ] 에러 처리 고도화 (Toast 시스템) → Phase 2로 이동

---

## 5. Phase 2: 데이터 기반 지능화 ⭐ 핵심

> **목표**: 축적된 데이터를 활용하여 시스템 지능화
> **핵심 키워드**: 데이터 기반 지능화, 예측 모델 고도화, 피드백 루프 구축

### 5.1. 피드백 루프 구축 🔴 최우선

**목표**: 전략 제안 → 실행 → 결과 측정 → 전략 개선 사이클 구축

#### 5.1.1. 전략 효과 추적 테이블

```sql
-- Supabase에서 실행
CREATE TABLE strategy_tracking (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id),
  strategy_index INTEGER NOT NULL,        -- 해당 리포트의 몇 번째 전략인지
  strategy_content JSONB NOT NULL,        -- 전략 내용 (ActionablePrescriptionItem)

  -- 실행 추적
  execution_status TEXT DEFAULT 'pending', -- pending | in_progress | completed | skipped
  execution_notes TEXT,                    -- 실행 관련 메모
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 효과 측정
  target_concept TEXT,                     -- 해당 전략이 다루는 개념
  pre_score DECIMAL,                       -- 전략 실행 전 해당 개념 정답률
  post_score DECIMAL,                      -- 전략 실행 후 해당 개념 정답률
  improvement_rate DECIMAL,                -- 개선율 (%)

  -- 평가
  effectiveness_rating INTEGER,            -- 1-5 효과 평가 (교사/학생 평가)
  feedback TEXT,                           -- 피드백 코멘트

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_strategy_tracking_report ON strategy_tracking(report_id);
CREATE INDEX idx_strategy_tracking_concept ON strategy_tracking(target_concept);
```

#### 5.1.2. 전략 효과 분석 API

```typescript
// src/app/api/strategies/effectiveness/route.ts
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  const supabase = await createClient();

  // 해당 학생의 모든 전략과 효과 조회
  const { data: strategies } = await supabase
    .from('strategy_tracking')
    .select(`
      *,
      reports!inner(student_id, test_date)
    `)
    .eq('reports.student_id', studentId)
    .order('created_at', { ascending: false });

  // 전략 유형별 효과 분석
  const effectivenessByType = analyzeByType(strategies);

  // 개념별 개선 추이
  const improvementByConcept = analyzeByConceptt(strategies);

  // 가장 효과적인 전략 패턴 추출
  const bestPatterns = extractBestPatterns(strategies);

  return Response.json({
    strategies,
    effectivenessByType,
    improvementByConcept,
    bestPatterns,
    recommendations: generateRecommendations(bestPatterns)
  });
}

function analyzeByType(strategies: StrategyTracking[]) {
  const types = ['개념 교정', '습관 교정', '전략 개선'];
  return types.map(type => {
    const typeStrategies = strategies.filter(s =>
      s.strategy_content.type === type
    );
    const avgImprovement = typeStrategies.reduce((sum, s) =>
      sum + (s.improvement_rate || 0), 0
    ) / (typeStrategies.length || 1);

    return {
      type,
      count: typeStrategies.length,
      avgImprovement,
      completionRate: typeStrategies.filter(s =>
        s.execution_status === 'completed'
      ).length / (typeStrategies.length || 1)
    };
  });
}
```

#### 5.1.3. 피드백 기반 프롬프트 강화

```typescript
// src/lib/gemini.ts - 피드백 데이터 포함 분석

export async function analyzeWithFeedback(
  studentName: string,
  formData: TestFormData,
  currentImages: string[],
  pastStrategies: StrategyTracking[]  // 이전 전략 효과 데이터
) {
  // 효과적이었던 전략 추출
  const effectiveStrategies = pastStrategies
    .filter(s => s.improvement_rate > 10)
    .map(s => ({
      type: s.strategy_content.type,
      content: s.strategy_content.title,
      improvement: s.improvement_rate
    }));

  // 효과 없었던 전략 추출
  const ineffectiveStrategies = pastStrategies
    .filter(s => s.improvement_rate < 5 && s.execution_status === 'completed')
    .map(s => ({
      type: s.strategy_content.type,
      content: s.strategy_content.title,
      reason: s.feedback
    }));

  const feedbackContext = `
## 이전 전략 효과 분석 (중요!)

### ✅ 효과적이었던 전략 (유사한 방식 권장)
${effectiveStrategies.map(s =>
  `- ${s.type}: ${s.content} (개선율: ${s.improvement}%)`
).join('\n')}

### ❌ 효과 없었던 전략 (다른 접근 필요)
${ineffectiveStrategies.map(s =>
  `- ${s.type}: ${s.content} (이유: ${s.reason})`
).join('\n')}

위 피드백을 반영하여:
1. 효과적이었던 전략과 유사한 방식의 새 전략 제안
2. 효과 없었던 전략은 완전히 다른 접근법으로 대체
3. 이 학생에게 맞는 개인화된 전략 수립
`;

  const prompt = SYSTEM_PROMPT + feedbackContext + TEST_ANALYSIS_PROMPT;
  // ... Gemini API 호출
}
```

### 5.2. 예측 모델 고도화 🔴 중요

**목표**: 더 정확한 성장 예측 및 예측 정확도 검증

#### 5.2.1. 예측 정확도 추적 테이블

```sql
-- 예측 검증 테이블
CREATE TABLE prediction_verification (
  id SERIAL PRIMARY KEY,
  report_id INTEGER REFERENCES reports(id),
  student_id INTEGER REFERENCES students(id),

  -- 예측 내용
  prediction_date DATE NOT NULL,          -- 예측 생성일
  target_date DATE NOT NULL,              -- 예측 대상일 (1개월/3개월/6개월 후)
  timeframe TEXT NOT NULL,                -- '1개월' | '3개월' | '6개월'
  predicted_score INTEGER NOT NULL,       -- 예측 점수
  confidence_level INTEGER NOT NULL,      -- 신뢰도 (0-100)
  assumptions JSONB,                      -- 예측 가정

  -- 실제 결과
  actual_score INTEGER,                   -- 실제 점수 (해당 시점에 업데이트)
  actual_test_id INTEGER,                 -- 실제 시험 리포트 ID

  -- 정확도 분석
  error_amount INTEGER,                   -- 오차 (actual - predicted)
  error_percentage DECIMAL,               -- 오차율
  is_accurate BOOLEAN,                    -- 오차 10% 이내면 true

  -- 메타데이터
  verified_at TIMESTAMPTZ,                -- 검증 완료 시점
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 정기 검증을 위한 인덱스
CREATE INDEX idx_prediction_target_date ON prediction_verification(target_date);
CREATE INDEX idx_prediction_student ON prediction_verification(student_id);
```

#### 5.2.2. 예측 정확도 검증 자동화

```typescript
// src/app/api/predictions/verify/route.ts
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // 검증 대상 예측 조회 (target_date가 지났고 아직 검증 안 된 것)
  const { data: pendingPredictions } = await supabase
    .from('prediction_verification')
    .select('*, students(*)')
    .lte('target_date', today)
    .is('actual_score', null);

  const results = [];

  for (const prediction of pendingPredictions || []) {
    // 해당 학생의 target_date 근처 시험 결과 찾기
    const { data: nearbyTests } = await supabase
      .from('reports')
      .select('*')
      .eq('student_id', prediction.student_id)
      .gte('test_date', prediction.target_date)
      .order('test_date', { ascending: true })
      .limit(1);

    if (nearbyTests && nearbyTests.length > 0) {
      const actualTest = nearbyTests[0];
      const actualScore = actualTest.total_score;
      const errorAmount = actualScore - prediction.predicted_score;
      const errorPercentage = Math.abs(errorAmount) / prediction.predicted_score * 100;

      // 예측 검증 결과 업데이트
      await supabase
        .from('prediction_verification')
        .update({
          actual_score: actualScore,
          actual_test_id: actualTest.id,
          error_amount: errorAmount,
          error_percentage: errorPercentage,
          is_accurate: errorPercentage <= 10,
          verified_at: new Date().toISOString()
        })
        .eq('id', prediction.id);

      results.push({
        studentName: prediction.students.name,
        timeframe: prediction.timeframe,
        predicted: prediction.predicted_score,
        actual: actualScore,
        accuracy: 100 - errorPercentage
      });
    }
  }

  return Response.json({ verified: results.length, results });
}
```

#### 5.2.3. 향상된 예측 알고리즘

```typescript
// src/lib/prediction.ts

interface PredictionInput {
  historicalScores: Array<{ date: string; score: number; maxScore: number }>;
  learningStyle: 'visual' | 'verbal' | 'logical';
  strategyCompletionRate: number;
  weaknessImprovementRate: number;
  pastPredictionAccuracy?: number;  // 이전 예측 정확도
}

export function calculateEnhancedPrediction(input: PredictionInput): GrowthPrediction[] {
  const { historicalScores, strategyCompletionRate, weaknessImprovementRate, pastPredictionAccuracy } = input;

  // 1. 기본 추세 분석 (선형 회귀)
  const trend = calculateTrend(historicalScores);

  // 2. 계절성 분석 (학기 시작/끝 패턴)
  const seasonalFactor = calculateSeasonalFactor();

  // 3. 전략 실행률 기반 가중치
  const executionWeight = 0.5 + (strategyCompletionRate * 0.5);

  // 4. 약점 개선율 기반 보정
  const improvementBonus = weaknessImprovementRate * 0.3;

  // 5. 과거 예측 정확도 기반 신뢰도 조정
  const confidenceAdjustment = pastPredictionAccuracy
    ? pastPredictionAccuracy / 100
    : 0.7;

  const predictions: GrowthPrediction[] = [
    {
      timeframe: '1개월',
      predictedScore: Math.round(
        (trend.slope * 30 + trend.intercept) * executionWeight + improvementBonus
      ),
      confidenceLevel: Math.round(85 * confidenceAdjustment),
      assumptions: [
        `현재 학습 추세 유지 (기울기: ${trend.slope.toFixed(2)}/일)`,
        `전략 실행률 ${Math.round(strategyCompletionRate * 100)}% 기준`,
        '큰 변동 없는 학습 환경 가정'
      ]
    },
    {
      timeframe: '3개월',
      predictedScore: Math.round(
        (trend.slope * 90 + trend.intercept) * executionWeight * seasonalFactor + improvementBonus * 2
      ),
      confidenceLevel: Math.round(70 * confidenceAdjustment),
      assumptions: [
        '현재 개선 속도 유지',
        `약점 영역 ${Math.round(weaknessImprovementRate * 100)}% 추가 개선 예상`,
        '학기 중 일관된 학습'
      ]
    },
    {
      timeframe: '6개월',
      predictedScore: Math.round(
        (trend.slope * 180 + trend.intercept) * executionWeight * seasonalFactor + improvementBonus * 3
      ),
      confidenceLevel: Math.round(55 * confidenceAdjustment),
      assumptions: [
        '장기 학습 계획 충실 이행',
        '정기적 피드백 및 전략 조정',
        '학습 환경 안정적 유지'
      ]
    }
  ];

  return predictions;
}

function calculateTrend(scores: Array<{ date: string; score: number }>) {
  // 선형 회귀 계산
  const n = scores.length;
  if (n < 2) return { slope: 0, intercept: scores[0]?.score || 0 };

  const xValues = scores.map((_, i) => i);
  const yValues = scores.map(s => s.score);

  const xMean = xValues.reduce((a, b) => a + b, 0) / n;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  const numerator = xValues.reduce((sum, x, i) =>
    sum + (x - xMean) * (yValues[i] - yMean), 0
  );
  const denominator = xValues.reduce((sum, x) =>
    sum + Math.pow(x - xMean, 2), 0
  );

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  return { slope, intercept };
}
```

### 5.3. 학습 스타일 분류 시스템

**목표**: 학생의 풀이 패턴 분석 → 개인화된 전략 제공

#### 5.3.1. 학습 스타일 분류 로직

```typescript
// src/lib/learningStyle.ts

export type LearningStyle = 'visual' | 'verbal' | 'logical';

interface StyleIndicators {
  usesGraphs: number;       // 그래프/그림 사용 빈도
  writesExplanations: number; // 문장 설명 빈도
  usesFormulas: number;     // 공식 위주 풀이 빈도
  stepByStep: number;       // 단계별 풀이 빈도
}

export function classifyLearningStyle(
  analysisHistory: AnalysisData[]
): { style: LearningStyle; confidence: number; indicators: StyleIndicators } {

  const indicators: StyleIndicators = {
    usesGraphs: 0,
    writesExplanations: 0,
    usesFormulas: 0,
    stepByStep: 0
  };

  // 과거 분석에서 패턴 추출
  for (const analysis of analysisHistory) {
    for (const detail of analysis.detailedAnalysis || []) {
      if (detail.solvingHabit?.includes('그림') || detail.solvingHabit?.includes('그래프')) {
        indicators.usesGraphs++;
      }
      if (detail.solvingHabit?.includes('설명') || detail.solvingHabit?.includes('문장')) {
        indicators.writesExplanations++;
      }
      if (detail.solvingHabit?.includes('공식') || detail.solvingHabit?.includes('수식')) {
        indicators.usesFormulas++;
      }
      if (detail.solvingHabit?.includes('단계') || detail.solvingHabit?.includes('차례')) {
        indicators.stepByStep++;
      }
    }
  }

  // 스타일 분류
  const total = Object.values(indicators).reduce((a, b) => a + b, 0) || 1;
  const visualScore = indicators.usesGraphs / total;
  const verbalScore = indicators.writesExplanations / total;
  const logicalScore = (indicators.usesFormulas + indicators.stepByStep) / total;

  const maxScore = Math.max(visualScore, verbalScore, logicalScore);

  let style: LearningStyle;
  if (maxScore === visualScore) style = 'visual';
  else if (maxScore === verbalScore) style = 'verbal';
  else style = 'logical';

  return {
    style,
    confidence: Math.round(maxScore * 100),
    indicators
  };
}
```

#### 5.3.2. 스타일별 맞춤 전략 데이터베이스

```sql
-- 학습 스타일별 전략 템플릿
CREATE TABLE strategy_templates (
  id SERIAL PRIMARY KEY,
  learning_style TEXT NOT NULL,           -- 'visual' | 'verbal' | 'logical'
  weakness_type TEXT NOT NULL,            -- '계산 실수' | '개념 이해' | '문제 해석' 등

  -- 전략 템플릿
  strategy_title TEXT NOT NULL,
  strategy_description TEXT NOT NULL,
  what_to_do TEXT NOT NULL,               -- 무엇을
  where_to TEXT NOT NULL,                 -- 어디서
  how_much TEXT NOT NULL,                 -- 얼마나
  how_to TEXT NOT NULL,                   -- 어떻게
  measurement TEXT NOT NULL,              -- 측정 방법

  -- 효과 통계 (피드백 루프 데이터로 업데이트)
  usage_count INTEGER DEFAULT 0,
  avg_improvement_rate DECIMAL DEFAULT 0,
  success_rate DECIMAL DEFAULT 0,         -- 10% 이상 개선 비율

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 삽입 예시
INSERT INTO strategy_templates (learning_style, weakness_type, strategy_title, strategy_description, what_to_do, where_to, how_much, how_to, measurement) VALUES
('visual', '계산 실수', '시각적 계산 검증법', '계산 과정을 색깔 펜으로 구분하여 시각화', '3색 볼펜', '모든 계산 문제', '매일 10문제', '각 단계를 다른 색으로 표시하며 검산', '계산 실수 50% 감소'),
('verbal', '개념 이해', '개념 설명 노트 작성', '배운 개념을 자신의 말로 설명하는 노트 작성', '개념 설명 노트', '새로 배운 개념마다', '개념당 A4 반 페이지', '친구에게 설명하듯이 구어체로 작성', '개념 적용 정답률 80% 달성'),
('logical', '문제 해석', '조건 체크리스트법', '문제의 모든 조건을 번호 붙여 나열 후 체크', '조건 분석 양식', '서술형 문제', '문제당 2분 투자', '조건 번호 → 사용 여부 체크 표 작성', '조건 누락 0건 달성');
```

### 5.4. 데이터 분석 대시보드

**목표**: 축적된 데이터를 시각화하여 인사이트 제공

```typescript
// src/app/admin/analytics/page.tsx

export default async function AnalyticsDashboard() {
  const supabase = await createClient();

  // 전체 학생 성적 추이
  const { data: scoresTrend } = await supabase.rpc('get_scores_trend');

  // 개념별 오답률 분포
  const { data: errorDistribution } = await supabase.rpc('get_error_distribution');

  // 전략 효과 순위
  const { data: strategyRanking } = await supabase.rpc('get_strategy_effectiveness');

  // 예측 정확도 추이
  const { data: predictionAccuracy } = await supabase.rpc('get_prediction_accuracy');

  return (
    <div className="grid grid-cols-2 gap-6 p-6">
      <Card title="전체 성적 추이">
        <LineChart data={scoresTrend} />
      </Card>

      <Card title="개념별 오답률">
        <BarChart data={errorDistribution} />
      </Card>

      <Card title="효과적인 전략 TOP 10">
        <StrategyRankingTable data={strategyRanking} />
      </Card>

      <Card title="예측 정확도">
        <AccuracyGauge data={predictionAccuracy} />
      </Card>
    </div>
  );
}
```

### Phase 2 체크리스트

- [ ] **Phase 1에서 이동된 항목**
  - [ ] PDF 내보내기 개선 (한글 폰트, 고해상도 차트)
  - [x] 에러 처리 고도화 (Auth Refresh Token 에러 처리 완료)

- [x] **피드백 루프 구축** ✅ 완료 (2025-12-30)
  - [x] strategy_tracking 테이블 생성
  - [x] 전략 효과 분석 API 구현 (`/api/strategies/effectiveness`)
  - [x] 전략 관리 API (`/api/strategies`, `/api/strategies/[id]`)
  - [x] 교사용 전략 관리 페이지 (`/admin/strategies`)

- [x] **예측 모델 고도화** ✅ 완료 (2025-12-30)
  - [x] prediction_verification 테이블 생성
  - [x] 예측 정확도 자동 검증 API (`/api/predictions/verify`)
  - [x] 예측 생성 API (`/api/predictions`)
  - [x] 예측 정확도 통계 기능

- [x] **학습 스타일 분류** ✅ 완료 (2025-12-30)
  - [x] strategy_templates 테이블 생성
  - [x] 스타일별 맞춤 전략 템플릿 (9개 초기 데이터)
  - [ ] 스타일 분류 로직 구현 (향후 자동화)

- [x] **데이터 분석 대시보드** ✅ 완료 (2025-12-30)
  - [x] 분석용 Supabase 함수 생성 (4개 RPC 함수)
  - [x] 대시보드 UI 구현 (`/admin/analytics`)
  - [x] 전략 효과/예측 정확도/개념별 개선 현황 시각화

---

## 6. Phase 3: 플랫폼화

> **목표**: 웹 기반 협업 플랫폼으로 확장

### 6.1. 학부모 상호작용 강화

- **실시간 알림**: 새 리포트 생성 시 이메일/푸시 알림
- **학습 계획 체크리스트**: 학부모가 자녀 학습 진행 확인
- **교사-학부모 메시지**: 간단한 피드백 교환 기능

### 6.2. 학생 자기주도 학습

- **목표 설정**: 학생이 직접 목표 설정 및 추적
- **성취 배지**: 목표 달성 시 배지 부여
- **학습 일지**: 매일 학습 내용 기록

### 6.3. 외부 연동

- **노션 연동**: 학생별 노션 페이지 자동 생성
- **캘린더 연동**: 학습 일정 Google Calendar 연동
- **알림 서비스**: 카카오톡 알림 (선택)

### 6.4. 모바일 앱 (장기)

- **사진 촬영 업로드**: 시험지 즉시 촬영 → 분석
- **푸시 알림**: 학습 리마인더
- **오프라인 지원**: 리포트 캐싱

---

## 7. Phase 3.5: 게이미피케이션 대시보드 (학생 동기부여) 🆕 신규

> **목표**: 강력한 보상 체계 및 데이터 시각화를 통한 학생 앱 이용률 및 학습 동기 극대화

### 7.1. 레벨업 & 경험치(XP) 시스템
- 학생의 문제풀이, 분석 열람, 전략 완료 등의 유의미한 액션을 XP로 수치화
- 상단 프로필에 다음 레벨까지의 진행 상황을 프로그레스바로 시각화
- 레벨업 달성 시 화려한 파티클 및 보상 효과 제공

### 7.2. 캡슐 탭 기반 다이나믹 차트
- '종합 정답률', '분석 건수', '개념 이해도' 등의 메타데이터를 상단 캡슐 탭으로 배치
- 탭 클릭 시 하단의 꺾은선(Line/Area) 차트가 매끄럽게 교체되며 과거 추이 제공
- AI가 차트 변환 시 해당 지표에 대한 칭찬 및 인사이트 메시지(한 줄) 동적으로 제공

### 7.3. 5각 레이더 차트 (전투력 비교)
- `meta_profile`의 5가지 역량 축(사고 출발, 풀이 진행, 계산력, 해석력, 습관)을 레이더 차트로 렌더링
- '동일 학년 상위 20% 평균' 또는 과거 자신의 데이터와 겹쳐서 비교하여 명확한 성장 목표 자극

### 7.4. 명예의 전당 (Hall of Fame)
- '최고 점수', '최대 성장 달성' 등의 기록을 프리미엄 카드로 전시
- 연속 접속, 특정 전략 완수 등의 히든 뱃지 해금 시스템(컬렉션 보드) 구현

---

## 8. Phase 4: ML 엔진 고도화

> **목표**: AI 기반 분석 고도화 및 개인화 학습 추천 강화
> **참고 문서**: `docs/ML_Engine_Enhancement_Plan_v1.0.md`
> **전략**: "LLM First, ML Later" - 현재 Gemini 품질 극대화 후 ML 도입

### 7.1. 핵심 전략

```
┌─────────────────────────────────────────────────────────────┐
│                    핵심 전략: "LLM First, ML Later"          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1️⃣ 현재 LLM(Gemini) 기반 분석 품질 극대화                  │
│  2️⃣ 구조화된 데이터 파이프라인 구축 (ML 준비)               │
│  3️⃣ 데이터 충분 시 Knowledge Tracing 도입                  │
│  4️⃣ RL은 사용자 1,000명+ 달성 시 재검토                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2. ML 기법 도입 계획

| 기법 | 우선순위 | 필요 데이터 | 현재 상태 |
|------|---------|------------|----------|
| **Knowledge Tracing (BKT)** | ⭐ P1 | 500+건/학생 | ⏳ 데이터 축적 중 |
| **군집화 (K-means)** | ⭐ P1 | 충분 | ⏳ 구현 가능 |
| **Apriori 연관규칙** | ⚠️ P3 | 1,000+ 트랜잭션 | ❌ 규칙 기반으로 대체 |
| **강화학습 (RL)** | ⛔ P4 | 1,000+ 사용자 | ❌ 규모 부족 |

### 7.3. AI 모델 라우팅 ✅ 구현 완료

> **참고 문서**: `docs/AI_HYBRID_ROUTING_PLAN.md`

| 리포트 타입 | 모델 | 이유 |
|------------|------|------|
| Level Test | Pro | 기준점 설정의 중요성 |
| Semi-Annual | Pro | 장기 성장 분석 |
| Annual | Pro | 종합 성장 스토리 |
| Weekly/Monthly | Flash | 빈번한 생성, 비용 효율 |
| Test Analysis | Flash | 빠른 분석 피드백 |

**구현 파일**: `src/lib/model-router.ts`

### 7.4. Knowledge Tracing 도입 조건

```
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Tracing 도입 조건              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 도입 조건                                               │
│  • 학생당 500+개 문항 응답 데이터                          │
│  • item_response 테이블 구조화                             │
│  • concept_graph (선수학습 관계) 정의                      │
│                                                             │
│  📌 현재 상태                                               │
│  • 학생 25명 × 시험 10회 = 약 250개 데이터포인트            │
│  • 문항 단위 데이터(item_response) 구조화 필요             │
│                                                             │
│  🎯 대안 (즉시 적용 가능)                                   │
│  • 규칙 기반 마스터리: topic별 정답률 > 80% → 마스터       │
│  • BKT (Bayesian Knowledge Tracing): 소규모 데이터 가능    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.5. VEHME 연동 계획 (장기)

- **VEHME**: 벡터 기반 오류 패턴 모델링 시스템
- **도입 조건**: API 접근성 확인 후 PoC 진행
- **예상 효과**: 오류 패턴 자동 분류, 유사 학생 매칭

### Phase 4 체크리스트

- [x] AI 모델 라우팅 구현 (`model-router.ts`) ✅
- [ ] item_response 테이블 설계 및 마이그레이션
- [ ] 학생 유형 군집화 구현 (K-means)
- [ ] BKT 기반 마스터리 추정 구현
- [ ] concept_graph 선수학습 관계 정의
- [ ] VEHME API 연동 PoC

---

## 8. 실행 체크리스트

### Phase 0: 긴급 개선 ✅ 완료

- [x] 5가지 관점 분석 프롬프트 구현
- [x] 5요소 개선 전략 구현
- [x] 타입 시스템 강화
- [x] Next.js API Route 패턴 적용
- [x] Supabase JSONB 저장

### Phase 1: 품질 고도화 ✅ 완료

- [x] 시험 분석 리포트 페이지
- [x] 주간/월간/통합 리포트 페이지
- [x] **레벨 테스트 (Baseline) 페이지** ✨
- [x] **반기 종합 (Macro Loop) 페이지** ✨
- [x] **연간 종합 (Macro Loop) 페이지** ✨
- [x] **Growth Loop System 구축 (6개 리포트 타입)** ✨
- [x] **Anchor Loop (메타프로필 자동 업데이트)** ✨
- [x] **학부모 대시보드 Growth Loop 상태 표시** ✨

### Phase 2: 데이터 기반 지능화 ✅ 대부분 완료

- [ ] PDF 내보내기 개선 (Phase 1에서 이동)
- [x] 에러 처리 고도화 (Auth Refresh Token 처리) ✅
- [x] 피드백 루프 구축 ✅
- [x] 예측 모델 고도화 ✅
- [x] 학습 스타일 분류 시스템 (템플릿 기반) ✅
- [x] 데이터 분석 대시보드 ✅

### Phase 3: 플랫폼화 ⏳ 장기

- [ ] 학부모 상호작용 강화
- [ ] 학생 자기주도 학습 기능
- [ ] 외부 서비스 연동
- [ ] 모바일 앱

---

## 9. 성공 지표 대시보드

### 진행 상황 추적

| Phase | 진행률 | 완료일 | 비고 |
|---|---|---|---|
| Phase 0 | 100% ✅ | 2025-12-22 | 완료 |
| Phase 1 | 100% ✅ | 2025-12-30 | Growth Loop System 구축 완료 |
| Phase 2 | 100% ✅ | 2025-12-30 | 피드백 루프, 예측 모델, 대시보드 완료 |
| Phase 3 | 40% 🔄 | 진행 중 | Rate Limiting, Validation, E2E Tests 구현 완료 |
| Phase 4 | 20% 🔄 | 진행 중 | AI 모델 라우팅 구현 완료 |

### Phase 1 완료 성과 ✨

| 구분 | 내용 |
|---|---|
| **Growth Loop System** | 6개 리포트 타입 순환 시스템 구축 |
| **새 리포트** | level_test, weekly, semi_annual, annual 4개 추가 |
| **새 API** | 5개 Growth Loop API 추가 |
| **Anchor Loop** | 메타프로필 자동 업데이트 시스템 |
| **학부모 대시보드** | Growth Loop 진행 상황 시각화 |

### Phase 2 완료 성과 ✨ (2025-12-30)

| 구분 | 내용 |
|---|---|
| **피드백 루프** | strategy_tracking 테이블, 전략 효과 분석 API, 관리 페이지 |
| **예측 모델** | prediction_verification 테이블, 자동 검증 API |
| **전략 템플릿** | strategy_templates 테이블, 9개 학습 스타일별 전략 |
| **분석 대시보드** | 성적 추이, 전략 효과, 예측 정확도 시각화 |
| **Auth 에러 처리** | Refresh Token 만료 시 graceful 처리 |

### Phase 3~4 진행 성과 ✨ (2026-04-29)

| 구분 | 내용 |
|---|---|
| **Rate Limiting** | `src/lib/rate-limiter.ts` - Upstash Redis + In-memory fallback |
| **Input Validation** | `src/lib/validations.ts` - Zod 스키마 기반 검증 |
| **Sentry 모니터링** | `@sentry/nextjs` 설치 및 에러 트래킹 |
| **E2E 테스트** | `e2e/` 디렉토리 - Playwright 기반 테스트 |
| **AI 모델 라우팅** | `src/lib/model-router.ts` - Pro/Flash 하이브리드 |
| **Feature Flags** | `src/lib/feature-flags.ts` - 기능 토글 시스템 |
| **이메일 시스템** | `src/lib/email.ts` - Resend 연동 |

### KPI 추적

| 지표 | 목표 | 현재 | 달성률 |
|---|---|---|---|
| 분석 정확도 | 95% (P2) | 85% | 89% |
| 전략 실행률 | 80% (P2) | 30% | 37% |
| 예측 정확도 | 85% (P2) | TBD | 측정 가능 |
| 학생 성적 향상 | +10점/3개월 | TBD | - |
| **Growth Loop 구현** | 100% (P1) | 100% | ✅ 100% |
| **피드백 루프 구현** | 100% (P2) | 100% | ✅ 100% |
| **보안 인프라 (P3)** | 100% | 100% | ✅ 100% |
| **AI 모델 라우팅 (P4)** | 100% | 100% | ✅ 100% |
| **Knowledge Tracing (P4)** | 100% | 0% | ⏳ 데이터 축적 중 |

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2025-11-25 | 최초 작성 |
| v1.1 | 2025-12-22 | Phase 0 완료, Phase 1 진행 |
| v1.2 | 2025-12-30 | Phase 1, 2 완료, Growth Loop 시스템 구축 |
| v2.0 | 2026-04-29 | Phase 4 (ML 엔진 고도화) 추가, AI 모델 라우팅 구현 완료 |

---

**작성일**: 2025-11-25
**최종 업데이트**: 2026-04-29
**다음 검토일**: Knowledge Tracing 도입 검토 시
