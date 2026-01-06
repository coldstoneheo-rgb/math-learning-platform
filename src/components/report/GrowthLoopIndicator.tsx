'use client';

/**
 * GrowthLoopIndicator Component
 *
 * 리포트가 Growth Loop 시스템에서 어떤 위치에 있는지 표시
 * - Baseline (레벨 테스트)
 * - Micro Loop (시험, 주간, 월간)
 * - Macro Loop (반기, 연간)
 */

type ReportType = 'level_test' | 'test' | 'weekly' | 'monthly' | 'semi_annual' | 'annual' | 'consolidated';

interface GrowthLoopIndicatorProps {
  reportType: ReportType;
  baselineDate?: string;
  hasBaseline?: boolean;
  compact?: boolean;
}

// 리포트 타입별 루프 정보
const LOOP_INFO: Record<ReportType, {
  loop: 'baseline' | 'micro' | 'macro';
  label: string;
  icon: string;
  description: string;
  color: string;
}> = {
  level_test: {
    loop: 'baseline',
    label: 'Baseline (t₀)',
    icon: '🎯',
    description: '학습 기준점 설정',
    color: 'indigo',
  },
  test: {
    loop: 'micro',
    label: 'Micro Loop',
    icon: '📝',
    description: '시험 분석 → 전술적 개선',
    color: 'blue',
  },
  weekly: {
    loop: 'micro',
    label: 'Micro Loop',
    icon: '📅',
    description: '주간 전술 실행 피드백',
    color: 'blue',
  },
  monthly: {
    loop: 'micro',
    label: 'Micro Loop',
    icon: '📆',
    description: '월간 전술 점검 및 조정',
    color: 'blue',
  },
  semi_annual: {
    loop: 'macro',
    label: 'Macro Loop',
    icon: '📊',
    description: '반기 전략 피봇 분석',
    color: 'purple',
  },
  annual: {
    loop: 'macro',
    label: 'Macro Loop',
    icon: '📈',
    description: '연간 성장 서사 완성',
    color: 'purple',
  },
  consolidated: {
    loop: 'macro',
    label: 'Macro Loop',
    icon: '📋',
    description: '통합 분석',
    color: 'purple',
  },
};

// 루프 색상 클래스
const LOOP_COLORS = {
  baseline: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    badge: 'bg-indigo-100 text-indigo-800',
  },
  micro: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
  },
  macro: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
  },
};

export default function GrowthLoopIndicator({
  reportType,
  baselineDate,
  hasBaseline = true,
  compact = false,
}: GrowthLoopIndicatorProps) {
  const info = LOOP_INFO[reportType];
  const colors = LOOP_COLORS[info.loop];

  // Baseline 경고 (Baseline 없이 다른 리포트를 생성한 경우)
  const showBaselineWarning = !hasBaseline && reportType !== 'level_test';

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${colors.badge}`}
        >
          {info.icon} {info.label}
        </span>
        {showBaselineWarning && (
          <span className="text-xs text-orange-500">⚠️ Baseline 미설정</span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 mb-6 ${colors.bg} border ${colors.border}`}>
      <div className="flex items-start justify-between">
        {/* 왼쪽: 루프 정보 */}
        <div className="flex items-center gap-3">
          <div className="text-2xl">{info.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${colors.text}`}>
                {info.label}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs ${colors.badge}`}
              >
                {reportType === 'level_test' ? '기준점' :
                 info.loop === 'micro' ? '전술 루프' : '전략 루프'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{info.description}</p>
          </div>
        </div>

        {/* 오른쪽: Baseline 참조 */}
        <div className="text-right">
          {reportType === 'level_test' ? (
            <div className="text-xs text-gray-500">
              이 리포트가 Baseline입니다
            </div>
          ) : hasBaseline && baselineDate ? (
            <div>
              <div className="text-xs text-gray-500">Baseline 기준</div>
              <div className="text-sm font-medium text-gray-700">
                {new Date(baselineDate).toLocaleDateString('ko-KR')}
              </div>
            </div>
          ) : showBaselineWarning ? (
            <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
              ⚠️ Baseline(레벨테스트) 미설정
              <br />
              <span className="text-orange-500">성장 측정이 불완전합니다</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 루프 시각화 */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <span className={reportType === 'level_test' ? 'font-bold text-indigo-600' : ''}>
            🎯 Baseline
          </span>
          <span>→</span>
          <span className={info.loop === 'micro' ? 'font-bold text-blue-600' : ''}>
            🔄 Micro Loop
          </span>
          <span>→</span>
          <span className={info.loop === 'macro' ? 'font-bold text-purple-600' : ''}>
            🔄 Macro Loop
          </span>
          <span>→</span>
          <span>🏆 Goal</span>
        </div>
      </div>
    </div>
  );
}

/**
 * BaselineReferenceCard Component
 *
 * Baseline 대비 현재 성장 상태를 표시하는 카드
 */
interface BaselineReferenceCardProps {
  baselineScore?: number;
  currentScore?: number;
  baselineDate?: string;
  studentName?: string;
}

export function BaselineReferenceCard({
  baselineScore,
  currentScore,
  baselineDate,
  studentName,
}: BaselineReferenceCardProps) {
  if (!baselineScore) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h4 className="font-medium text-orange-800">Baseline 미설정</h4>
            <p className="text-sm text-orange-600 mt-1">
              {studentName ? `${studentName} 학생의 ` : ''}레벨 테스트를 먼저 진행하여 학습 기준점을 설정해주세요.
              <br />
              Baseline이 설정되어야 정확한 성장 측정이 가능합니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const growth = currentScore && baselineScore
    ? Math.round(((currentScore - baselineScore) / baselineScore) * 100)
    : 0;

  const daysSinceBaseline = baselineDate
    ? Math.floor((Date.now() - new Date(baselineDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📍</span>
        <h4 className="font-semibold text-gray-800">Baseline 대비 현재 위치</h4>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        {/* Baseline */}
        <div>
          <div className="text-xs text-gray-500">
            Baseline (t₀)
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {baselineScore}점
          </div>
          {baselineDate && (
            <div className="text-xs text-gray-400">
              {new Date(baselineDate).toLocaleDateString('ko-KR')}
            </div>
          )}
        </div>

        {/* 성장률 */}
        <div className="flex flex-col items-center justify-center">
          <div className={`text-lg font-bold ${
            growth >= 10 ? 'text-green-600' :
            growth >= 0 ? 'text-blue-600' : 'text-red-600'
          }`}>
            {growth >= 0 ? '+' : ''}{growth}%
          </div>
          <div className="text-2xl">
            {growth >= 10 ? '🚀' : growth >= 0 ? '📈' : '📉'}
          </div>
          {daysSinceBaseline > 0 && (
            <div className="text-xs text-gray-400">
              {daysSinceBaseline}일 경과
            </div>
          )}
        </div>

        {/* 현재 */}
        <div>
          <div className="text-xs text-gray-500">현재</div>
          <div className="text-2xl font-bold text-purple-600">
            {currentScore || '-'}점
          </div>
          <div className="text-xs text-gray-400">
            지금
          </div>
        </div>
      </div>

      {/* 성장 메시지 */}
      <div className="mt-3 pt-3 border-t border-indigo-100 text-center">
        <p className="text-sm text-gray-600">
          {growth >= 20 ? '🌟 탁월한 성장을 보여주고 있습니다!' :
           growth >= 10 ? '✨ 꾸준히 성장하고 있습니다!' :
           growth >= 0 ? '📚 조금씩 발전하고 있습니다.' :
           '💪 포기하지 마세요! 곧 성장 곡선이 올라갑니다.'}
        </p>
      </div>
    </div>
  );
}

/**
 * VisionDistanceFooter Component
 *
 * 목표까지의 거리를 시각화하는 푸터
 */
interface VisionDistanceFooterProps {
  currentScore?: number;
  targetScore?: number;
  targetDate?: string;
  studentName: string;
  reportType: ReportType;
}

export function VisionDistanceFooter({
  currentScore,
  targetScore = 90,
  targetDate,
  studentName,
  reportType,
}: VisionDistanceFooterProps) {
  const progress = currentScore && targetScore
    ? Math.min(100, Math.round((currentScore / targetScore) * 100))
    : 0;

  const remaining = targetScore && currentScore
    ? Math.max(0, targetScore - currentScore)
    : targetScore;

  // 루프별 다음 단계 안내
  const getNextStep = () => {
    switch (reportType) {
      case 'level_test':
        return '다음 단계: 첫 시험 분석으로 학습 전략을 수립하세요';
      case 'test':
        return '다음 단계: 주간 리포트에서 실행 결과를 확인하세요';
      case 'weekly':
        return '다음 단계: 월간 리포트에서 종합 점검을 진행하세요';
      case 'monthly':
        return '다음 단계: 다음 시험 분석으로 성장을 확인하세요';
      case 'semi_annual':
        return '다음 단계: 후반기 전략을 수립하고 실행하세요';
      case 'annual':
        return '다음 단계: 새 학년 레벨 테스트로 새로운 Baseline을 설정하세요';
      default:
        return '꾸준한 학습으로 목표를 달성하세요';
    }
  };

  return (
    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-xl p-6 mt-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏁</span>
        <h4 className="font-semibold text-gray-800">목표까지의 거리</h4>
      </div>

      {/* 진행률 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">현재: {currentScore || 0}점</span>
          <span className="text-emerald-600 font-medium">목표: {targetScore}점</span>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>시작</span>
          <span>{progress}% 달성</span>
          <span>목표</span>
        </div>
      </div>

      {/* 남은 거리 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white/50 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">남은 거리</div>
          <div className="text-xl font-bold text-teal-600">{remaining}점</div>
        </div>
        <div className="bg-white/50 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500">예상 도달</div>
          <div className="text-xl font-bold text-cyan-600">
            {targetDate || '목표 달성 예정'}
          </div>
        </div>
      </div>

      {/* 다음 단계 안내 */}
      <div className="bg-white/30 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500">💡</span>
          <p className="text-sm text-gray-700">{getNextStep()}</p>
        </div>
      </div>

      {/* 격려 메시지 */}
      <div className="mt-4 text-center">
        <p className="text-sm text-teal-700">
          {studentName} 학생, {progress >= 80 ? '거의 다 왔어요! 조금만 더!' :
            progress >= 50 ? '절반을 넘었어요! 화이팅!' :
            progress >= 20 ? '좋은 출발이에요! 꾸준히 가요!' :
            '첫 걸음을 뗐어요! 함께 목표를 향해 가요!'}
        </p>
      </div>
    </div>
  );
}
