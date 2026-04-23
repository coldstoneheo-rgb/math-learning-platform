/**
 * Report Utilities
 *
 * 리포트 데이터 처리 및 표시 유틸리티
 * - 학습 습관 점수 계산
 * - 모멘텀 상태 변환 (부모 친화적 용어)
 * - 0점/데이터 부족 처리
 */

import type { WeeklyReportAnalysis } from '@/types';

// ============================================
// 학습 습관 점수 계산
// ============================================

export interface HabitScoreInput {
  assignmentTotal: number;
  assignmentCompleted: number;
  averageUnderstanding: number;  // 1-5
  averageFocus: number;          // 1-5
  classSessionCount: number;
}

export interface HabitScoreResult {
  score: number;  // 0-100
  breakdown: {
    assignmentCompletion: number;  // 0-40
    focusLevel: number;            // 0-30
    understandingLevel: number;    // 0-30
  };
  trend: 'up' | 'stable' | 'down';
  explanation: string;
}

/**
 * 학습 습관 점수 계산
 * 숙제 완료율(40%) + 집중도(30%) + 이해도(30%)
 */
export function calculateHabitScore(
  input: HabitScoreInput,
  previousScore?: number
): HabitScoreResult {
  // 숙제 완료율 (40점 만점)
  const completionRate = input.assignmentTotal > 0
    ? (input.assignmentCompleted / input.assignmentTotal)
    : 0;
  const assignmentCompletion = Math.round(completionRate * 40);

  // 집중도 (30점 만점, 1-5 -> 0-30 변환)
  const focusLevel = input.classSessionCount > 0
    ? Math.round(((input.averageFocus - 1) / 4) * 30)
    : 0;

  // 이해도 (30점 만점, 1-5 -> 0-30 변환)
  const understandingLevel = input.classSessionCount > 0
    ? Math.round(((input.averageUnderstanding - 1) / 4) * 30)
    : 0;

  const score = assignmentCompletion + focusLevel + understandingLevel;

  // 추세 판정
  let trend: 'up' | 'stable' | 'down' = 'stable';
  if (previousScore !== undefined) {
    if (score > previousScore + 5) trend = 'up';
    else if (score < previousScore - 5) trend = 'down';
  }

  // 설명 문구 생성
  const explanation = generateHabitExplanation(
    score,
    completionRate,
    input.averageFocus,
    input.averageUnderstanding
  );

  return {
    score,
    breakdown: {
      assignmentCompletion,
      focusLevel,
      understandingLevel,
    },
    trend,
    explanation,
  };
}

/**
 * 학습 습관 설명 문구 생성
 */
function generateHabitExplanation(
  score: number,
  completionRate: number,
  focus: number,
  understanding: number
): string {
  const parts: string[] = [];

  // 숙제 완료
  if (completionRate >= 0.9) {
    parts.push('숙제를 꼼꼼히 수행하고 있어요');
  } else if (completionRate >= 0.7) {
    parts.push('숙제 대부분을 완료하고 있어요');
  } else if (completionRate >= 0.5) {
    parts.push('숙제 완료율이 조금 낮아요');
  }

  // 집중도
  if (focus >= 4) {
    parts.push('수업에 잘 집중하고 있어요');
  } else if (focus >= 3) {
    parts.push('수업 집중이 양호해요');
  }

  // 이해도
  if (understanding >= 4) {
    parts.push('개념을 잘 이해하고 있어요');
  } else if (understanding < 3) {
    parts.push('개념 이해에 좀 더 시간이 필요해요');
  }

  if (parts.length === 0) {
    return score >= 70
      ? '전반적으로 학습 습관이 좋습니다'
      : '학습 습관을 조금씩 개선해 나가고 있어요';
  }

  return parts.join(', ') + '.';
}

// ============================================
// 모멘텀 상태 변환 (부모 친화적)
// ============================================

export interface MomentumDisplay {
  status: 'rising' | 'steady' | 'needs_attention';
  statusLabel: string;
  color: string;
  icon: string;
}

/**
 * 기술적 모멘텀 상태를 부모 친화적 표현으로 변환
 */
export function convertMomentumStatus(
  technicalStatus: string,
  habitScore?: number
): MomentumDisplay {
  switch (technicalStatus) {
    case 'accelerating':
      return {
        status: 'rising',
        statusLabel: '빠르게 성장하고 있어요!',
        color: 'text-green-600',
        icon: '🚀',
      };
    case 'maintaining':
      return {
        status: 'steady',
        statusLabel: '꾸준히 성장하고 있어요',
        color: 'text-blue-600',
        icon: '📈',
      };
    case 'slowing':
      return {
        status: 'needs_attention',
        statusLabel: '조금 더 힘을 내볼까요?',
        color: 'text-amber-600',
        icon: '💪',
      };
    case 'recovering':
      return {
        status: 'rising',
        statusLabel: '다시 활기를 찾고 있어요',
        color: 'text-teal-600',
        icon: '🌱',
      };
    default:
      // 데이터 부족 시 습관 점수 기반 판정
      if (habitScore !== undefined) {
        if (habitScore >= 70) {
          return {
            status: 'steady',
            statusLabel: '좋은 학습 습관을 유지하고 있어요',
            color: 'text-blue-600',
            icon: '👍',
          };
        } else if (habitScore >= 50) {
          return {
            status: 'steady',
            statusLabel: '학습 습관이 만들어지고 있어요',
            color: 'text-gray-600',
            icon: '📚',
          };
        }
      }
      return {
        status: 'steady',
        statusLabel: '학습 데이터를 수집하고 있어요',
        color: 'text-gray-500',
        icon: '📊',
      };
  }
}

// ============================================
// 0점/데이터 부족 처리
// ============================================

export interface DataAvailability {
  hasData: boolean;
  message: string;
  suggestion?: string;
}

/**
 * 연속성/습관 점수가 0인 경우 처리
 */
export function handleZeroScore(
  score: number,
  dataType: 'habit' | 'continuity' | 'understanding'
): DataAvailability {
  if (score === 0) {
    switch (dataType) {
      case 'habit':
        return {
          hasData: false,
          message: '아직 학습 습관 데이터가 충분하지 않아요',
          suggestion: '수업과 숙제를 진행하면 점수가 표시됩니다',
        };
      case 'continuity':
        return {
          hasData: false,
          message: '지난주 데이터가 없어 비교할 수 없어요',
          suggestion: '다음 주부터 연속성 분석이 시작됩니다',
        };
      case 'understanding':
        return {
          hasData: false,
          message: '이해도 평가가 아직 없어요',
          suggestion: '수업을 진행하면 이해도가 기록됩니다',
        };
    }
  }

  return { hasData: true, message: '' };
}

/**
 * 리포트 데이터 유효성 검사
 */
export function validateReportData(analysis: WeeklyReportAnalysis | null): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  if (!analysis) {
    return {
      isValid: false,
      missingFields: ['전체 분석 데이터'],
      warnings: [],
    };
  }

  const missingFields: string[] = [];
  const warnings: string[] = [];

  // 필수 필드 검사
  if (!analysis.weeklyAchievements || analysis.weeklyAchievements.length === 0) {
    missingFields.push('주간 성취');
  }

  if (!analysis.areasForImprovement || analysis.areasForImprovement.length === 0) {
    warnings.push('개선 필요 영역이 비어있습니다');
  }

  if (!analysis.nextWeekPlan?.goals || analysis.nextWeekPlan.goals.length === 0) {
    warnings.push('다음 주 계획이 비어있습니다');
  }

  // 연속성 점수 검사
  if (analysis.microLoopFeedback?.continuityScore === 0) {
    warnings.push('연속성 점수가 0점입니다 (데이터 부족 가능)');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

// ============================================
// 수업 데이터에서 평균 계산
// ============================================

export function calculateSessionAverages(
  classSessions: Array<{
    understandingLevel: number;
    attentionLevel: number;
  }>
): { avgUnderstanding: number; avgFocus: number } {
  if (!classSessions || classSessions.length === 0) {
    return { avgUnderstanding: 0, avgFocus: 0 };
  }

  const total = classSessions.reduce(
    (acc, session) => ({
      understanding: acc.understanding + (session.understandingLevel || 0),
      focus: acc.focus + (session.attentionLevel || 0),
    }),
    { understanding: 0, focus: 0 }
  );

  return {
    avgUnderstanding: Math.round((total.understanding / classSessions.length) * 10) / 10,
    avgFocus: Math.round((total.focus / classSessions.length) * 10) / 10,
  };
}

// ============================================
// 주간 비교 문구 생성
// ============================================

export function generateWeeklyComparison(
  currentScore: number,
  previousScore?: number
): string {
  if (previousScore === undefined) {
    return '첫 주간 리포트입니다. 다음 주부터 비교 분석이 시작됩니다.';
  }

  const diff = currentScore - previousScore;
  const absDiff = Math.abs(diff);

  if (diff > 10) {
    return `지난주 대비 ${absDiff}점 상승! 훌륭한 발전이에요.`;
  } else if (diff > 0) {
    return `지난주 대비 ${absDiff}점 향상되었어요.`;
  } else if (diff === 0) {
    return '지난주와 비슷한 수준을 유지하고 있어요.';
  } else if (diff > -10) {
    return `지난주보다 ${absDiff}점 낮아졌어요. 조금 더 집중해볼까요?`;
  } else {
    return `지난주보다 ${absDiff}점 하락했어요. 무슨 일이 있었는지 확인이 필요해요.`;
  }
}
