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
} from '@/types';

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

### 개선 전략 5요소 (모든 전략에 필수 포함)
- 무엇을: 구체적 교재, 자료
- 어디서: 페이지, 챕터
- 얼마나: 횟수, 시간
- 어떻게: 구체적 방법
- 측정 방법: 성과 확인 기준`;

const WEEKLY_REPORT_PROMPT = `${BASE_SYSTEM_PROMPT}

## 주간 리포트 특별 지침 (Micro Loop - Weekly)
주간 리포트는 빠른 피드백 사이클의 핵심입니다. 지난주 목표와 이번 주 성과를 연결하세요.

### 필수 분석 항목
1. **수업 내용 평가**: 이번 주 다룬 개념들의 이해도
2. **숙제 수행 분석**: 완료율, 질적 평가
3. **주간 성취**: 이번 주의 구체적 성과
4. **개선 필요 영역**: 다음 주 집중해야 할 부분
5. **복습 과제**: 구체적인 복습 문제 지정

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
};

// ============================================
// 컨텍스트 데이터 생성 함수
// ============================================

/**
 * 컨텍스트 데이터를 프롬프트 텍스트로 변환
 */
function buildContextPrompt(context?: AnalysisContextData): string {
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
      : '- 데이터 부족'}`);
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

## 개선 전략 5요소 (모든 전략에 필수 포함)
- 무엇을: 구체적 교재, 자료
- 어디서: 페이지, 챕터
- 얼마나: 횟수, 시간
- 어떻게: 구체적 방법
- 측정 방법: 성과 확인 기준`;

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
    trendComment: { type: 'string' }
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
 */
export async function analyzeTestPaperWithContext(
  studentName: string,
  formData: TestAnalysisFormData,
  currentImages: string[],
  pastImages: string[] = [],
  reportType: ReportType = 'test',
  context?: AnalysisContextData
): Promise<AnalysisData> {
  const ai = getGeminiClient();

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

## 분석 요청
첨부된 시험지 이미지를 분석하여 다음을 수행하세요:
1. 문항별 채점 및 총점 계산
2. 5가지 관점 심층 분석
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

응답은 반드시 지정된 JSON 스키마를 따라주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
 */
export async function analyzeLevelTest(
  studentName: string,
  grade: number,
  testImages: string[],
  additionalInfo?: {
    school?: string;
    previousExperience?: string;
    parentExpectations?: string;
  }
): Promise<LevelTestAnalysis> {
  const ai = getGeminiClient();

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

응답은 LevelTestAnalysis 스키마를 따라주세요.`;

  const levelTestSchema = {
    type: 'object',
    properties: {
      testInfo: { type: 'object' },
      testResults: { type: 'object' },
      domainDiagnosis: { type: 'array' },
      gradeLevelAssessment: { type: 'object' },
      prerequisiteGaps: { type: 'array' },
      learningStyleDiagnosis: { type: 'object' },
      initialBaseline: { type: 'object' },
      suggestedCurriculum: { type: 'array' },
      parentBriefing: { type: 'string' }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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

    const text = response.text;
    if (!text) throw new GeminiApiError('Gemini API 응답이 비어있습니다.');

    return JSON.parse(text) as LevelTestAnalysis;
  } catch (error) {
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
}

export async function generateWeeklyReport(
  input: WeeklyReportInput,
  context?: AnalysisContextData
): Promise<WeeklyReportAnalysis> {
  const ai = getGeminiClient();

  const contextPrompt = buildContextPrompt(context);

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

## 생성 항목
1. 학습 내용 평가
2. 주간 성취 정리
3. 개선 필요 영역
4. 복습 과제 지정
5. Micro Loop 피드백 (지난주 목표 점검, 연속성 점수)
6. 다음 주 계획
7. 격려 메시지

응답은 WeeklyReportAnalysis 스키마를 따라주세요.`;

  const weeklySchema = {
    type: 'object',
    properties: {
      period: { type: 'string' },
      weekNumber: { type: 'number' },
      studentName: { type: 'string' },
      studentGrade: { type: 'string' },
      classSessions: { type: 'array' },
      learningContent: { type: 'array' },
      assignmentCompletion: { type: 'object' },
      weeklyAchievements: { type: 'array', items: { type: 'string' } },
      areasForImprovement: { type: 'array', items: { type: 'string' } },
      reviewAssignments: { type: 'array' },
      nextWeekPlan: { type: 'object' },
      microLoopFeedback: { type: 'object' },
      encouragement: { type: 'string' },
      teacherComment: { type: 'string' }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: WEEKLY_REPORT_PROMPT }] },
        { role: 'model', parts: [{ text: '네, 주간 리포트를 생성합니다. Micro Loop 관점에서 지난주와의 연속성을 유지하며 분석하겠습니다.' }] },
        { role: 'user', parts: [{ text: userPrompt }] }
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

## 생성 항목
1. 커리큘럼 진도 평가
2. 학습 내용 종합 (우수/양호/도전 분류)
3. 월간 성취 정리
4. 해결된 취약점
5. 새로운 도전
6. Micro Loop 월간 점검
7. 부모님 보고 섹션
8. 다음 달 계획
9. 단기 비전

응답은 MonthlyReportAnalysis 스키마를 따라주세요.`;

  const monthlySchema = {
    type: 'object',
    properties: {
      period: { type: 'string' },
      month: { type: 'object' },
      studentName: { type: 'string' },
      classSessionsSummary: { type: 'object' },
      curriculumProgress: { type: 'object' },
      learningContentSummary: { type: 'object' },
      testPerformance: { type: 'object' },
      assignmentSummary: { type: 'object' },
      monthlyAchievements: { type: 'array', items: { type: 'string' } },
      resolvedWeaknesses: { type: 'array', items: { type: 'string' } },
      newChallenges: { type: 'array', items: { type: 'string' } },
      parentReport: { type: 'object' },
      microLoopMonthlyReview: { type: 'object' },
      nextMonthPlan: { type: 'object' },
      shortTermVision: { type: 'object' },
      teacherMessage: { type: 'string' }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
      periodSummary: { type: 'object' },
      growthTrajectory: { type: 'object' },
      metaProfileEvolution: { type: 'object' },
      weaknessReview: { type: 'object' },
      strengthDevelopment: { type: 'object' },
      macroLoopAnalysis: { type: 'object' },
      levelReassessment: { type: 'object' },
      nextHalfStrategy: { type: 'object' },
      longTermVisionUpdate: { type: 'object' },
      parentComprehensiveReport: { type: 'object' },
      teacherAssessment: { type: 'string' }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
      annualStatistics: { type: 'object' },
      growthStory: { type: 'object' },
      baselineComparison: { type: 'object' },
      metaProfileAnnualEvolution: { type: 'object' },
      weaknessFinalReview: { type: 'object' },
      strengthFinalReview: { type: 'object' },
      gradeAchievement: { type: 'object' },
      annualMacroLoopSummary: { type: 'object' },
      nextYearPreparation: { type: 'object' },
      longTermPath: { type: 'object' },
      growthNarrativeFinal: { type: 'object' },
      parentAnnualReport: { type: 'object' },
      teacherAnnualAssessment: { type: 'object' }
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
 */
export async function generateMetaProfileUpdate(
  currentProfile: StudentMetaProfile | null,
  analysisData: AnalysisData,
  reportType: ReportType
): Promise<Partial<StudentMetaProfile>> {
  const ai = getGeminiClient();

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
      model: 'gemini-2.5-flash',
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
