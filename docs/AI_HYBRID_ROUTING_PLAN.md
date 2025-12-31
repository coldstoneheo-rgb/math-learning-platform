# AI 모델 이원화(Hybrid Routing) 적용 계획서

## 1. 개요

### 1.1 배경
현재 플랫폼은 모든 AI 분석에 단일 모델(`gemini-2.5-flash`)을 사용하고 있습니다.
상용화 시 비용 최적화와 분석 품질 균형을 위해 **리포트 중요도에 따른 모델 이원화**가 필요합니다.

### 1.2 핵심 원칙
- **"Generate Once, Read Forever"**: 생성 시에만 비용 발생, 조회는 DB에서 무료
- **중요도 기반 라우팅**: High-Stakes 리포트에는 Pro 모델, 정기 리포트에는 Flash 모델

### 1.3 모델 이원화 정책

| 리포트 유형 | 모델 티어 | 사용 모델 | 비용 수준 | 이유 |
|------------|----------|----------|----------|------|
| `level_test` | Pro | gemini-2.5-pro | 높음 | Baseline 설정, 최초 진단 - 정확도 최우선 |
| `semi_annual` | Pro | gemini-2.5-pro | 높음 | 6개월 종합 분석, 장기 전략 수립 |
| `annual` | Pro | gemini-2.5-pro | 높음 | 연간 성장 스토리, 중요한 의사결정 지원 |
| `test` | Adaptive | Pro/Flash | 가변 | 학년/시험 중요도에 따라 분기 |
| `weekly` | Flash | gemini-2.5-flash | 낮음 | 빈번한 생성, 속도 중요 |
| `monthly` | Flash | gemini-2.5-flash | 낮음 | 정기 리포트, 비용 효율 |

---

## 2. 환경변수 설정 가이드

### 2.1 `.env.local` 변경

```bash
# ============================================
# Gemini API 설정 (Hybrid Routing)
# ============================================

# API 키 (필수)
GEMINI_API_KEY=your_gemini_api_key

# 모델 설정 (선택 - 기본값 있음)
# Pro 모델: 고품질 분석 (level_test, semi_annual, annual)
GEMINI_MODEL_PRO=gemini-2.5-pro

# Flash 모델: 빠른 응답 (weekly, monthly)
GEMINI_MODEL_FLASH=gemini-2.5-flash

# ============================================
# 라우팅 정책 (선택)
# ============================================

# 시험 분석(test) 기본 모델 (pro | flash)
GEMINI_TEST_DEFAULT_MODEL=flash

# Pro 모델 사용 학년 임계값 (이 학년 이상이면 Pro 사용)
GEMINI_PRO_GRADE_THRESHOLD=10

# Pro 모델 강제 사용 시험 타입 (콤마 구분)
# 예: 모의고사,수능,기말고사
GEMINI_PRO_TEST_TYPES=모의고사,수능,기말고사,중간고사
```

### 2.2 환경변수 설명

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `GEMINI_API_KEY` | (필수) | Google AI Studio API 키 |
| `GEMINI_MODEL_PRO` | `gemini-2.5-pro` | High-Stakes 리포트용 모델 |
| `GEMINI_MODEL_FLASH` | `gemini-2.5-flash` | 정기 리포트용 모델 |
| `GEMINI_TEST_DEFAULT_MODEL` | `flash` | test 타입 기본 모델 |
| `GEMINI_PRO_GRADE_THRESHOLD` | `10` | Pro 사용 학년 임계값 (10=고1) |
| `GEMINI_PRO_TEST_TYPES` | (설정 시) | Pro 강제 사용 시험 유형 |

---

## 3. 기술 구현

### 3.1 모델 라우팅 설정 (`src/lib/model-router.ts`)

새로운 파일을 생성하여 모델 라우팅 로직을 중앙화합니다.

```typescript
// src/lib/model-router.ts

import type { ReportType } from '@/types';

/**
 * 모델 티어 정의
 */
export type ModelTier = 'pro' | 'flash';

/**
 * 모델 라우팅 결정에 필요한 컨텍스트
 */
export interface ModelRoutingContext {
  reportType: ReportType;
  studentGrade?: number;        // 학년 (1-12)
  testName?: string;            // 시험명 (Pro 키워드 매칭용)
  isHighStakes?: boolean;       // 명시적 High-Stakes 플래그
  forceModel?: ModelTier;       // 강제 모델 지정
}

/**
 * 환경변수에서 모델 설정 로드
 */
function getModelConfig() {
  return {
    proModel: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro',
    flashModel: process.env.GEMINI_MODEL_FLASH || 'gemini-2.5-flash',
    testDefaultModel: (process.env.GEMINI_TEST_DEFAULT_MODEL || 'flash') as ModelTier,
    proGradeThreshold: parseInt(process.env.GEMINI_PRO_GRADE_THRESHOLD || '10'),
    proTestTypes: (process.env.GEMINI_PRO_TEST_TYPES || '').split(',').filter(Boolean),
  };
}

/**
 * High-Stakes 리포트인지 판단
 */
function isHighStakesReport(reportType: ReportType): boolean {
  const highStakesTypes: ReportType[] = ['level_test', 'semi_annual', 'annual'];
  return highStakesTypes.includes(reportType);
}

/**
 * 시험 분석의 경우 추가 조건 확인
 */
function shouldUseProForTest(context: ModelRoutingContext): boolean {
  const config = getModelConfig();

  // 1. 강제 High-Stakes 플래그
  if (context.isHighStakes) return true;

  // 2. 학년 임계값 체크 (고등학생 이상)
  if (context.studentGrade && context.studentGrade >= config.proGradeThreshold) {
    return true;
  }

  // 3. 시험명에 Pro 키워드 포함 여부
  if (context.testName && config.proTestTypes.length > 0) {
    const testNameLower = context.testName.toLowerCase();
    return config.proTestTypes.some(type =>
      testNameLower.includes(type.toLowerCase())
    );
  }

  return false;
}

/**
 * 모델 라우팅 결정
 * @returns 사용할 Gemini 모델 ID
 */
export function routeModel(context: ModelRoutingContext): string {
  const config = getModelConfig();

  // 강제 모델 지정 시
  if (context.forceModel) {
    return context.forceModel === 'pro' ? config.proModel : config.flashModel;
  }

  // High-Stakes 리포트 (level_test, semi_annual, annual)
  if (isHighStakesReport(context.reportType)) {
    return config.proModel;
  }

  // 시험 분석 (test) - 조건부 라우팅
  if (context.reportType === 'test') {
    if (shouldUseProForTest(context)) {
      return config.proModel;
    }
    return config.testDefaultModel === 'pro' ? config.proModel : config.flashModel;
  }

  // 정기 리포트 (weekly, monthly, consolidated)
  return config.flashModel;
}

/**
 * 모델 티어 확인 (로깅/분석용)
 */
export function getModelTier(context: ModelRoutingContext): ModelTier {
  const model = routeModel(context);
  const config = getModelConfig();
  return model === config.proModel ? 'pro' : 'flash';
}

/**
 * 현재 모델 설정 정보 반환 (디버깅용)
 */
export function getModelConfigInfo() {
  const config = getModelConfig();
  return {
    proModel: config.proModel,
    flashModel: config.flashModel,
    testDefaultModel: config.testDefaultModel,
    proGradeThreshold: config.proGradeThreshold,
    proTestTypes: config.proTestTypes,
  };
}
```

### 3.2 `gemini.ts` 수정 사항

기존 하드코딩된 모델명을 라우팅 함수로 교체합니다.

```typescript
// src/lib/gemini.ts 수정 부분

import { routeModel, type ModelRoutingContext } from './model-router';

// ============================================
// analyzeTestPaperWithContext 함수 수정
// ============================================

export async function analyzeTestPaperWithContext(
  studentName: string,
  formData: TestAnalysisFormData,
  currentImages: string[],
  pastImages: string[] = [],
  reportType: ReportType = 'test',
  context?: AnalysisContextData,
  studentGrade?: number  // 새 파라미터 추가
): Promise<AnalysisData> {
  const ai = getGeminiClient();

  // 모델 라우팅
  const routingContext: ModelRoutingContext = {
    reportType,
    studentGrade,
    testName: formData.testName,
  };
  const modelName = routeModel(routingContext);

  // ... (기존 로직)

  try {
    const response = await ai.models.generateContent({
      model: modelName,  // 동적 모델 선택
      contents: [/* ... */],
      config: {/* ... */}
    });
    // ...
  }
}
```

---

## 4. 예상 효과

### 4.1 비용 절감 효과

| 시나리오 | 기존 (단일 모델) | 이원화 적용 후 | 절감률 |
|---------|-----------------|---------------|--------|
| 월 50개 리포트 | 50 × Flash 비용 | 5 Pro + 45 Flash | - |
| 월 100개 리포트 | 100 × Flash 비용 | 10 Pro + 90 Flash | - |

> **참고**: Gemini Pro는 Flash 대비 약 10-20배 비용이지만, 사용 빈도가 낮아 전체 비용 영향 제한적

### 4.2 품질 향상 효과

| 리포트 유형 | 기존 품질 | 이원화 후 | 개선 내용 |
|------------|----------|----------|----------|
| `level_test` | 중간 | 높음 | 정확한 Baseline 설정, 깊이 있는 초기 진단 |
| `semi_annual` | 중간 | 높음 | 6개월 데이터 종합 분석 정확도 향상 |
| `annual` | 중간 | 높음 | 성장 스토리의 서사적 완성도 향상 |
| `weekly` | 중간 | 중간 | 속도 유지, 빠른 피드백 |
| `monthly` | 중간 | 중간 | 비용 효율적 정기 분석 |

### 4.3 확장성

- **학년별 분기**: 고등학생 시험은 Pro, 초등학생은 Flash
- **시험 유형별 분기**: 수능/모의고사는 Pro, 쪽지시험은 Flash
- **Feature Flag 연동**: 특정 학생/그룹에만 Pro 모델 적용 가능
- **A/B 테스트**: 모델별 분석 품질 비교 실험 가능

---

## 5. 마이그레이션 체크리스트

- [ ] `src/lib/model-router.ts` 생성
- [ ] `src/lib/gemini.ts` 수정 (routeModel 적용)
- [ ] `.env.local` 업데이트
- [ ] API 라우트 파라미터 전달 확인
- [ ] 테스트: level_test → Pro 모델 사용 확인
- [ ] 테스트: weekly → Flash 모델 사용 확인
- [ ] 로깅: 사용된 모델 기록 (선택)
- [ ] 비용 모니터링 대시보드 연동 (선택)

---

## 6. 향후 고려사항

### 6.1 비용 추적
- 리포트별 사용 모델과 토큰 수 로깅
- 월별 비용 리포트 생성

### 6.2 품질 피드백 루프
- 교사의 분석 품질 평가 수집
- 모델별 품질 점수 비교

### 6.3 동적 라우팅 확장
- 학부모 피드백 기반 라우팅 조정
- 학생별 맞춤 모델 선택

---

**작성일**: 2025-01-01
**버전**: 1.0
**담당**: AI Engineering Team
