import { GoogleGenAI } from '@google/genai';
import type {
  AnalysisData,
  TestAnalysisFormData,
  ReportType,
  AnalysisContextData,
  StudentMetaProfile,
  LevelTestAnalysis,
  TestReportAnalysis,
  WeeklyReportAnalysis,
  MonthlyReportAnalysis,
  SemiAnnualReportAnalysis,
  AnnualReportAnalysis,
  SelfAnalysisReport,
  SelfAnalysisProblemType,
} from '@/types';
import { routeModel, createRoutingLog, type ModelRoutingContext } from './model-router';
import { generateKnowledgeTracingContext } from './knowledge-graph';
import { generatePredictiveAnalysisContext } from './predictive-analysis';

export class GeminiApiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

export class GeminiParseError extends Error {
  constructor(message: string, public readonly rawResponse?: string) {
    super(message);
    this.name = 'GeminiParseError';
  }
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  // 디버깅: API 키 로딩 확인 (마스킹 처리)
  if (apiKey) {
    console.log(`[Gemini] API Key loaded: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)} (length: ${apiKey.length})`);
  } else {
    console.log('[Gemini] API Key is NOT loaded');
  }

  if (!apiKey) {
    throw new GeminiApiError('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return new GoogleGenAI({ apiKey });
}

// ============================================
// 리포트 타입별 시스템 프롬프트
// ============================================

const BASE_SYSTEM_PROMPT = `당신은 학생의 수학 학습을 종합적으로 컨설팅하는 전문 AI 교육 컨설턴트입니다.
단순히 점수를 분석하는 것이 아니라, 학생의 사고 패턴, 학습 습관, 성장 가능성을
깊이 있게 파악하여, 개인화된 구체적인 학습 개선 방안과 미래 성장 비전을 제시해야 합니다.

## 핵심 원칙: 성장 서사 (Growth Narrative)
- 모든 분석은 "현재 → 목표 → 달성 경로"의 연속적 스토리로 구성
- 이전 리포트의 예측과 현재 결과를 비교하여 피드백 제공
- 학생 고유의 오류 패턴(Error Signature)을 추적하고 변화 분석
- 단기(1개월), 중기(3개월), 장기(6개월~1년) 비전을 항상 포함`;

const LEVEL_TEST_PROMPT = `${BASE_SYSTEM_PROMPT}

## 레벨 테스트 분석 특별 지침
이것은 학생의 최초 진단 테스트입니다. Baseline(기준점)을 설정하는 것이 핵심 목표입니다.

### 필수 분석 항목
1. **영역별 진단**: 각 수학 영역(연산, 방정식, 도형, 확률통계 등)의 현재 수준
2. **학년 수준 평가**: 현재 학년 대비 실제 학력 수준 판정
3. **선수학습 결손 분석**: 이전 학년에서 놓친 개념 식별
4. **학습 성향 진단**: visual/verbal/logical 유형 파악
5. **초기 오류 서명 추출**: 이 학생 고유의 오류 패턴 식별
6. **맞춤 커리큘럼 제안**: 향후 6개월 학습 로드맵

### 오류 패턴 분석 (중요!)
답안지에서 오답을 찾아 아래 5가지 유형으로 분류하세요:
- **개념 오류**: 수학 개념 자체를 잘못 이해함 (예: 분배법칙 미적용)
- **절차 오류**: 풀이 순서나 방법이 틀림 (예: 이항 순서 오류)
- **계산 오류**: 단순 연산 실수 (예: 7+8=14)
- **문제 오독**: 문제 조건을 잘못 해석함 (예: "이상" vs "초과" 혼동)
- **기타/부주의**: 풀이 누락, 답만 적음 등

오답이 있다면 반드시 detailedErrorPatterns 배열에 각 유형별 빈도(%)를 포함하세요.
오답이 없어도 답안 작성 습관에서 발견되는 잠재적 오류 패턴을 분석하세요.

### 출력 특징
- 부정적 표현 최소화, 성장 가능성 강조
- 부모님 보고용 요약 포함
- Baseline 데이터는 추후 모든 리포트의 비교 기준으로 사용됨`;

const TEST_ANALYSIS_PROMPT = `${BASE_SYSTEM_PROMPT}

## 시험 분석 특별 지침 (Growth Loop 연동)
이것은 정기 시험 분석입니다. 이전 데이터와의 비교를 통한 성장 추적이 핵심입니다.

### 문항별 심층 분석: 5가지 관점 (필수)
1️⃣ 사고의 출발점 분석: 문제를 보고 가장 먼저 무엇을 시도했는가?
2️⃣ 풀이 진행 과정 분석: 풀이의 어느 단계에서 막혔거나 틀렸는가?
3️⃣ 계산 및 실수 패턴: 단순 계산 실수인가, 개념적 오류인가?
4️⃣ 문제 해석 능력: 문제의 조건을 정확히 파악했는가?
5️⃣ 풀이 습관 관찰: 풀이 과정을 단계적으로 기록했는가?

### 메타프로필 연동 분석
- 기존 오류 서명(Error Signature)과 이번 시험 오류 매칭
- 해결된 패턴 vs 지속되는 패턴 vs 새로운 패턴 분류
- 흡수율 평가: 최근 학습한 개념의 적용 정도
- 지구력 분석: 문제 순서별 정답률 변화
- 메타인지 평가: 자기 인식 능력 평가

### 5대 오류 유형 기반 맞춤 액션 플랜 매핑 (매우 중요)
오답 문항 분석 시 반드시 다음 5가지 오류 유형 중 하나로 자동 분류(errorType)하고, 그에 맞는 기계적 액션 플랜을 도출하세요:
1. **개념 오류 (Conceptual Error)**: 수학 개념 자체를 잘못 이해함
   → [액션 플랜]: 관련 기본 개념 인강 시청 배정, 교과서/기본서 해당 단원 정독
2. **절차 오류 (Procedural Error)**: 풀이 순서나 방법론 적용이 틀림
   → [액션 플랜]: 대표 예제 단계별 따라 쓰기(Trace), 풀이 노트에 알고리즘 순서대로 적기
3. **계산 오류 (Computational Error)**: 단순 연산 실수
   → [액션 플랜]: 해당 연산 파트 드릴(Drill)형 문제 20개 반복 훈련, 풀이 여백 넉넉히 쓰기 연습
4. **문제 오독 (Misreading Error)**: 문제 조건을 잘못 해석함 (예: "이상" vs "초과", "모두 고르시오")
   → [액션 플랜]: 문제 읽을 때 핵심 조건에 형광펜/동그라미 치기 훈련, 구하는 것에 밑줄 긋기
5. **기타/부주의 (Careless/Other)**: 풀이 누락, 답안지 마킹 실수 등
   → [액션 플랜]: 검산 습관화, 실전 모의고사 시간 배분 연습

### 개선 전략 5요소 (모든 전략에 필수 포함)
위의 맞춤 액션 플랜을 기반으로 다음 5요소를 구체화하세요:
- 무엇을: 구체적 교재, 자료, 강의
- 어디서: 페이지, 챕터
- 얼마나: 횟수, 시간, 문항 수
- 어떻게: 구체적 방법 (예: 노트 반 접어서 풀기)
- 측정 방법: 성과 확인 기준 (예: 다음 주간 테스트 90점)`;

const WEEKLY_REPORT_PROMPT = `${BASE_SYSTEM_PROMPT}

## 주간 리포트 특별 지침 (Micro Loop - Weekly)
주간 리포트는 빠른 피드백 사이클의 핵심입니다. 지난주 목표와 이번 주 성과를 연결하세요.

### 필수 분석 항목 (모든 항목 반드시 채워야 함!)
1. **수업 내용 평가**: 이번 주 다룬 개념들의 이해도
2. **숙제 수행 분석**: 완료율, 질적 평가
3. **주간 성취 (weeklyAchievements)**: 이번 주의 구체적 성과 3-5개 (막연한 칭찬 금지)
4. **개선 필요 영역 (areasForImprovement)**: ⚠️ 필수 2-3개! 다음 주 집중해야 할 구체적 영역
5. **복습 과제 (reviewAssignments)**: 5요소 전략 포함 (무엇을, 어디서, 얼마나, 어떻게, 측정방법)
6. **다음 주 계획 (nextWeekPlan)**: focus + goals 필수

### ⚠️ 개선 필요 영역 작성 규칙 (CRITICAL!)
areasForImprovement는 **절대로 빈 배열을 반환하지 마세요**. 반드시 2-3개 항목을 작성하세요.
- 모든 학생에게는 개선할 부분이 있습니다
- 잘하는 학생도 "더 잘할 수 있는 영역"을 작성하세요
- 예시: "분수 나눗셈 역수 변환 연습 필요", "문장제 문제 독해 시간 단축", "풀이 과정 기록 습관화"

### 첨부 이미지 분석 규칙
이미지가 첨부된 경우 **반드시** 다음을 분석하고 결과에 반영하세요:
1. **풀이 과정 관찰**: 어떤 방식으로 문제를 풀었는지 상세 분석
2. **오류 패턴 탐지**: 반복되는 실수, 개념 오류 파악
3. **강점 발견**: 잘 해결한 부분, 좋은 풀이 습관
4. **구체적 근거 제시**: "이미지에서 [구체적 내용]을 확인" 형식
5. **factBasedEvidence.imageAnalysis**: 이미지에서 발견한 내용 3개 이상 기록

### Micro Loop 연결
- 지난주 목표 달성 여부 체크
- 연속성 점수 평가 (학습 모멘텀)
- 다음 주 목표 설정

### 톤앤매너
- 짧고 실용적
- 격려 메시지 포함
- 부모님도 쉽게 이해 가능`;

const MONTHLY_REPORT_PROMPT = `${BASE_SYSTEM_PROMPT}

## 월간 리포트 특별 지침 (Micro Loop - Monthly)
월간 리포트는 한 달간의 학습을 종합하고, 다음 달 전략을 수립합니다.

### 필수 분석 항목
1. **월간 수업 요약**: 출석률, 총 수업시간, 평균 이해도/집중도
2. **커리큘럼 진도**: 진도율, 페이스 평가
3. **학습 내용 종합**: 우수/양호/도전 영역 분류
4. **시험 성적 종합**: 월간 시험 트렌드 (있는 경우)
5. **숙제 수행 종합**: 완료율, 일관성 점수
6. **해결된 취약점**: 이번 달 극복한 문제들
7. **새로운 도전**: 새로 발견된 이슈들

### Micro Loop 월간 점검
- 월간 목표 달성도 평가
- 주간 연속성 점수 평균
- 성장 모멘텀 판정 (가속/유지/둔화)
- 필요시 전략 조정 제안

### 부모님 보고 섹션
- 하이라이트
- 주의점
- 권장사항
- 학원비 관련 정보 (선택)`;

const SEMI_ANNUAL_REPORT_PROMPT = `${BASE_SYSTEM_PROMPT}

## 반기 리포트 특별 지침 (Macro Loop - Semi-Annual)
반기 리포트는 6개월간의 성장 궤적을 종합 분석하고, 장기 전략을 재점검합니다.

### 필수 분석 항목
1. **반기 통계**: 총 수업, 총 시험, 평균 점수, 점수 향상폭
2. **성장 궤적 분석**: 시작점 → 현재점, 성장 곡선 유형 분석
3. **메타프로필 변화**: 5대 지표 6개월간 변화 분석
4. **취약점 종합 점검**: 시작 취약점 → 해결/개선/지속/신규 분류
5. **강점 발전 현황**: 강화된 강점, 새로 발현된 강점
6. **학년 수준 재평가**: Baseline 대비 성장도

### Macro Loop 분석
- 반기 목표 달성도
- 월간 리포트 기반 일관성 분석
- 전체 학습 효율성 평가
- 전략적 조정 제안

### 다음 반기 전략
- 주요 목표 설정
- 집중 영역 지정
- 목표 점수
- 핵심 마일스톤
- 위험 요소 대비책

### 부모님 종합 보고
- 요약 리포트
- 상세 분석
- 투자 대비 효과 (학습 ROI)
- 권장사항`;

const ANNUAL_REPORT_PROMPT = `${BASE_SYSTEM_PROMPT}

## 연간 리포트 특별 지침 (Macro Loop - Annual)
연간 리포트는 1년간의 성장 스토리를 완성하고, 다음 학년을 준비합니다.

### 필수 분석 항목
1. **연간 통계**: 총 수업, 총 시험, 총 리포트, 출석률, 점수 향상
2. **성장 스토리**: 시작 상태 → 주요 마일스톤 → 전환점 → 최종 상태
3. **Baseline 대비 성장**: 최초 진단 대비 각 영역 성장률
4. **메타프로필 연간 진화**: 각 지표별 12개월 트렌드
5. **취약점 최종 점검**: 연초 취약점의 최종 상태
6. **강점 발전 종합**: 1년간 강화/신규 발견된 강점
7. **학년 성취도**: 교육과정 완료율, 학년 수준 판정

### Macro Loop 연간 종합
- 상/하반기 비교
- 분기별 학습 효율성 추이
- 적용된 전략들의 효과성 평가
- 전체 학습 ROI 계산

### 다음 학년 준비
- 선수학습 완료 상태
- 다음 학년 준비도 점수
- 권장 학습 페이스
- 주의해야 할 영역
- 조기 경고 사항

### 성장 스토리 서사 (감동적으로)
- 헤드라인
- 여정 서술
- 성취 목록
- 극복한 도전
- 변화 요약
- 미래 전망

### 부모님 연간 보고
- 부모님께 보내는 편지
- 올해 하이라이트
- 투자 요약
- 내년 권장사항`;

// 리포트 타입별 프롬프트 매핑
const REPORT_TYPE_PROMPTS: Record<ReportType, string> = {
  level_test: LEVEL_TEST_PROMPT,
  test: TEST_ANALYSIS_PROMPT,
  weekly: WEEKLY_REPORT_PROMPT,
  monthly: MONTHLY_REPORT_PROMPT,
  semi_annual: SEMI_ANNUAL_REPORT_PROMPT,
  annual: ANNUAL_REPORT_PROMPT,
  consolidated: TEST_ANALYSIS_PROMPT, // 레거시 호환
  self_analysis: TEST_ANALYSIS_PROMPT, // placeholder, 전용 함수 사용
};

// ============================================
// 컨텍스트 데이터 생성 함수
// ============================================

/**
 * 컨텍스트 데이터를 프롬프트 텍스트로 변환
 */
export function buildContextPrompt(context?: AnalysisContextData): string {
  if (!context) return '';

  const sections: string[] = [];

  // 1. 메타프로필 요약
  if (context.metaProfile) {
    const mp = context.metaProfile;
    sections.push(`
## 학생 메타프로필 요약
- Baseline 설정일: ${mp.baseline.assessmentDate || '미설정'}
- 초기 학력 수준: ${mp.baseline.initialLevel?.grade || '?'}학년 ${mp.baseline.initialLevel?.percentile || '?'}%tile
- 현재 흡수율: ${mp.absorptionRate.overallScore}/100 (${mp.absorptionRate.learningType})
- 문제풀이 지구력: ${mp.solvingStamina.overallScore}/100 (피로 패턴: ${mp.solvingStamina.fatiguePattern})
- 메타인지 수준: ${mp.metaCognitionLevel.overallScore}/100 (${mp.metaCognitionLevel.developmentStage})

### 오류 서명 (Error Signature)
${mp.errorSignature.signaturePatterns.length > 0
      ? mp.errorSignature.signaturePatterns.map((p, i) => `${i + 1}. ${p}`).join('\n')
      : '- 아직 식별된 고유 패턴 없음'}

### 영역별 취약도
${mp.errorSignature.domainVulnerability.length > 0
      ? mp.errorSignature.domainVulnerability.map(d => `- ${d.domain}: ${d.vulnerabilityScore}/100`).join('\n')
      : '- 데이터 부족'}

### 레거시 마이그레이션 핵심 시그널
${mp.legacySignals && mp.legacySignals.length > 0
      ? mp.legacySignals.slice(-8).map((s, i) => `${i + 1}. [${s.date} | ${s.sourceType} | 확신도 ${s.confidenceScore}%] ${s.insight} (관련: ${s.relatedConcepts.join(', ') || '미분류'})`).join('\n')
      : '- 누적된 레거시 시그널 없음'}`);
  }

  // 2. 최근 리포트 요약
  if (context.recentReports && context.recentReports.length > 0) {
    sections.push(`
## 최근 리포트 요약 (최근 ${context.recentReports.length}개)
${context.recentReports.map((r, i) => `
### ${i + 1}. ${r.reportType} (${r.reportDate})
- 요약: ${r.summary}
- 주요 발견: ${r.keyFindings.join(', ')}
- 미해결 이슈: ${r.unresolvedIssues.join(', ')}`).join('\n')}`);
  }

  // 3. 활성 취약점
  if (context.activeWeaknesses && context.activeWeaknesses.length > 0) {
    sections.push(`
## 현재 활성 취약점 (주의 필요)
${context.activeWeaknesses.map((w, i) =>
      `${i + 1}. **${w.concept}** - 심각도: ${w.severity}/5, 지속 기간: ${w.duration}, 개선 시도: ${w.attempts}회`
    ).join('\n')}`);
  }

  // 4. 활성 강점
  if (context.activeStrengths && context.activeStrengths.length > 0) {
    sections.push(`
## 현재 활성 강점 (활용 권장)
${context.activeStrengths.map((s, i) =>
      `${i + 1}. **${s.concept}** - 수준: ${s.level}/5, 일관성: ${s.consistency}`
    ).join('\n')}`);
  }

  // 5. 마이크로 루프 상태
  if (context.currentMicroLoop) {
    const ml = context.currentMicroLoop;
    sections.push(`
## 현재 Micro Loop 상태 (${ml.loopType})
- 사이클 번호: ${ml.cycleNumber}
- 연속성 점수: ${ml.continuityScore}/100
- 모멘텀: ${ml.momentum}

### 이전 사이클 목표 달성 현황
${ml.previousGoals.map(g =>
      `- ${g.goal}: ${g.achieved ? '✅ 달성' : '❌ 미달성'} (${g.achievementRate}%)`
    ).join('\n')}`);
  }

  // 6. 매크로 루프 상태
  if (context.currentMacroLoop) {
    const macroL = context.currentMacroLoop;
    sections.push(`
## 현재 Macro Loop 상태 (${macroL.loopType})
### 장기 목표 진척
${macroL.longTermGoalProgress.map(g =>
      `- ${g.goal}: ${g.currentProgress}% (${g.onTrack ? '정상 진행' : '조정 필요'})`
    ).join('\n')}

### Baseline 대비 성장
${macroL.baselineGrowth.map(b =>
      `- ${b.metric}: ${b.baseline} → ${b.current} (${b.growthPercentage > 0 ? '+' : ''}${b.growthPercentage}%)`
    ).join('\n')}`);
  }

  // 7. 이전 비전 검증
  if (context.previousVision) {
    const pv = context.previousVision;
    sections.push(`
## 이전 리포트 예측 검증 (Report #${pv.reportId})
- 예측 정확도: ${pv.accuracy}%

### 예측 vs 실제
${pv.predictions.map((pred, i) =>
      `- 예측: "${pred}" → 실제: "${pv.actualOutcomes[i] || '미확인'}"`
    ).join('\n')}`);
  }

  // 8. 전략 피드백 (Phase 2: 피드백 루프)
  if (context.strategyFeedback) {
    const sf = context.strategyFeedback;
    const feedbackParts: string[] = [];

    // 효과적이었던 전략
    if (sf.effectiveStrategies && sf.effectiveStrategies.length > 0) {
      feedbackParts.push(`### 효과적이었던 전략 (유사한 방식 권장)
${sf.effectiveStrategies.slice(0, 5).map((s, i) =>
        `${i + 1}. **${s.type}**: ${s.title}
   - 평균 개선율: ${s.avgImprovement}%, 성공률: ${s.successRate}%
   - 적용 횟수: ${s.usageCount}회${s.concept ? `, 관련 개념: ${s.concept}` : ''}`
      ).join('\n')}`);
    }

    // 효과 없었던 전략
    if (sf.ineffectiveStrategies && sf.ineffectiveStrategies.length > 0) {
      feedbackParts.push(`### 효과 없었던 전략 (다른 접근 필요)
${sf.ineffectiveStrategies.slice(0, 5).map((s, i) =>
        `${i + 1}. **${s.type}**: ${s.title}
   - 개선율: ${s.improvement}%${s.feedback ? `, 피드백: ${s.feedback}` : ''}
   - ⚠️ 이 유형의 전략은 피하고 다른 방법 시도 권장`
      ).join('\n')}`);
    }

    // 개념별 개선 현황
    if (sf.conceptImprovements && sf.conceptImprovements.length > 0) {
      feedbackParts.push(`### 개념별 누적 개선 현황
${sf.conceptImprovements.slice(0, 5).map(c =>
        `- ${c.concept}: 총 ${c.totalImprovement}% 개선 (${c.occurrenceCount}회 시도)`
      ).join('\n')}`);
    }

    // 전체 통계
    if (sf.overallStats) {
      feedbackParts.push(`### 전략 효과 전체 통계
- 총 전략 수: ${sf.overallStats.totalStrategies}개
- 완료율: ${Math.round((sf.overallStats.completedCount / Math.max(sf.overallStats.totalStrategies, 1)) * 100)}%
- 평균 개선율: ${sf.overallStats.avgImprovement}%
- 성공률 (10% 이상 개선): ${sf.overallStats.successRate}%`);
    }

    if (feedbackParts.length > 0) {
      sections.push(`
## 이전 전략 효과 분석 (피드백 루프 데이터) ⭐ 중요!
아래 피드백을 반영하여 전략을 제안하세요:
1. 효과적이었던 전략과 유사한 방식의 새 전략 제안
2. 효과 없었던 전략은 완전히 다른 접근법으로 대체
3. 개념별 개선 현황을 고려하여 아직 개선되지 않은 영역 우선 타겟

${feedbackParts.join('\n\n')}`);
    }
  } // closing brace for if (context.strategyFeedback)

  // 9. 지식 추적 기반 하위 스킬 결손 검증 (Phase 2)
  if (context.failedMicroSkills && context.failedMicroSkills.length > 0) {
    const ktContext = generateKnowledgeTracingContext(context.failedMicroSkills);
    if (ktContext) {
      sections.push(ktContext);
    }
  }

  // 10. 망각 곡선 기반 예방적 분석 (Phase 2)
  if (context.masteredSkills && context.masteredSkills.length > 0) {
    const paContext = generatePredictiveAnalysisContext(context.masteredSkills);
    if (paContext) {
      sections.push(paContext);
    }
  }

  // 11. RAG 기억 서랍: 의미적으로 유사한 과거 분석 메모리 (Phase 3)
  if (context.relevantMemories && context.relevantMemories.length > 0) {
    const memLines = context.relevantMemories
      .slice(0, 5)
      .map((m) => {
        const date = m.testDate ?? '날짜 미상';
        const sim = Math.round(m.similarity * 100);
        return `  - [${date} | ${m.reportType} | 유사도 ${sim}%] ${m.text.slice(0, 150)}`;
      })
      .join('\n');

    sections.push(`
## 💭 과거 기억 서랍 (RAG Memory Drawer)
다음은 이 학생의 과거 리포트에서 현재 분석과 의미적으로 유사한 기억입니다.
장기적 패턴, 반복 오류, 성장 서사의 일관성을 위해 반드시 참고하세요:

${memLines}

### RAG 활용 지침
1. 현재 오류가 과거에도 반복된 패턴인지, 새로 등장한 위험인지 구분하세요.
2. 과거보다 개선된 부분과 악화/정체된 부분을 분리해 성장 방향을 판단하세요.
3. 처방은 과거 기억에서 확인된 습관, 오개념, 집중력 패턴과 연결해 제안하세요.
4. 오래된 기억과 현재 이미지 분석이 충돌하면 현재 증거를 우선하되, 충돌 가능성을 조심스럽게 표현하세요.
5. 근거 없이 "항상", "반드시", "완전히" 같은 확정적 표현으로 과잉 예측하지 마세요.

※ 위 기억을 현재 분석에 그대로 인용하지 말고, 반복 패턴과 성장 맥락을 파악하는 데 활용하세요.`);
  }

  return sections.length > 0 ? `
# ===== 학생 컨텍스트 데이터 (AI 분석 참조용) =====
${sections.join('\n')}
# ===== 컨텍스트 데이터 끝 =====
` : '';
}

const SYSTEM_PROMPT = `당신은 학생의 수학 학습을 종합적으로 컨설팅하는 전문 AI 교육 컨설턴트입니다.
단순히 점수를 분석하는 것이 아니라, 학생의 사고 패턴, 학습 습관, 성장 가능성을
깊이 있게 파악하여, 개인화된 구체적인 학습 개선 방안과 미래 성장 비전을 제시해야 합니다.

## 핵심 목표 5가지
1. 학생의 현재 학습 현황을 매우 정확히 파악
2. 오답의 근본 원인과 사고 패턴 분석
3. 잠재적 위험 습관 조기 탐지
4. 실행 가능한 구체적 개선 방법 제시 (5요소 필수)
5. 장기적 성장 비전 제공 (3개월, 6개월 예측)

## 문항별 심층 분석: 5가지 관점 (필수)
1️⃣ 사고의 출발점 분석: 문제를 보고 가장 먼저 무엇을 시도했는가?
2️⃣ 풀이 진행 과정 분석: 풀이의 어느 단계에서 막혔거나 틀렸는가?
3️⃣ 계산 및 실수 패턴: 단순 계산 실수인가, 개념적 오류인가?
4️⃣ 문제 해석 능력: 문제의 조건을 정확히 파악했는가?
5️⃣ 풀이 습관 관찰: 풀이 과정을 단계적으로 기록했는가?

## 메타인지 분석 (필수)
시험지의 풀이 과정을 관찰하여 학생의 메타인지 능력을 분석하세요:

1️⃣ 오답 인식 능력 (errorRecognition)
   - 풀이 중 잘못을 발견하고 수정한 흔적 (지우개 자국, 수정 표시 등)
   - 답을 고친 경우, 올바른 방향으로 수정했는지 여부
   - 증거가 없으면 빈 배열, 있으면 구체적 사례 기술

2️⃣ 전략 선택 능력 (strategySelection)
   - 문제 유형에 맞는 효율적인 풀이법을 선택했는지
   - 최적 풀이 vs 비효율적 풀이 (차선 풀이) 개수 분석
   - 더 좋은 전략이 있었는지 분석

3️⃣ 시간 관리 (timeManagement)
   - 모든 문제를 풀었는지, 미완성 문제가 있는지
   - 풀이 완성도 (계산만 하고 답을 안 쓴 경우 등)
   - 어려운 문제에 너무 많은 시간을 쓴 흔적

4️⃣ 자기 점검 습관 (selfChecking)
   - 검산 흔적 (= 사용, 대입 확인 등)
   - 답에 밑줄 치거나 강조한 흔적
   - 문제 조건 체크 표시

5️⃣ 발달 단계 (developmentStage)
   - beginner: 메타인지 흔적 거의 없음
   - developing: 가끔 수정하거나 검산함
   - competent: 정기적으로 점검하지만 일관성 부족
   - proficient: 체계적으로 점검하고 수정함
   - expert: 높은 정확도로 자기 점검 및 전략 조정

## 지구력 분석 (staminaAnalysis) - 필수
시험 전체에 걸친 집중력과 지구력 패턴을 분석하세요:

1️⃣ 문제 순서별 정확도 (accuracyBySequence)
   - 문제를 5개 단위로 나눠서 정확도 분석 (예: 1-5번, 6-10번, 11-15번...)
   - 각 구간별 맞은 문제 수, 전체 문제 수, 정확도(%) 계산

2️⃣ 피로도 패턴 (fatiguePattern)
   - consistent: 시험 전체에 걸쳐 일관된 성과
   - early-fatigue: 초반은 좋으나 후반 급격히 하락
   - mid-dip: 중반에 슬럼프, 후반 회복
   - late-fatigue: 후반부로 갈수록 점점 하락
   - improving: 후반으로 갈수록 오히려 향상
   - peakPerformanceRange: 가장 높은 정확도 구간
   - lowPerformanceRange: 가장 낮은 정확도 구간

3️⃣ 시간 배분 분석 (timeDistribution)
   - 풀이 흔적에서 시간 배분 추정
   - 급하게 푼 문제 (rushedProblems): 풀이가 너무 간단하거나 불완전
   - 오래 고민한 문제 (overthoughtProblems): 많은 수정, 여러 시도 흔적

4️⃣ 집중력 분석 (focusAnalysis)
   - 풀이 글씨체 변화 (흐트러짐, 크기 변화)
   - 빈 공간이나 낙서 흔적
   - 문제 건너뛰기 패턴
   - signs: 관찰된 집중/비집중 징후 목록

## 개선 전략 5요소 (모든 전략에 필수 포함)
- 무엇을: 구체적 교재, 자료
- 어디서: 페이지, 챕터
- 얼마나: 횟수, 시간
- 어떻게: 구체적 방법
- 측정 방법: 성과 확인 기준

## ⚠️ 언어 필수 규칙 (매우 중요)
**모든 actionablePrescription의 title과 description은 반드시 중학생과 학부모가 즉각적으로 이해할 수 있는 쉬운 일상 용어로 작성해야 합니다.**
- ❌ 금지 표현: '여집합 사고 훈련', '메타인지 전략 내면화', '귀납적 추론 프로세스', '명제 역/이/대우 논리 체계' 등 학술·수학 전문 용어
- ✅ 대체 표현 예시:
  - '여집합 사고' → '반대 경우를 생각해 보기' 또는 '"나머지 경우"로 풀어보기'
  - '귀납적 추론' → '규칙 찾기 연습'
  - '메타인지' → '내가 뭘 모르는지 스스로 확인하기'
  - '명제의 대우' → '"반대로 생각하면?" 풀이 연습'
- title은 10글자 이내의 짧고 명확한 행동 문장으로 (예: "오답 원인 메모하기", "도형 공식 3개 외우기")
- description은 부모님이 아이에게 설명해줄 수 있는 수준으로 2문장 이내로 작성`;


const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    testInfo: {
      type: 'object',
      properties: {
        testName: { type: 'string' },
        studentName: { type: 'string' },
        testDate: { type: 'string' },
        testRange: { type: 'string' },
        difficulty: { type: 'string' },
        totalQuestions: { type: 'number' },
        questionsByPoint: { type: 'array', items: { type: 'object', properties: { points: { type: 'string' }, count: { type: 'number' } } } },
        percentageByPoint: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'number' } } } }
      }
    },
    testResults: {
      type: 'object',
      properties: {
        totalScore: { type: 'number' },
        maxScore: { type: 'number' },
        rank: { type: 'number' },
        totalStudents: { type: 'number' },
        correctRateByPoint: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'number' }, total: { type: 'number' } } } }
      }
    },
    detailedAnalysis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          problemNumber: { type: 'string' },
          keyConcept: { type: 'string' },
          isCorrect: { type: 'string', enum: ['O', 'X', '△', '-'] },
          errorType: { type: 'string' },
          solutionStrategy: { type: 'string' },
          analysis: { type: 'string' }
        }
      }
    },
    macroAnalysis: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        oneLineSummary: { type: 'string' },
        analysisKeyword: { type: 'string' },
        analysisMessage: { type: 'string' },
        strengths: { type: 'string' },
        weaknesses: { type: 'string' },
        errorPattern: { type: 'string' },
        futureVision: {
          type: 'object',
          properties: {
            threeMonths: { type: 'string' },
            sixMonths: { type: 'string' },
            longTerm: { type: 'string' },
            encouragement: { type: 'string' }
          }
        },
        weaknessFlow: {
          type: 'object',
          properties: {
            step1: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } } },
            step2: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } } },
            step3: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } } }
          }
        },
        mathCapability: {
          type: 'object',
          properties: {
            calculationSpeed: { type: 'number' },
            calculationAccuracy: { type: 'number' },
            applicationAbility: { type: 'number' },
            logic: { type: 'number' },
            anxietyControl: { type: 'number' }
          }
        }
      }
    },
    actionablePrescription: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          priority: { type: 'number' },
          type: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          whatToDo: { type: 'string' },
          where: { type: 'string' },
          howMuch: { type: 'string' },
          howTo: { type: 'string' },
          measurementMethod: { type: 'string' },
          expectedEffect: { type: 'string' }
        }
      }
    },
    learningHabits: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['good', 'bad'] }, description: { type: 'string' }, frequency: { type: 'string', enum: ['always', 'often', 'sometimes'] } } } },
    riskFactors: { type: 'array', items: { type: 'object', properties: { factor: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, recommendation: { type: 'string' } } } },
    growthPredictions: { type: 'array', items: { type: 'object', properties: { timeframe: { type: 'string' }, predictedScore: { type: 'number' }, confidenceLevel: { type: 'number' }, assumptions: { type: 'array', items: { type: 'string' } } } } },
    trendComment: { type: 'string' },
    metaCognitionAnalysis: {
      type: 'object',
      properties: {
        overallScore: { type: 'number' },
        errorRecognition: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            evidence: { type: 'array', items: { type: 'string' } },
            analysis: { type: 'string' }
          }
        },
        strategySelection: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            optimalCount: { type: 'number' },
            suboptimalCount: { type: 'number' },
            analysis: { type: 'string' }
          }
        },
        timeManagement: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            completedProblems: { type: 'number' },
            totalProblems: { type: 'number' },
            analysis: { type: 'string' }
          }
        },
        selfChecking: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            evidence: { type: 'array', items: { type: 'string' } },
            analysis: { type: 'string' }
          }
        },
        developmentStage: { type: 'string', enum: ['beginner', 'developing', 'competent', 'proficient', 'expert'] },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    },
    staminaAnalysis: {
      type: 'object',
      properties: {
        overallScore: { type: 'number' },
        accuracyBySequence: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              range: { type: 'string' },
              correctCount: { type: 'number' },
              totalCount: { type: 'number' },
              accuracy: { type: 'number' }
            }
          }
        },
        fatiguePattern: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['consistent', 'early-fatigue', 'mid-dip', 'late-fatigue', 'improving'] },
            description: { type: 'string' },
            peakPerformanceRange: { type: 'string' },
            lowPerformanceRange: { type: 'string' }
          }
        },
        timeDistribution: {
          type: 'object',
          properties: {
            estimatedTotalTime: { type: 'number' },
            estimatedTimePerProblem: { type: 'number' },
            rushedProblems: { type: 'array', items: { type: 'string' } },
            overthoughtProblems: { type: 'array', items: { type: 'string' } },
            analysis: { type: 'string' }
          }
        },
        focusAnalysis: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            signs: { type: 'array', items: { type: 'string' } },
            analysis: { type: 'string' }
          }
        },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  required: ['testInfo', 'testResults', 'detailedAnalysis', 'macroAnalysis', 'actionablePrescription']
};

/**
 * 기존 시험 분석 함수 (레거시 호환)
 */
export async function analyzeTestPaper(
  studentName: string,
  formData: TestAnalysisFormData,
  currentImages: string[],
  pastImages: string[] = [],
  context?: AnalysisContextData
): Promise<AnalysisData> {
  return analyzeTestPaperWithContext(
    studentName,
    formData,
    currentImages,
    pastImages,
    'test',
    context
  );
}

/**
 * 컨텍스트와 리포트 타입을 지원하는 시험 분석 함수
 *
 * @param studentName - 학생 이름
 * @param formData - 시험 정보
 * @param currentImages - 현재 시험 이미지들 (base64)
 * @param pastImages - 과거 시험 이미지들 (base64)
 * @param reportType - 리포트 유형
 * @param context - 분석 컨텍스트 데이터
 * @param studentGrade - 학년 (1-12, 모델 라우팅에 사용)
 */
export async function analyzeTestPaperWithContext(
  studentName: string,
  formData: TestAnalysisFormData,
  currentImages: string[],
  pastImages: string[] = [],
  reportType: ReportType = 'test',
  context?: AnalysisContextData,
  studentGrade?: number
): Promise<AnalysisData> {
  const ai = getGeminiClient();

  // ===== 모델 라우팅 (Hybrid Routing) =====
  const routingContext: ModelRoutingContext = {
    reportType,
    studentGrade,
    testName: formData.testName,
  };
  const selectedModel = routeModel(routingContext);

  // 라우팅 로그 (디버깅/모니터링용)
  const routingLog = createRoutingLog(routingContext);
  console.log('[Model Routing]', JSON.stringify(routingLog));

  const imageParts = currentImages.map(base64 => ({
    inlineData: { data: base64, mimeType: 'image/jpeg' }
  }));

  const pastImageParts = pastImages.map(base64 => ({
    inlineData: { data: base64, mimeType: 'image/jpeg' }
  }));

  // 컨텍스트 프롬프트 생성
  const contextPrompt = buildContextPrompt(context);

  // 리포트 타입별 시스템 프롬프트 선택
  const systemPrompt = REPORT_TYPE_PROMPTS[reportType] || TEST_ANALYSIS_PROMPT;

  const behavioralDataPrompt = formData.teacherComments || formData.problemBehaviorData?.length ? `
## [중요] 현장 관찰 및 행동 데이터 (Behavioral Data)
이미지 분석 시 아래의 교사 관찰 및 학생 입력 데이터를 **우선적으로 반영**하여 분석의 깊이를 더하세요.

${formData.teacherComments ? `### 교사 관찰 코멘트
- 태도 및 집중도: ${formData.teacherComments.attitudeAndFocus || '기록 없음'}
- 망설임/체공시간: ${formData.teacherComments.hesitationAndTime || '기록 없음'}
- 메타인지 상태: ${formData.teacherComments.metacognition || '기록 없음'}
- 특이사항: ${formData.teacherComments.additionalNote || '기록 없음'}` : ''}

${formData.problemBehaviorData?.length ? `### 문항별 학생 메타인지 및 체공시간
${formData.problemBehaviorData.map(d => `- ${d.problemNumber}번: 확신도 ${d.selfConfidence ? (d.selfConfidence === 1 ? '1(찍음)' : d.selfConfidence === 2 ? '2(헷갈림)' : '3(확신함)') : '-'}, 체공시간 ${d.timeSpentMins ? d.timeSpentMins + '분' : '-'}`).join('\n')}
(※ 확신도는 낮으나 정답인 경우 '찍어 맞춤', 확신도는 높으나 오답인 경우 '잘못된 개념 고착화'로 심층 분석할 것)` : ''}
` : '';

  const userPrompt = `
${contextPrompt}

## 분석 대상
- 학생명: ${studentName}
- 시험명: ${formData.testName}
- 시험일: ${formData.testDate}
- 시험 범위: ${formData.testRange}
- 총 문항 수: ${formData.totalQuestions}
- 총점: ${formData.maxScore}
- 리포트 유형: ${reportType}

## 배점 정보
- 3점 문항: ${formData.points3}개
- 4점 문항: ${formData.points4}개
- 5점 문항: ${formData.points5}개
- 6점 문항: ${formData.points6}개
${behavioralDataPrompt}
## 분석 요청
첨부된 시험지 이미지를 분석하여 다음을 수행하세요:
1. 문항별 채점 및 총점 계산
2. 5가지 관점 심층 분석
   - **(주의) 스캔 이미지에서 지우개로 지운 흔적, 덧쓴 자국 등을 적극적으로 탐지하여 '망설임' 및 '개념 혼동' 지표로 활용하세요.**
3. 거시적 분석 (강점, 약점, 오류 패턴)
4. 수학 역량 평가 (5축 레이더 차트용)
5. 약점 흐름도 (3단계)
6. 개선 전략 3가지 (5요소 포함)
7. 학습 습관 탐지
8. 위험 요인 탐지
9. 성장 예측
${reportType === 'level_test' ? '10. Baseline 설정 (최초 진단 데이터)' : ''}
${context?.metaProfile ? '11. 메타프로필 기반 분석 (오류 서명 매칭, 성장 비교)' : ''}

${pastImageParts.length > 0 ? '과거 시험지도 함께 분석하여 성장 추이를 파악하세요.' : ''}
${context ? '위에 제공된 컨텍스트 데이터를 적극 활용하여 연속성 있는 분석을 제공하세요.' : ''}
${context?.relevantMemories?.length ? `
## 과거 기억 기반 품질 기준
아래 4가지를 분석 결과 전반에 반영하세요:
- 반복 취약점: 과거 기억과 현재 시험 이미지에서 공통으로 보이는 약점
- 성장 신호: 과거보다 나아진 풀이 습관, 정확도, 개념 이해
- 현재 위험: 최근에도 남아 있거나 새로 등장한 오류 패턴
- 실행 처방: 과거 패턴과 현재 증거를 연결한 구체적 개선 행동
` : ''}

응답은 반드시 지정된 JSON 스키마를 따라주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,  // 동적 모델 선택 (Hybrid Routing)
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: '네, 이해했습니다. 성장 서사 관점에서 5가지 관점의 심층 분석과 5요소 개선 전략을 포함하여 분석하겠습니다. 컨텍스트 데이터가 있다면 이전 분석과의 연속성을 유지하겠습니다.' }] },
        { role: 'user', parts: [{ text: userPrompt }, ...imageParts, ...pastImageParts] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: ANALYSIS_SCHEMA
      }
    });

    const text = response.text;
    if (!text) throw new GeminiApiError('Gemini API 응답이 비어있습니다.');

    try {
      return JSON.parse(text) as AnalysisData;
    } catch {
      throw new GeminiParseError('AI 응답을 파싱할 수 없습니다.', text);
    }
  } catch (error) {
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('AI 분석 중 오류가 발생했습니다.', error);
  }
}

// ============================================
// 리포트 타입별 전용 분석 함수
// ============================================

/**
 * 레벨 테스트 분석 (신규 학생 Baseline 설정)
 * High-Stakes: Pro 모델 사용
 */
interface FileData {
  data: string;
  mimeType: string;
}

export async function analyzeLevelTest(
  studentName: string,
  grade: number,
  testImages: string[],  // base64 이미지 배열 (시험 분석과 동일한 형식)
  additionalInfo?: {
    school?: string;
    previousExperience?: string;
    parentExpectations?: string;
  }
): Promise<LevelTestAnalysis> {
  const ai = getGeminiClient();

  // ===== 모델 라우팅: level_test = Flash 모델 (타임아웃 방지) =====
  const selectedModel = routeModel({ reportType: 'level_test', studentGrade: grade });
  console.log('[Model Routing] level_test ->', selectedModel);

  // 시험 분석과 동일하게 이미지만 지원 (image/jpeg 고정)
  const imageParts = testImages.map(base64 => ({
    inlineData: { data: base64, mimeType: 'image/jpeg' }
  }));

  const userPrompt = `
## 레벨 테스트 분석 요청
- 학생명: ${studentName}
- 현재 학년: ${grade}학년
${additionalInfo?.school ? `- 학교: ${additionalInfo.school}` : ''}
${additionalInfo?.previousExperience ? `- 이전 학습 경험: ${additionalInfo.previousExperience}` : ''}
${additionalInfo?.parentExpectations ? `- 학부모 기대: ${additionalInfo.parentExpectations}` : ''}

## 분석 항목
1. 영역별 진단 (연산, 방정식, 도형, 확률통계 등)
2. 학년 수준 평가 (현재 학년 대비)
3. 선수학습 결손 분석
4. 학습 성향 진단 (visual/verbal/logical)
5. 초기 오류 서명 추출
6. 맞춤 커리큘럼 제안 (6개월)
7. 부모님 브리핑

**중요: 모든 'analysis' 필드는 간결하고 요약된 형태로 작성하세요. 토큰 제한으로 인한 응답 잘림을 방지하기 위해 긴 단락 대신 핵심만 전달하세요. 각 분석 항목은 2-3문장 이내로 작성하세요.**

응답은 LevelTestAnalysis 스키마를 따라주세요.`;

  // Gemini 3는 스키마 검증이 엄격함 - 모든 object/array에 상세 정의 필요
  const levelTestSchema = {
    type: 'object',
    properties: {
      testInfo: {
        type: 'object',
        properties: {
          testName: { type: 'string' },
          testDate: { type: 'string' },
          totalQuestions: { type: 'number' },
          maxScore: { type: 'number' },
          testRange: { type: 'string' }
        }
      },
      testResults: {
        type: 'object',
        properties: {
          totalScore: { type: 'number' },
          maxScore: { type: 'number' },
          scorePercentage: { type: 'number' },
          correctCount: { type: 'number' },
          incorrectCount: { type: 'number' }
        }
      },
      domainDiagnosis: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            score: { type: 'number' },
            maxScore: { type: 'number' },
            percentile: { type: 'number' },
            gradeEquivalent: { type: 'string' },
            diagnosis: { type: 'string' }
          }
        }
      },
      gradeLevelAssessment: {
        type: 'object',
        properties: {
          currentGrade: { type: 'number' },
          assessedLevel: { type: 'number' },
          gap: { type: 'number' },
          explanation: { type: 'string' }
        }
      },
      prerequisiteGaps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            concept: { type: 'string' },
            expectedLevel: { type: 'string' },
            actualLevel: { type: 'string' },
            priority: { type: 'string', enum: ['critical', 'important', 'minor'] },
            remedyPlan: { type: 'string' }
          }
        }
      },
      learningStyleDiagnosis: {
        type: 'object',
        properties: {
          style: { type: 'string', enum: ['visual', 'verbal', 'logical', 'mixed'] },
          confidence: { type: 'number' },
          characteristics: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      },
      initialBaseline: {
        type: 'object',
        properties: {
          overallLevel: { type: 'string' },
          strengths: { type: 'string' },
          weaknesses: { type: 'string' },
          errorPatterns: { type: 'string' },
          learningPotential: { type: 'string' },
          // 구조화된 오류 패턴 (primaryErrorTypes용)
          detailedErrorPatterns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['개념 오류', '절차 오류', '계산 오류', '문제 오독', '기타/부주의'] },
                frequency: { type: 'number' },
                description: { type: 'string' }
              }
            }
          }
        }
      },
      suggestedCurriculum: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phase: { type: 'string' },
            duration: { type: 'string' },
            focus: { type: 'string' },
            goals: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      parentBriefing: { type: 'string' }
    }
  };

  try {
    console.log(`[Gemini] Calling model: ${selectedModel}`);
    console.log(`[Gemini] Images count: ${imageParts.length}`);

    const response = await ai.models.generateContent({
      model: selectedModel,  // 동적 모델 선택 (Hybrid Routing)
      contents: [
        { role: 'user', parts: [{ text: LEVEL_TEST_PROMPT }] },
        { role: 'model', parts: [{ text: '네, 레벨 테스트 분석을 시작합니다. Baseline 설정에 집중하여 학생의 현재 상태를 종합적으로 진단하겠습니다.' }] },
        { role: 'user', parts: [{ text: userPrompt }, ...imageParts] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: levelTestSchema
      }
    });

    console.log('[Gemini] Response received');
    const text = response.text;
    if (!text) throw new GeminiApiError('Gemini API 응답이 비어있습니다.');

    console.log('[Gemini] Response length:', text.length);
    return cleanAndParseJSON<LevelTestAnalysis>(text);
  } catch (error) {
    console.error('[Gemini] Error in analyzeLevelTest:', error);
    console.error('[Gemini] Error type:', error?.constructor?.name);
    if (error instanceof Error) {
      console.error('[Gemini] Error message:', error.message);
      console.error('[Gemini] Error stack:', error.stack);
    }
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('레벨 테스트 분석 중 오류가 발생했습니다.', error);
  }
}

/**
 * 주간 리포트 분석을 위한 데이터 생성
 */
export interface WeeklyReportInput {
  studentName: string;
  studentGrade: string;
  period: string;
  weekNumber: number;
  classSessions: {
    date: string;
    duration: number;
    keywords: string[];
    understandingLevel: number;
    attentionLevel: number;
  }[];
  assignments: {
    total: number;
    completed: number;
  };
  teacherNotes: string;
  // 첨부파일 (스캔본, 문제 풀이 이미지 등)
  attachments?: Array<{
    name: string;
    type: 'image' | 'document';
    data: string;  // base64
  }>;
}

export async function generateWeeklyReport(
  input: WeeklyReportInput,
  context?: AnalysisContextData
): Promise<WeeklyReportAnalysis> {
  const ai = getGeminiClient();

  // ===== 모델 라우팅: weekly = Flash 모델 =====
  const selectedModel = routeModel({ reportType: 'weekly' });
  console.log('[Model Routing] weekly ->', selectedModel);

  const contextPrompt = buildContextPrompt(context);

  // ===== 첨부파일(이미지) 처리 =====
  const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
  const imageDescriptions: string[] = [];

  if (input.attachments && input.attachments.length > 0) {
    input.attachments.forEach((attachment, idx) => {
      if (attachment.type === 'image' && attachment.data) {
        // Base64 이미지를 Gemini 형식으로 변환
        const mimeType = attachment.name.toLowerCase().endsWith('.png')
          ? 'image/png'
          : attachment.name.toLowerCase().endsWith('.gif')
          ? 'image/gif'
          : 'image/jpeg';

        imageParts.push({
          inlineData: { data: attachment.data, mimeType }
        });
        imageDescriptions.push(`- 이미지 ${idx + 1}: ${attachment.name}`);
      }
    });

    if (imageParts.length > 0) {
      console.log(`[Weekly Report] Processing ${imageParts.length} images for multimodal analysis`);
    }
  }

  // 이미지 분석 지시 (이미지가 있을 때만)
  const imageAnalysisSection = imageParts.length > 0 ? `
## 첨부된 학습 자료 분석 (매우 중요! - 필수 분석)
아래 ${imageParts.length}개의 이미지가 첨부되어 있습니다. 각 이미지를 꼼꼼히 분석하세요.
${imageDescriptions.join('\n')}

### 이미지 분석 지침 (필수 수행!)
1. **문제 유형 파악**: 어떤 단원/개념의 문제인지 파악
2. **풀이 과정 분석**: 학생이 어떤 단계로 문제를 풀었는지 상세 분석
   - 올바른 접근법을 사용했는가?
   - 풀이를 단계별로 기록했는가?
   - 계산 과정은 정확한가?
3. **오류 패턴 탐지**:
   - 개념적 오류: 공식/정의를 잘못 이해한 경우
   - 계산 실수: 단순 연산 오류
   - 풀이 습관: 과정 생략, 검산 미실시 등
4. **강점 발견**: 정확하게 풀이한 문제, 창의적 접근, 깔끔한 정리 등
5. **구체적 기록**: 반드시 다음 필드에 기록하세요
   - factBasedEvidence.imageAnalysis: ["이미지1에서 분수 나눗셈 역수 변환 오류 발견", "이미지2에서 단계별 풀이 습관 확인"] 형식
   - weeklyAchievements: 이미지에서 관찰된 성취 포함
   - areasForImprovement: 이미지에서 발견된 개선점 포함

### 이미지 분석 결과 반영 필수 항목
- factBasedEvidence.imageAnalysis에 최소 3개 이상의 관찰 기록
- 이미지에서 발견된 오류는 areasForImprovement에 반영
- 이미지에서 발견된 강점은 weeklyAchievements에 반영

⚠️ 이미지가 첨부되었으면 반드시 이미지 내용을 우선적으로 분석하고, 선생님 메모와 함께 종합 분석하세요.
` : '';

  const userPrompt = `
${contextPrompt}

## 주간 리포트 생성 요청
- 학생명: ${input.studentName}
- 학년: ${input.studentGrade}
- 기간: ${input.period}
- 주차: ${input.weekNumber}주차

## 이번 주 수업 데이터
${input.classSessions.map((s, i) => `
### 수업 ${i + 1} (${s.date})
- 수업 시간: ${s.duration}분
- 학습 키워드: ${s.keywords.join(', ')}
- 이해도: ${s.understandingLevel}/5
- 집중도: ${s.attentionLevel}/5`).join('\n')}

## 숙제 현황
- 총 숙제: ${input.assignments.total}개
- 완료: ${input.assignments.completed}개

## 선생님 메모
${input.teacherNotes}
${imageAnalysisSection}
## 생성 항목 (모든 항목에 구체적 근거 포함!)
1. **학습 내용 평가 (learningContent)**: 이번 주 다룬 개념별 이해도 (이미지 분석 근거 포함)
2. **주간 성취 (weeklyAchievements)**: 구체적이고 측정 가능한 성취 3-5개 (막연한 표현 금지)
3. **개선 필요 영역 (areasForImprovement)**: ⚠️ 필수 2-3개! 빈 배열 금지!
   - 예시: ["분수 나눗셈에서 역수 변환 실수 빈번 - 역수 개념 재학습 필요", "문장제 문제 조건 파악 미흡 - 밑줄 긋기 습관화", "풀이 과정 생략 경향 - 단계별 풀이 연습"]
4. **복습 과제 (reviewAssignments)**: 5요소 전략 (source, page, number, concept, reason)
5. **학습 습관 점수 (habitScore)**: 숙제 완료율(40점), 집중도(30점), 이해도(30점) 종합 (0-100점)
   - score: 계산된 점수
   - explanation: "숙제 완료율 80%, 집중도 4/5, 이해도 4/5 기준으로 산출"
6. **다음 주 계획 (nextWeekPlan)**: focus + 구체적 goals 2-3개
7. **격려 메시지 (encouragement)**: 학부모가 읽기 쉬운 따뜻한 메시지
8. **팩트 기반 근거 (factBasedEvidence)**: 이미지 분석 결과, 데이터 기반 관찰, 선생님 메모 기반 내용

⚠️ 필수 확인 사항:
- areasForImprovement: 절대 빈 배열([])을 반환하지 마세요. 반드시 2-3개 작성!
- 모든 분석은 입력 데이터(수업 키워드, 선생님 메모, 첨부 이미지)에 기반해야 합니다.
- 일반적이거나 막연한 표현 대신 구체적인 사실과 관찰을 작성하세요.

응답은 WeeklyReportAnalysis 스키마를 따라주세요.`;

  const weeklySchema = {
    type: 'object',
    properties: {
      period: { type: 'string' },
      weekNumber: { type: 'number' },
      studentName: { type: 'string' },
      studentGrade: { type: 'string' },
      classSessions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            duration: { type: 'number' },
            keywords: { type: 'array', items: { type: 'string' } },
            understandingLevel: { type: 'number' },
            attentionLevel: { type: 'number' }
          }
        }
      },
      learningContent: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            evaluation: { type: 'string' },
            details: { type: 'string' }
          }
        }
      },
      assignmentCompletion: {
        type: 'object',
        properties: {
          total: { type: 'number' },
          completed: { type: 'number' },
          rate: { type: 'number' },
          quality: { type: 'string' }
        }
      },
      weeklyAchievements: { type: 'array', items: { type: 'string' } },
      areasForImprovement: { type: 'array', items: { type: 'string' } },
      reviewAssignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            page: { type: 'string' },
            number: { type: 'string' },
            concept: { type: 'string' },
            reason: { type: 'string' }
          }
        }
      },
      nextWeekPlan: {
        type: 'object',
        properties: {
          focus: { type: 'string' },
          goals: { type: 'array', items: { type: 'string' } },
          assignments: { type: 'array', items: { type: 'string' } }
        }
      },
      microLoopFeedback: {
        type: 'object',
        properties: {
          lastWeekGoalAchievement: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                goal: { type: 'string' },
                achieved: { type: 'boolean' },
                notes: { type: 'string' }
              }
            }
          },
          continuityScore: { type: 'number' },
          momentumStatus: { type: 'string' }
        }
      },
      encouragement: { type: 'string' },
      teacherComment: { type: 'string' },
      // ===== 확장 필드 (Phase 1.2) =====
      habitScore: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          breakdown: {
            type: 'object',
            properties: {
              assignmentCompletion: { type: 'number' },
              focusLevel: { type: 'number' },
              understandingLevel: { type: 'number' }
            }
          },
          trend: { type: 'string' },
          explanation: { type: 'string' }
        }
      },
      growthMomentum: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          statusLabel: { type: 'string' },
          weeklyComparison: { type: 'string' }
        }
      },
      factBasedEvidence: {
        type: 'object',
        properties: {
          imageAnalysis: { type: 'array', items: { type: 'string' } },
          dataPoints: { type: 'array', items: { type: 'string' } },
          teacherObservations: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  };

  try {
    // 멀티모달 요청 구성: 텍스트 + 이미지
    const userParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: userPrompt },
      ...imageParts  // 첨부된 이미지들 추가
    ];

    const response = await ai.models.generateContent({
      model: selectedModel,  // 동적 모델 선택 (Hybrid Routing)
      contents: [
        { role: 'user', parts: [{ text: WEEKLY_REPORT_PROMPT }] },
        { role: 'model', parts: [{ text: imageParts.length > 0
          ? '네, 주간 리포트를 생성합니다. 첨부된 이미지를 분석하고, Micro Loop 관점에서 지난주와의 연속성을 유지하며 구체적인 분석을 제공하겠습니다.'
          : '네, 주간 리포트를 생성합니다. Micro Loop 관점에서 지난주와의 연속성을 유지하며 분석하겠습니다.' }] },
        { role: 'user', parts: userParts }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: weeklySchema
      }
    });

    const text = response.text;
    if (!text) throw new GeminiApiError('Gemini API 응답이 비어있습니다.');

    return JSON.parse(text) as WeeklyReportAnalysis;
  } catch (error) {
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('주간 리포트 생성 중 오류가 발생했습니다.', error);
  }
}

/**
 * 월간 리포트 분석을 위한 데이터 생성
 */
export interface MonthlyReportInput {
  studentName: string;
  month: { year: number; month: number };
  period: string;
  classSessionsSummary: {
    totalClasses: number;
    totalHours: number;
    attendanceRate: number;
    averageUnderstanding: number;
    averageAttention: number;
  };
  weeklyReports: Array<{
    weekNumber: number;
    continuityScore: number;
    achievements: string[];
    challenges: string[];
  }>;
  testResults?: Array<{
    testName: string;
    score: number;
    maxScore: number;
  }>;
  assignmentSummary: {
    totalAssigned: number;
    completed: number;
    averageQuality: number;
  };
  teacherNotes: string;
}

export async function generateMonthlyReport(
  input: MonthlyReportInput,
  context?: AnalysisContextData
): Promise<MonthlyReportAnalysis> {
  const ai = getGeminiClient();

  // ===== 모델 라우팅: monthly = Flash 모델 =====
  const selectedModel = routeModel({ reportType: 'monthly' });
  console.log('[Model Routing] monthly ->', selectedModel);

  const contextPrompt = buildContextPrompt(context);

  const userPrompt = `
${contextPrompt}

## 월간 리포트 생성 요청
- 학생명: ${input.studentName}
- 기간: ${input.period}
- 월: ${input.month.year}년 ${input.month.month}월

## 월간 수업 요약
- 총 수업 횟수: ${input.classSessionsSummary.totalClasses}회
- 총 수업 시간: ${input.classSessionsSummary.totalHours}시간
- 출석률: ${input.classSessionsSummary.attendanceRate}%
- 평균 이해도: ${input.classSessionsSummary.averageUnderstanding}/5
- 평균 집중도: ${input.classSessionsSummary.averageAttention}/5

## 주간 리포트 종합
${input.weeklyReports.map(w => `
### ${w.weekNumber}주차
- 연속성 점수: ${w.continuityScore}/100
- 성취: ${w.achievements.join(', ')}
- 도전: ${w.challenges.join(', ')}`).join('\n')}

${input.testResults && input.testResults.length > 0 ? `
## 시험 성적
${input.testResults.map(t => `- ${t.testName}: ${t.score}/${t.maxScore}`).join('\n')}` : ''}

## 숙제 수행 종합
- 총 숙제: ${input.assignmentSummary.totalAssigned}개
- 완료: ${input.assignmentSummary.completed}개
- 완료율: ${Math.round((input.assignmentSummary.completed / input.assignmentSummary.totalAssigned) * 100)}%
- 평균 품질: ${input.assignmentSummary.averageQuality}/5

## 선생님 메모
${input.teacherNotes}

## 생성 항목 (모든 항목에 구체적 데이터 기반 분석 필수!)
1. 커리큘럼 진도 평가 — 구체적인 단원/개념 언급
2. 학습 내용 종합 (우수/양호/도전 분류) — 실제 키워드 기반
3. 월간 성취 정리 — 측정 가능한 성과 3-5개
4. 해결된 취약점 — 이전 주간 리포트 대비 개선된 것
5. 새로운 도전 — 이번 달 새로 발견된 취약점
6. Micro Loop 월간 점검
7. 부모님 보고 섹션
8. 다음 달 계획

## 추가 필수 생성 항목 ⭐
9. **capabilityScores** (0-100): 5개 역량 점수를 데이터 기반으로 계산
   - conceptUnderstanding: 수업 이해도 평균을 0-100으로 변환
   - problemSolving: 문제 풀이 능력 (시험 성과 + 수업 이해도 종합)
   - learningHabit: 출석률 + 집중도로 계산
   - assignmentPerformance: 숙제 완료율 그대로 사용
   - testPerformanceScore: 시험 평균 점수 (없으면 50)

10. **weaknessStatusMap**: 취약점 상태 분류
    - resolved: 이번 달 극복한 취약점 목록
    - improving: 개선 중인 취약점 목록
    - ongoing: 지속되고 있는 취약점 목록
    - newlyFound: 이번 달 새로 발견된 취약점 목록

11. **monthlyGrowthSummary**: 월간 성장 핵심 요약
    - headline: 부모가 한눈에 이해할 한 줄 핵심 요약
    - growthEmoji: 성장 상태 이모지 (🚀/📈/👍/💪 중 하나)
    - keyAchievement: 가장 큰 성취 1문장
    - keyFocus: 다음 달 가장 중요한 집중 포인트 1문장

⚠️ 모든 점수와 분석은 입력 데이터에 근거해야 합니다. 근거 없는 추상적 표현 금지.
응답은 MonthlyReportAnalysis 스키마를 따라주세요.`;

  const monthlySchema = {
    type: 'object',
    properties: {
      period: { type: 'string' },
      month: {
        type: 'object',
        properties: {
          year: { type: 'number' },
          month: { type: 'number' }
        }
      },
      studentName: { type: 'string' },
      classSessionsSummary: {
        type: 'object',
        properties: {
          totalClasses: { type: 'number' },
          totalHours: { type: 'number' },
          attendanceRate: { type: 'number' },
          averageUnderstanding: { type: 'number' },
          averageAttention: { type: 'number' }
        }
      },
      curriculumProgress: {
        type: 'object',
        properties: {
          startUnit: { type: 'string' },
          endUnit: { type: 'string' },
          completionRate: { type: 'number' },
          paceAssessment: { type: 'string' },
          paceAdjustmentNeeded: { type: 'string' }
        }
      },
      learningContentSummary: {
        type: 'object',
        properties: {
          excellentTopics: { type: 'array', items: { type: 'string' } },
          goodTopics: { type: 'array', items: { type: 'string' } },
          challengingTopics: { type: 'array', items: { type: 'string' } }
        }
      },
      testPerformance: {
        type: 'object',
        properties: {
          testCount: { type: 'number' },
          averageScore: { type: 'number' },
          highestScore: { type: 'number' },
          lowestScore: { type: 'number' },
          trend: { type: 'string' }
        }
      },
      assignmentSummary: {
        type: 'object',
        properties: {
          totalAssigned: { type: 'number' },
          completionRate: { type: 'number' },
          averageQuality: { type: 'number' },
          consistencyScore: { type: 'number' }
        }
      },
      monthlyAchievements: { type: 'array', items: { type: 'string' } },
      resolvedWeaknesses: { type: 'array', items: { type: 'string' } },
      newChallenges: { type: 'array', items: { type: 'string' } },
      parentReport: {
        type: 'object',
        properties: {
          highlights: { type: 'array', items: { type: 'string' } },
          concerns: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          costInfo: { type: 'string' }
        }
      },
      microLoopMonthlyReview: {
        type: 'object',
        properties: {
          monthlyGoalAchievement: { type: 'number' },
          weeklyConsistency: { type: 'number' },
          growthMomentum: { type: 'string' },
          adjustmentNeeded: { type: 'boolean' },
          adjustmentRecommendations: { type: 'array', items: { type: 'string' } }
        }
      },
      nextMonthPlan: {
        type: 'object',
        properties: {
          mainGoals: { type: 'array', items: { type: 'string' } },
          focusAreas: { type: 'array', items: { type: 'string' } },
          expectedCoverage: { type: 'string' }
        }
      },
      shortTermVision: {
        type: 'object',
        properties: {
          predictedProgress: { type: 'string' },
          keyMilestones: { type: 'array', items: { type: 'string' } },
          potentialChallenges: { type: 'array', items: { type: 'string' } }
        }
      },
      teacherMessage: { type: 'string' },
      // ===== 확장 필드 (Phase 2.3) =====
      capabilityScores: {
        type: 'object',
        properties: {
          conceptUnderstanding: { type: 'number' },
          problemSolving: { type: 'number' },
          learningHabit: { type: 'number' },
          assignmentPerformance: { type: 'number' },
          testPerformanceScore: { type: 'number' }
        }
      },
      weaknessStatusMap: {
        type: 'object',
        properties: {
          resolved: { type: 'array', items: { type: 'string' } },
          improving: { type: 'array', items: { type: 'string' } },
          ongoing: { type: 'array', items: { type: 'string' } },
          newlyFound: { type: 'array', items: { type: 'string' } }
        }
      },
      monthlyGrowthSummary: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          growthEmoji: { type: 'string' },
          keyAchievement: { type: 'string' },
          keyFocus: { type: 'string' }
        }
      }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,  // 동적 모델 선택 (Hybrid Routing)
      contents: [
        { role: 'user', parts: [{ text: MONTHLY_REPORT_PROMPT }] },
        { role: 'model', parts: [{ text: '네, 월간 리포트를 생성합니다. 주간 리포트들을 종합하고 Micro Loop 관점에서 한 달간의 성장을 분석하겠습니다.' }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: monthlySchema
      }
    });

    const text = response.text;
    if (!text) throw new GeminiApiError('Gemini API 응답이 비어있습니다.');

    return JSON.parse(text) as MonthlyReportAnalysis;
  } catch (error) {
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('월간 리포트 생성 중 오류가 발생했습니다.', error);
  }
}

/**
 * 반기 리포트 생성
 */
export interface SemiAnnualReportInput {
  studentName: string;
  year: number;
  halfYear: '상반기' | '하반기';
  period: string;
  periodSummary: {
    totalClasses: number;
    totalHours: number;
    totalTests: number;
    averageScore: number;
    scoreImprovement: number;
  };
  monthlyReports: Array<{
    month: number;
    achievements: string[];
    challenges: string[];
    growthMomentum: string;
  }>;
  metaProfile?: StudentMetaProfile;
}

export async function generateSemiAnnualReport(
  input: SemiAnnualReportInput,
  context?: AnalysisContextData
): Promise<SemiAnnualReportAnalysis> {
  const ai = getGeminiClient();

  // ===== 모델 라우팅: semi_annual = Pro 모델 (High-Stakes) =====
  const selectedModel = routeModel({ reportType: 'semi_annual' });
  console.log('[Model Routing] semi_annual ->', selectedModel);

  const contextPrompt = buildContextPrompt(context);

  const userPrompt = `
${contextPrompt}

## 반기 리포트 생성 요청
- 학생명: ${input.studentName}
- 연도: ${input.year}년
- 기간: ${input.halfYear}
- 상세 기간: ${input.period}

## 반기 통계
- 총 수업: ${input.periodSummary.totalClasses}회
- 총 시간: ${input.periodSummary.totalHours}시간
- 총 시험: ${input.periodSummary.totalTests}회
- 평균 점수: ${input.periodSummary.averageScore}점
- 점수 향상: +${input.periodSummary.scoreImprovement}점

## 월별 리포트 요약
${input.monthlyReports.map(m => `
### ${m.month}월
- 성취: ${m.achievements.join(', ')}
- 도전: ${m.challenges.join(', ')}
- 모멘텀: ${m.growthMomentum}`).join('\n')}

${input.metaProfile ? `
## 현재 메타프로필
- 흡수율: ${input.metaProfile.absorptionRate.overallScore}/100
- 지구력: ${input.metaProfile.solvingStamina.overallScore}/100
- 메타인지: ${input.metaProfile.metaCognitionLevel.overallScore}/100` : ''}

## 생성 항목
1. 성장 궤적 분석 (성장 곡선 유형)
2. 메타프로필 변화 분석
3. 취약점 종합 점검
4. 강점 발전 현황
5. Macro Loop 분석
6. 학년 수준 재평가
7. 다음 반기 전략
8. 장기 비전 업데이트
9. 부모님 종합 보고

응답은 SemiAnnualReportAnalysis 스키마를 따라주세요.`;

  const semiAnnualSchema = {
    type: 'object',
    properties: {
      period: { type: 'string' },
      halfYear: { type: 'string' },
      year: { type: 'number' },
      studentName: { type: 'string' },
      periodSummary: {
        type: 'object',
        properties: {
          totalClasses: { type: 'number' },
          totalHours: { type: 'number' },
          totalTests: { type: 'number' },
          averageScore: { type: 'number' },
          scoreImprovement: { type: 'number' }
        }
      },
      growthTrajectory: {
        type: 'object',
        properties: {
          startingPoint: { type: 'object', properties: { date: { type: 'string' }, score: { type: 'number' }, level: { type: 'string' } } },
          currentPoint: { type: 'object', properties: { date: { type: 'string' }, score: { type: 'number' }, level: { type: 'string' } } },
          growthCurve: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, score: { type: 'number' }, milestone: { type: 'string' } } } },
          growthRate: { type: 'number' },
          growthType: { type: 'string' }
        }
      },
      metaProfileEvolution: {
        type: 'object',
        properties: {
          errorSignatureChange: {
            type: 'object',
            properties: {
              resolvedPatterns: { type: 'array', items: { type: 'string' } },
              persistentPatterns: { type: 'array', items: { type: 'string' } },
              newPatterns: { type: 'array', items: { type: 'string' } },
              overallTrend: { type: 'string' }
            }
          },
          absorptionRateChange: { type: 'object', properties: { previous: { type: 'number' }, current: { type: 'number' }, trend: { type: 'string' } } },
          staminaChange: { type: 'object', properties: { previous: { type: 'number' }, current: { type: 'number' }, trend: { type: 'string' } } },
          metaCognitionChange: { type: 'object', properties: { previous: { type: 'number' }, current: { type: 'number' }, trend: { type: 'string' } } }
        }
      },
      weaknessReview: {
        type: 'object',
        properties: {
          startingWeaknesses: { type: 'array', items: { type: 'string' } },
          resolved: { type: 'array', items: { type: 'string' } },
          improved: { type: 'array', items: { type: 'string' } },
          persistent: { type: 'array', items: { type: 'string' } },
          new: { type: 'array', items: { type: 'string' } },
          resolutionRate: { type: 'number' }
        }
      },
      strengthDevelopment: {
        type: 'object',
        properties: {
          consolidatedStrengths: { type: 'array', items: { type: 'string' } },
          emergingStrengths: { type: 'array', items: { type: 'string' } },
          leveragedFor: { type: 'array', items: { type: 'string' } }
        }
      },
      macroLoopAnalysis: {
        type: 'object',
        properties: {
          goalAchievementRate: { type: 'number' },
          monthlyConsistency: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, score: { type: 'number' } } } },
          learningEfficiency: { type: 'number' },
          strategicAdjustments: {
            type: 'array',
            items: { type: 'object', properties: { area: { type: 'string' }, currentApproach: { type: 'string' }, suggestedChange: { type: 'string' }, expectedImpact: { type: 'string' } } }
          }
        }
      },
      levelReassessment: {
        type: 'object',
        properties: {
          previousLevel: { type: 'string' },
          currentLevel: { type: 'string' },
          gradeGrowth: { type: 'number' },
          comparisonToStandard: { type: 'string' }
        }
      },
      nextHalfStrategy: {
        type: 'object',
        properties: {
          primaryGoals: { type: 'array', items: { type: 'string' } },
          focusDomains: { type: 'array', items: { type: 'string' } },
          targetScore: { type: 'number' },
          keyMilestones: { type: 'array', items: { type: 'object', properties: { month: { type: 'number' }, milestone: { type: 'string' } } } },
          riskMitigation: { type: 'array', items: { type: 'string' } }
        }
      },
      longTermVisionUpdate: {
        type: 'object',
        properties: {
          yearEndProjection: { type: 'string' },
          nextYearOutlook: { type: 'string' },
          potentialPaths: { type: 'array', items: { type: 'string' } }
        }
      },
      parentComprehensiveReport: {
        type: 'object',
        properties: {
          executiveSummary: { type: 'string' },
          detailedAnalysis: { type: 'string' },
          investmentReturn: { type: 'string' },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      },
      teacherAssessment: { type: 'string' }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,  // 동적 모델 선택 (Hybrid Routing)
      contents: [
        { role: 'user', parts: [{ text: SEMI_ANNUAL_REPORT_PROMPT }] },
        { role: 'model', parts: [{ text: '네, 반기 리포트를 생성합니다. Macro Loop 관점에서 6개월간의 성장 궤적을 종합 분석하겠습니다.' }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: semiAnnualSchema
      }
    });

    const text = response.text;
    if (!text) throw new GeminiApiError('Gemini API 응답이 비어있습니다.');

    return JSON.parse(text) as SemiAnnualReportAnalysis;
  } catch (error) {
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('반기 리포트 생성 중 오류가 발생했습니다.', error);
  }
}

/**
 * 연간 리포트 생성
 */
export interface AnnualReportInput {
  studentName: string;
  year: number;
  startGrade: number;
  endGrade: number;
  annualStatistics: {
    totalClasses: number;
    totalHours: number;
    totalTests: number;
    totalReports: number;
    averageScore: number;
    scoreImprovement: number;
    attendanceRate: number;
  };
  semiAnnualReports: Array<{
    halfYear: '상반기' | '하반기';
    summary: string;
    growthRate: number;
  }>;
  metaProfile?: StudentMetaProfile;
  baseline?: {
    assessmentDate: string;
    initialScores: Record<string, number>;
  };
}

export async function generateAnnualReport(
  input: AnnualReportInput,
  context?: AnalysisContextData
): Promise<AnnualReportAnalysis> {
  const ai = getGeminiClient();

  // ===== 모델 라우팅: annual = Pro 모델 (High-Stakes) =====
  const selectedModel = routeModel({ reportType: 'annual' });
  console.log('[Model Routing] annual ->', selectedModel);

  const contextPrompt = buildContextPrompt(context);

  const userPrompt = `
${contextPrompt}

## 연간 리포트 생성 요청
- 학생명: ${input.studentName}
- 연도: ${input.year}년
- 학년 변화: ${input.startGrade}학년 → ${input.endGrade}학년

## 연간 통계
- 총 수업: ${input.annualStatistics.totalClasses}회
- 총 시간: ${input.annualStatistics.totalHours}시간
- 총 시험: ${input.annualStatistics.totalTests}회
- 총 리포트: ${input.annualStatistics.totalReports}개
- 평균 점수: ${input.annualStatistics.averageScore}점
- 점수 향상: +${input.annualStatistics.scoreImprovement}점
- 출석률: ${input.annualStatistics.attendanceRate}%

## 반기 리포트 요약
${input.semiAnnualReports.map(s => `
### ${s.halfYear}
- 요약: ${s.summary}
- 성장률: ${s.growthRate}%`).join('\n')}

${input.baseline ? `
## Baseline 데이터 (${input.baseline.assessmentDate})
${Object.entries(input.baseline.initialScores).map(([domain, score]) => `- ${domain}: ${score}점`).join('\n')}` : ''}

${input.metaProfile ? `
## 현재 메타프로필
- 흡수율: ${input.metaProfile.absorptionRate.overallScore}/100
- 지구력: ${input.metaProfile.solvingStamina.overallScore}/100
- 메타인지: ${input.metaProfile.metaCognitionLevel.overallScore}/100` : ''}

## 생성 항목
1. 연간 성장 스토리
2. Baseline 대비 성장 분석
3. 메타프로필 연간 진화
4. 취약점 최종 점검
5. 강점 발전 종합
6. 학년 성취도
7. Macro Loop 연간 종합
8. 다음 학년 준비
9. 장기 학습 경로
10. 성장 스토리 서사
11. 부모님 연간 보고
12. 선생님 연간 평가

응답은 AnnualReportAnalysis 스키마를 따라주세요.`;

  const annualSchema = {
    type: 'object',
    properties: {
      year: { type: 'number' },
      studentName: { type: 'string' },
      startGrade: { type: 'number' },
      endGrade: { type: 'number' },
      annualStatistics: {
        type: 'object',
        properties: {
          totalClasses: { type: 'number' },
          totalHours: { type: 'number' },
          totalTests: { type: 'number' },
          totalReports: { type: 'number' },
          averageScore: { type: 'number' },
          scoreImprovement: { type: 'number' },
          attendanceRate: { type: 'number' }
        }
      },
      growthStory: {
        type: 'object',
        properties: {
          beginningState: { type: 'object', properties: { date: { type: 'string' }, description: { type: 'string' } } },
          majorMilestones: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, milestone: { type: 'string' }, significance: { type: 'string' } } } },
          turningPoints: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, event: { type: 'string' }, impact: { type: 'string' } } } },
          endingState: { type: 'object', properties: { date: { type: 'string' }, description: { type: 'string' } } },
          narrativeSummary: { type: 'string' }
        }
      },
      baselineComparison: {
        type: 'object',
        properties: {
          currentMetrics: { type: 'array', items: { type: 'object', properties: { domain: { type: 'string' }, initial: { type: 'number' }, current: { type: 'number' }, growth: { type: 'number' }, growthRate: { type: 'number' } } } },
          overallGrowthRate: { type: 'number' },
          growthCategory: { type: 'string' }
        }
      },
      metaProfileAnnualEvolution: {
        type: 'object',
        properties: {
          errorSignature: { type: 'object', properties: { improvements: { type: 'array', items: { type: 'string' } }, persistentIssues: { type: 'array', items: { type: 'string' } } } },
          absorptionRate: { type: 'object', properties: { trend: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, score: { type: 'number' } } } }, improvement: { type: 'number' }, assessment: { type: 'string' } } },
          solvingStamina: { type: 'object', properties: { improvement: { type: 'number' }, assessment: { type: 'string' } } },
          metaCognition: { type: 'object', properties: { improvement: { type: 'number' }, assessment: { type: 'string' } } }
        }
      },
      weaknessFinalReview: {
        type: 'object',
        properties: {
          totalIdentified: { type: 'number' },
          resolved: { type: 'array', items: { type: 'string' } },
          persistent: { type: 'array', items: { type: 'string' } },
          resolutionRate: { type: 'number' }
        }
      },
      strengthFinalReview: {
        type: 'object',
        properties: {
          coreStrengths: { type: 'array', items: { type: 'string' } },
          developedStrengths: { type: 'array', items: { type: 'string' } }
        }
      },
      gradeAchievement: {
        type: 'object',
        properties: {
          startLevel: { type: 'string' },
          endLevel: { type: 'string' },
          gradeImprovement: { type: 'number' },
          assessment: { type: 'string' }
        }
      },
      annualMacroLoopSummary: {
        type: 'object',
        properties: {
          goalAchievementRate: { type: 'number' },
          learningEfficiency: { type: 'number' },
          keyAccomplishments: { type: 'array', items: { type: 'string' } }
        }
      },
      nextYearPreparation: {
        type: 'object',
        properties: {
          primaryObjectives: { type: 'array', items: { type: 'string' } },
          prerequisiteGaps: { type: 'array', items: { type: 'string' } },
          recommendedApproach: { type: 'string' }
        }
      },
      longTermPath: {
        type: 'object',
        properties: {
          threeYearVision: { type: 'string' },
          potentialTrajectories: { type: 'array', items: { type: 'string' } }
        }
      },
      growthNarrativeFinal: {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          story: { type: 'string' },
          keyTheme: { type: 'string' }
        }
      },
      parentAnnualReport: {
        type: 'object',
        properties: {
          executiveSummary: { type: 'string' },
          highlights: { type: 'array', items: { type: 'string' } },
          areasOfGrowth: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } }
        }
      },
      teacherAnnualAssessment: {
        type: 'object',
        properties: {
          overallEvaluation: { type: 'string' },
          characterGrowth: { type: 'string' },
          academicGrowth: { type: 'string' }
        }
      }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,  // 동적 모델 선택 (Hybrid Routing)
      contents: [
        { role: 'user', parts: [{ text: ANNUAL_REPORT_PROMPT }] },
        { role: 'model', parts: [{ text: '네, 연간 리포트를 생성합니다. 1년간의 성장 스토리를 완성하고 다음 학년을 위한 준비 상태를 종합 평가하겠습니다.' }] },
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: annualSchema
      }
    });

    const text = response.text;
    if (!text) throw new GeminiApiError('Gemini API 응답이 비어있습니다.');

    return JSON.parse(text) as AnnualReportAnalysis;
  } catch (error) {
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('연간 리포트 생성 중 오류가 발생했습니다.', error);
  }
}

// ============================================
// 메타프로필 업데이트 함수
// ============================================

/**
 * 시험 분석 결과를 기반으로 메타프로필 업데이트 제안 생성
 * 메타프로필 업데이트는 리포트 타입에 따라 모델 선택
 */
export async function generateMetaProfileUpdate(
  currentProfile: StudentMetaProfile | null,
  analysisData: AnalysisData,
  reportType: ReportType
): Promise<Partial<StudentMetaProfile>> {
  const ai = getGeminiClient();

  // ===== 모델 라우팅: 리포트 타입에 따라 모델 선택 =====
  const selectedModel = routeModel({ reportType });
  console.log('[Model Routing] metaProfileUpdate ->', selectedModel);

  const userPrompt = `
## 메타프로필 업데이트 요청
현재 분석 데이터를 기반으로 학생의 메타프로필 업데이트를 제안하세요.

### 현재 메타프로필
${currentProfile ? JSON.stringify(currentProfile, null, 2) : '없음 (첫 번째 분석)'}

### 새로운 분석 데이터 (${reportType})
${JSON.stringify(analysisData, null, 2)}

### 업데이트 지침
1. 오류 서명 (ErrorSignature): 새로운 오류 패턴 추가 또는 기존 패턴 빈도 조정
2. 흡수율 (AbsorptionRate): 새 개념 학습 성과 반영
3. 지구력 (SolvingStamina): 문제 순서별 정답률 분석
4. 메타인지 (MetaCognitionLevel): 자기 인식 지표 업데이트
5. Baseline은 level_test에서만 설정, 이후 변경 불가

변경이 필요한 지표만 포함하여 응답하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,  // 동적 모델 선택 (Hybrid Routing)
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return {};

    return JSON.parse(text) as Partial<StudentMetaProfile>;
  } catch {
    // 메타프로필 업데이트 실패 시 빈 객체 반환 (치명적 오류 아님)
    console.error('메타프로필 업데이트 생성 실패');
    return {};
  }
}

// ============================================
// Self-Analysis (학생/학부모 자기 분석)
// ============================================

const SELF_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    analysisDate: { type: 'string' },
    problemType: { type: 'string' },
    topicTags: { type: 'array', items: { type: 'string' } },
    uploadedBy: { type: 'string' },
    overallAssessment: { type: 'string' },
    oneLineSummary: { type: 'string' },
    strengthsObserved: { type: 'array', items: { type: 'string' } },
    areasToImprove: { type: 'array', items: { type: 'string' } },
    comparisonWithHistory: {
      type: 'object',
      properties: {
        improvements: { type: 'array', items: { type: 'string' } },
        persistentIssues: { type: 'array', items: { type: 'string' } },
        newObservations: { type: 'array', items: { type: 'string' } },
        overallTrend: { type: 'string', enum: ['improving', 'stable', 'needs_attention'] },
        trendSummary: { type: 'string' },
      },
    },
    problemFeedback: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          problemIdentifier: { type: 'string' },
          observation: { type: 'string' },
          whatWentWell: { type: 'string' },
          suggestion: { type: 'string' },
          errorType: { type: 'string' },
        },
      },
    },
    nextSteps: {
      type: 'object',
      properties: {
        immediate: { type: 'array', items: { type: 'string' } },
        thisWeek: { type: 'array', items: { type: 'string' } },
        studyTip: { type: 'string' },
      },
    },
    encouragement: { type: 'string' },
    milestone: { type: 'string' },
  },
  required: [
    'analysisDate', 'problemType', 'topicTags', 'uploadedBy',
    'overallAssessment', 'oneLineSummary', 'strengthsObserved',
    'areasToImprove', 'comparisonWithHistory', 'problemFeedback',
    'nextSteps', 'encouragement',
  ],
};

/**
 * 학생/학부모 자기 분석 - 문제풀이 스캔본 분석
 * @param studentName 학생 이름
 * @param images 문제풀이 스캔 이미지 (base64)
 * @param problemType 문제 유형
 * @param topicTags 주제 태그
 * @param studentNote 학생 메모
 * @param uploadedBy 업로드 주체
 * @param context 누적 학습 컨텍스트
 */
export async function analyzeSelfStudy(
  studentName: string,
  images: string[],
  problemType: SelfAnalysisProblemType,
  topicTags: string[],
  studentNote: string | undefined,
  uploadedBy: 'student' | 'parent',
  context?: AnalysisContextData
): Promise<SelfAnalysisReport> {
  const ai = getGeminiClient();
  const today = new Date().toISOString().split('T')[0];

  const contextPrompt = buildContextPrompt(context);

  const systemPrompt = `당신은 학생의 수학 학습을 따뜻하게 지원하는 AI 학습 코치입니다.
학생이나 학부모가 직접 업로드한 문제풀이 스캔본을 분석하여,
학생이 자신의 성장을 느끼고 다음 단계로 나아갈 수 있도록 격려하는 피드백을 제공합니다.

## 핵심 원칙
1. **격려 우선**: 잘한 점을 먼저, 구체적으로 칭찬할 것
2. **성장 관점**: 틀린 것이 아니라 "아직 배우는 중"으로 표현
3. **실용적 피드백**: 당장 실천 가능한 구체적 다음 단계 제시
4. **개인화**: 누적 학습 데이터를 활용하여 "저번보다", "이번엔" 같은 개인화된 표현 사용
5. **부모 친화적**: 학부모가 읽어도 이해할 수 있는 평이한 언어

## 분석 관점 (5가지)
1️⃣ 풀이 접근 방식: 문제를 어떤 방식으로 시도했는가?
2️⃣ 개념 이해도: 핵심 개념을 얼마나 이해하고 있는가?
3️⃣ 오류 패턴: 반복되는 실수나 오해가 있는가?
4️⃣ 풀이 습관: 과정을 체계적으로 기록하고 있는가?
5️⃣ 성장 신호: 이전 분석 대비 나아진 점은 무엇인가?

## 비교 분석 (누적 데이터 활용)
- 이전에 있던 문제가 해결되었으면 반드시 언급
- 새로운 성장 신호가 보이면 구체적으로 칭찬
- 여전히 지속되는 문제는 개선 방향과 함께 부드럽게 언급`;

  const userPrompt = `${contextPrompt}

## 자기 분석 요청 정보
- 학생 이름: ${studentName}
- 분석 날짜: ${today}
- 문제 유형: ${problemType}
- 학습 주제: ${topicTags.length > 0 ? topicTags.join(', ') : '지정 없음'}
- 업로드 주체: ${uploadedBy === 'student' ? '학생 본인' : '학부모'}
${studentNote ? `- 학생/학부모 메모: "${studentNote}"` : ''}

위 문제풀이 스캔 이미지를 분석하여 ${studentName} 학생을 위한 개인화된 학습 피드백을 제공해주세요.
학생이 자신의 성장을 체감하고 동기부여를 받을 수 있도록 따뜻하고 구체적인 피드백을 작성해주세요.

출력 형식: JSON (SELF_ANALYSIS_SCHEMA 구조)
- analysisDate: "${today}"
- problemType: "${problemType}"
- topicTags: ${JSON.stringify(topicTags)}
- uploadedBy: "${uploadedBy}"
- 나머지 필드: 분석 결과에 따라 작성`;

  const imageParts = images.map((img) => ({
    inlineData: {
      data: img,
      mimeType: 'image/jpeg' as const,
    },
  }));

  const routingCtx: ModelRoutingContext = {
    reportType: 'self_analysis',
  };
  const selectedModel = routeModel(routingCtx);
  createRoutingLog(routingCtx);

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt + '\n\n' + userPrompt },
            ...imageParts,
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: SELF_ANALYSIS_SCHEMA,
      },
    });

    const text = response.text;
    if (!text) throw new GeminiApiError('AI 응답이 비어있습니다.');

    const result = cleanAndParseJSON<SelfAnalysisReport>(text);
    return {
      ...result,
      analysisDate: today,
      problemType,
      topicTags,
      uploadedBy,
    };
  } catch (error) {
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('자기 분석 중 오류가 발생했습니다.', error);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Helper function to extract and parse JSON from AI response.
 * Handles Markdown code blocks and provides better error logging for truncated responses.
 */
function cleanAndParseJSON<T>(text: string): T {
  // 1. Remove Markdown code blocks (```json ... ```)
  let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '');

  // 2. Trim whitespace
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText) as T;
  } catch (error) {
    // Log detailed info for debugging truncation issues
    console.error('[Gemini Parse Error] Failed to parse JSON.');
    console.error('[Gemini Parse Error] Text length:', cleanText.length);
    console.error('[Gemini Parse Error] Last 100 chars:', cleanText.slice(-100));
    throw new GeminiParseError(
      `JSON 파싱 실패 (응답 길이: ${cleanText.length}자). 응답이 잘렸을 수 있습니다.`,
      cleanText
    );
  }
}

// ============================================
// Phase 3: 레거시 데이터 마이그레이션 (Batch Ingestion)
// ============================================

export interface LegacyDataIngestionResult {
  extractedSignals: {
    id: string;
    date: string;
    sourceType: string;
    affectedPillars: ('ErrorSignature' | 'AbsorptionRate' | 'SolvingStamina' | 'MetaCognition')[];
    insight: string;
    relatedConcepts: string[];
    confidenceScore: number;
  }[];
  updatedMetaProfile: Partial<StudentMetaProfile>;
}

/**
 * 과거 데이터(Legacy Data)를 분석하여 메타프로필을 업데이트하는 마이그레이션 함수
 * @param studentName 학생 이름
 * @param currentProfile 현재 메타프로필 상태
 * @param images 과거 데이터 스캔본 (시험지, 교사 리포트, 퀴즈, 스프레드시트 캡처 등)
 * @param documentDate 과거 데이터의 기준 날짜 (예: "2023-03-15")
 * @param documentType 데이터 유형 태그 (예: "시험지", "월간리포트", "스프레드시트")
 */
export async function ingestLegacyData(
  studentName: string,
  currentProfile: StudentMetaProfile | null,
  images: string[],
  documentDate: string,
  documentType: string
): Promise<LegacyDataIngestionResult> {
  const ai = getGeminiClient();

  // 강제로 가장 강력한 모델(Pro) 라우팅
  const routingCtx: ModelRoutingContext = {
    reportType: 'annual', // Pro 모델을 사용하기 위한 우회 (isHighStakes: true)
    isHighStakes: true,
  };
  const selectedModel = routeModel(routingCtx);
  createRoutingLog(routingCtx);

  const systemPrompt = `당신은 학생의 과거 학습 데이터를 심층 분석하여 성장 궤적(Meta-Profile)을 정밀하게 복원하는 최고 수준의 AI 데이터 엔지니어입니다.
단순히 "연산 실수가 잦음" 수준의 1차원적인 텍스트 요약이 아니라, **학생 메타프로필의 5대 축(ErrorSignature, AbsorptionRate, SolvingStamina, MetaCognition) 각각에 직접적으로 영향을 줄 수 있는 고밀도(High-fidelity) 인사이트를 구조화**하여 추출해야 합니다.

## 분석 소스 및 심층 파악 포인트
- 시험지/퀴즈: 
  - [ErrorSignature] 단순 계산 실수인지, 개념적 오개념인지, 문제 독해(문해력) 부족인지 파악.
  - [AbsorptionRate] 특정 단원의 성취도를 통해 흡수율(개념 소화 속도) 파악.
- 교사 리포트/스프레드시트: 
  - [SolvingStamina] 문제 풀이 시 집중력 저하 시점, 포기 패턴 등의 지구력 지표.
  - [MetaCognition] 검토(Re-check) 여부, 오답 노트 작성 유무, 자기 확신도 등.

## 핵심 시그널(LegacySignals) 구조화 지침
과거 자료(${documentDate})에서 식별된 중요한 발견을 다음 JSON 구조의 배열로 도출하세요:
- insight: "단순 텍스트"가 아닌, 메타프로필을 변화시킬 만한 명확한 근거와 상태 설명. (예: "다항식의 곱셈에서 분배법칙 적용 시 부호 오류가 3회 이상 반복됨. 개념 이해보다는 절차적 숙련도 부족으로 판단됨.")
- affectedPillars: 이 인사이트가 영향을 미치는 5대 축 배열 (예: ["ErrorSignature", "AbsorptionRate"])
- relatedConcepts: 관련된 수학 개념/단원 태그 (예: ["다항식의 곱셈", "부호 연산"])
- confidenceScore: 이 분석에 대한 확신도 (1-100)

## 메타프로필 누적 업데이트(Incremental Update)
현재 메타프로필(JSON)을 바탕으로, 방금 추출한 시그널들이 현재의 스코어(overallScore)나 패턴(signaturePatterns, conceptGraveyard)을 어떻게 변화시켜야 하는지 판단하고, 변경된 필드만 반환하세요.
(예: 새로운 오개념이 발견되었다면 errorSignature.signaturePatterns 배열에 추가, 집중력 부족이 뚜렷하다면 solvingStamina.overallScore 삭감 등)`;

  const userPrompt = `
## 과거 데이터 정보
- 학생 이름: ${studentName}
- 데이터 날짜: ${documentDate}
- 데이터 소스: ${documentType}

## 현재 메타프로필 (이 데이터를 바탕으로 업데이트 진행)
${currentProfile ? JSON.stringify(currentProfile, null, 2) : '현재 등록된 메타프로필이 없습니다. (초기 구축 단계)'}

첨부된 이미지(과거 데이터)를 분석하여 고품질의 구조화된 시그널 배열을 추출하고, 메타프로필 업데이트 JSON을 반환하세요. ID는 랜덤한 UUID로 생성하세요.

응답 형식 (JSON):
{
  "extractedSignals": [
    {
      "id": "uuid-v4-string",
      "date": "${documentDate}",
      "sourceType": "${documentType}",
      "affectedPillars": ["ErrorSignature"],
      "insight": "심층 분석 내용",
      "relatedConcepts": ["개념1"],
      "confidenceScore": 90
    }
  ],
  "updatedMetaProfile": {
    "errorSignature": { ... },
    "absorptionRate": { ... },
    "solvingStamina": { ... },
    "metaCognitionLevel": { ... }
  }
}
`;

  const imageParts = images.map((img) => ({
    inlineData: {
      data: img,
      mimeType: 'image/jpeg' as const, // PDF는 클라이언트에서 이미지로 변환되어 전달됨
    },
  }));

  try {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt + '\n\n' + userPrompt },
            ...imageParts,
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) throw new GeminiApiError('AI 응답이 비어있습니다.');

    const result = cleanAndParseJSON<LegacyDataIngestionResult>(text);
    return result;
  } catch (error) {
    if (error instanceof GeminiApiError || error instanceof GeminiParseError) throw error;
    throw new GeminiApiError('레거시 데이터 잉제스천 중 오류가 발생했습니다.', error);
  }
}

