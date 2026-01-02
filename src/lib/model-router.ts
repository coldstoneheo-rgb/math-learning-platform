/**
 * AI 모델 라우팅 시스템 (Hybrid Routing)
 *
 * 리포트 중요도에 따라 최적의 Gemini 모델을 동적으로 선택합니다.
 *
 * 정책:
 * - High-Stakes (Pro): level_test, semi_annual, annual
 * - High-Efficiency (Flash): weekly, monthly
 * - Adaptive (test): 학년/시험 유형에 따라 분기
 */

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
  testType?: string;            // 시험 유형 (수능, 모의고사 등)
  isHighStakes?: boolean;       // 명시적 High-Stakes 플래그
  forceModel?: ModelTier;       // 강제 모델 지정 (테스트/디버깅용)
}

/**
 * 모델 설정 인터페이스
 */
interface ModelConfig {
  proModel: string;
  flashModel: string;
  testDefaultModel: ModelTier;
  proGradeThreshold: number;
  proTestTypes: string[];
}

/**
 * 환경변수에서 모델 설정 로드
 */
function getModelConfig(): ModelConfig {
  return {
    proModel: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro',
    flashModel: process.env.GEMINI_MODEL_FLASH || 'gemini-2.5-flash',
    testDefaultModel: (process.env.GEMINI_TEST_DEFAULT_MODEL || 'flash') as ModelTier,
    proGradeThreshold: parseInt(process.env.GEMINI_PRO_GRADE_THRESHOLD || '10', 10),
    proTestTypes: (process.env.GEMINI_PRO_TEST_TYPES || '모의고사,수능,기말고사,중간고사')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  };
}

// High-Stakes 리포트 타입 목록
const HIGH_STAKES_REPORT_TYPES: ReportType[] = ['level_test', 'semi_annual', 'annual'];

// Flash 전용 리포트 타입 목록
const FLASH_ONLY_REPORT_TYPES: ReportType[] = ['weekly', 'monthly', 'consolidated'];

/**
 * High-Stakes 리포트인지 판단
 */
export function isHighStakesReport(reportType: ReportType): boolean {
  return HIGH_STAKES_REPORT_TYPES.includes(reportType);
}

/**
 * Flash 전용 리포트인지 판단
 */
export function isFlashOnlyReport(reportType: ReportType): boolean {
  return FLASH_ONLY_REPORT_TYPES.includes(reportType);
}

/**
 * 시험 분석의 경우 Pro 모델 사용 조건 확인
 */
function shouldUseProForTest(context: ModelRoutingContext, config: ModelConfig): boolean {
  // 1. 명시적 High-Stakes 플래그
  if (context.isHighStakes) {
    return true;
  }

  // 2. 학년 임계값 체크 (고등학생 이상 = 10학년 이상)
  if (context.studentGrade && context.studentGrade >= config.proGradeThreshold) {
    return true;
  }

  // 3. 시험 유형 직접 지정
  if (context.testType) {
    const testTypeLower = context.testType.toLowerCase();
    if (config.proTestTypes.some(type => testTypeLower.includes(type.toLowerCase()))) {
      return true;
    }
  }

  // 4. 시험명에 Pro 키워드 포함 여부
  if (context.testName && config.proTestTypes.length > 0) {
    const testNameLower = context.testName.toLowerCase();
    if (config.proTestTypes.some(type => testNameLower.includes(type.toLowerCase()))) {
      return true;
    }
  }

  return false;
}

/**
 * 모델 라우팅 결정
 *
 * @param context - 라우팅 결정에 필요한 컨텍스트
 * @returns 사용할 Gemini 모델 ID (예: 'gemini-2.5-pro')
 *
 * @example
 * const model = routeModel({ reportType: 'level_test' });
 * // => 'gemini-2.5-pro'
 *
 * @example
 * const model = routeModel({ reportType: 'weekly' });
 * // => 'gemini-2.5-flash'
 *
 * @example
 * const model = routeModel({
 *   reportType: 'test',
 *   studentGrade: 11,
 *   testName: '3월 모의고사'
 * });
 * // => 'gemini-2.5-pro' (고등학생 + 모의고사)
 */
export function routeModel(context: ModelRoutingContext): string {
  const config = getModelConfig();

  // 1. 강제 모델 지정 시 (테스트/디버깅용)
  if (context.forceModel) {
    return context.forceModel === 'pro' ? config.proModel : config.flashModel;
  }

  // 2. High-Stakes 리포트 (level_test, semi_annual, annual)
  if (isHighStakesReport(context.reportType)) {
    return config.proModel;
  }

  // 3. Flash 전용 리포트 (weekly, monthly, consolidated)
  if (isFlashOnlyReport(context.reportType)) {
    return config.flashModel;
  }

  // 4. 시험 분석 (test) - 조건부 라우팅
  if (context.reportType === 'test') {
    if (shouldUseProForTest(context, config)) {
      return config.proModel;
    }
    return config.testDefaultModel === 'pro' ? config.proModel : config.flashModel;
  }

  // 5. 기본값 (알 수 없는 타입)
  return config.flashModel;
}

/**
 * 모델 티어 확인 (로깅/분석용)
 *
 * @param context - 라우팅 컨텍스트
 * @returns 선택된 모델의 티어 ('pro' | 'flash')
 */
export function getModelTier(context: ModelRoutingContext): ModelTier {
  const model = routeModel(context);
  const config = getModelConfig();
  return model === config.proModel ? 'pro' : 'flash';
}

/**
 * 현재 모델 설정 정보 반환 (디버깅/관리자용)
 */
export function getModelConfigInfo(): ModelConfig & { highStakesTypes: ReportType[]; flashOnlyTypes: ReportType[] } {
  const config = getModelConfig();
  return {
    ...config,
    highStakesTypes: HIGH_STAKES_REPORT_TYPES,
    flashOnlyTypes: FLASH_ONLY_REPORT_TYPES,
  };
}

/**
 * 라우팅 결정 로그 생성 (모니터링용)
 */
export function createRoutingLog(context: ModelRoutingContext): {
  timestamp: string;
  reportType: ReportType;
  selectedModel: string;
  selectedTier: ModelTier;
  routingReason: string;
} {
  const selectedModel = routeModel(context);
  const selectedTier = getModelTier(context);

  let routingReason = 'unknown';
  if (context.forceModel) {
    routingReason = `force_model: ${context.forceModel}`;
  } else if (isHighStakesReport(context.reportType)) {
    routingReason = `high_stakes_report: ${context.reportType}`;
  } else if (isFlashOnlyReport(context.reportType)) {
    routingReason = `flash_only_report: ${context.reportType}`;
  } else if (context.reportType === 'test') {
    if (context.isHighStakes) {
      routingReason = 'test_explicit_high_stakes';
    } else if (context.studentGrade && context.studentGrade >= getModelConfig().proGradeThreshold) {
      routingReason = `test_grade_threshold: grade=${context.studentGrade}`;
    } else if (context.testName) {
      routingReason = `test_name_match: ${context.testName}`;
    } else {
      routingReason = 'test_default';
    }
  }

  return {
    timestamp: new Date().toISOString(),
    reportType: context.reportType,
    selectedModel,
    selectedTier,
    routingReason,
  };
}
