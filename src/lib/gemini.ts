import { GoogleGenAI } from '@google/genai';
import type { AnalysisData, TestAnalysisFormData } from '@/types';

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

export async function analyzeTestPaper(
  studentName: string,
  formData: TestAnalysisFormData,
  currentImages: string[],
  pastImages: string[] = []
): Promise<AnalysisData> {
  const ai = getGeminiClient();

  const imageParts = currentImages.map(base64 => ({
    inlineData: { data: base64, mimeType: 'image/jpeg' }
  }));

  const pastImageParts = pastImages.map(base64 => ({
    inlineData: { data: base64, mimeType: 'image/jpeg' }
  }));

  const userPrompt = `
## 분석 대상
- 학생명: ${studentName}
- 시험명: ${formData.testName}
- 시험일: ${formData.testDate}
- 시험 범위: ${formData.testRange}
- 총 문항 수: ${formData.totalQuestions}
- 총점: ${formData.maxScore}

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

${pastImageParts.length > 0 ? '과거 시험지도 함께 분석하여 성장 추이를 파악하세요.' : ''}

응답은 반드시 지정된 JSON 스키마를 따라주세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: '네, 이해했습니다. 5가지 관점의 심층 분석과 5요소 개선 전략을 포함하여 분석하겠습니다.' }] },
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
