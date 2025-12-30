/**
 * 리포트 저장 후 전략 및 예측 자동 등록 유틸리티
 *
 * 피드백 루프와 예측 모델을 위해 리포트 저장 시 자동으로:
 * 1. strategy_tracking에 개선 전략 등록
 * 2. prediction_verification에 성장 예측 등록
 */

import type { AnalysisData, ActionablePrescriptionItem, GrowthPrediction } from '@/types';

interface RegisterResult {
  success: boolean;
  strategiesRegistered?: number;
  predictionsRegistered?: number;
  error?: string;
}

/**
 * 리포트의 전략을 strategy_tracking 테이블에 등록
 */
export async function registerStrategies(
  reportId: number,
  studentId: number,
  strategies: ActionablePrescriptionItem[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!strategies || strategies.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const response = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId,
        studentId,
        strategies,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`[Strategy Tracking] ${result.strategies?.length || 0}개 전략 등록 완료`);
      return { success: true, count: result.strategies?.length || 0 };
    } else {
      // 이미 등록된 경우는 에러로 처리하지 않음
      if (result.error?.includes('already tracked')) {
        console.log('[Strategy Tracking] 이미 등록된 전략');
        return { success: true, count: 0 };
      }
      console.warn('[Strategy Tracking] 등록 실패:', result.error);
      return { success: false, count: 0, error: result.error };
    }
  } catch (error) {
    console.error('[Strategy Tracking] API 호출 실패:', error);
    return { success: false, count: 0, error: String(error) };
  }
}

/**
 * 리포트의 성장 예측을 prediction_verification 테이블에 등록
 */
export async function registerPredictions(
  reportId: number,
  studentId: number,
  predictions: GrowthPrediction[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!predictions || predictions.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId,
        studentId,
        predictions,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`[Prediction Tracking] ${result.predictions?.length || 0}개 예측 등록 완료`);
      return { success: true, count: result.predictions?.length || 0 };
    } else {
      console.warn('[Prediction Tracking] 등록 실패:', result.error);
      return { success: false, count: 0, error: result.error };
    }
  } catch (error) {
    console.error('[Prediction Tracking] API 호출 실패:', error);
    return { success: false, count: 0, error: String(error) };
  }
}

/**
 * 리포트 저장 후 전략과 예측 모두 등록 (통합 함수)
 */
export async function registerReportFeedbackData(
  reportId: number,
  studentId: number,
  analysisData: AnalysisData
): Promise<RegisterResult> {
  const results: RegisterResult = {
    success: true,
    strategiesRegistered: 0,
    predictionsRegistered: 0,
  };

  // 1. 전략 등록
  if (analysisData.actionablePrescription && analysisData.actionablePrescription.length > 0) {
    const strategyResult = await registerStrategies(
      reportId,
      studentId,
      analysisData.actionablePrescription
    );

    results.strategiesRegistered = strategyResult.count;
    if (!strategyResult.success && strategyResult.error) {
      console.warn('[Feedback Loop] 전략 등록 실패:', strategyResult.error);
    }
  }

  // 2. 예측 등록
  if (analysisData.growthPredictions && analysisData.growthPredictions.length > 0) {
    const predictionResult = await registerPredictions(
      reportId,
      studentId,
      analysisData.growthPredictions
    );

    results.predictionsRegistered = predictionResult.count;
    if (!predictionResult.success && predictionResult.error) {
      console.warn('[Feedback Loop] 예측 등록 실패:', predictionResult.error);
    }
  }

  console.log('[Feedback Loop] 등록 완료:', {
    strategies: results.strategiesRegistered,
    predictions: results.predictionsRegistered,
  });

  return results;
}
