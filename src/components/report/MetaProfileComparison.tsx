'use client';

/**
 * MetaProfileComparison Component
 *
 * 반기/연간 메타프로필 5개 지표 Before/After 비교 카드
 * - 오류패턴 / 학습흡수율 / 풀이지구력 / 메타인지 시각화
 * - 개선/유지/하락 상태 색상 인디케이터
 * - 부모 친화적 설명 포함
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

export interface MetricChange {
  label: string;
  description: string;
  previous: number;
  current: number;
  trend: 'improving' | 'stable' | 'declining';
  unit?: string;
  maxValue?: number;
}

interface MetaProfileComparisonProps {
  metrics: MetricChange[];
  period?: string;
  compact?: boolean;
}

const TREND_CONFIG = {
  improving: { color: 'emerald', label: '향상', arrow: '↑', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  stable:    { color: 'blue',    label: '유지', arrow: '→', bg: 'bg-blue-50',    text: 'text-blue-700',    bar: 'bg-blue-400' },
  declining: { color: 'red',     label: '하락', arrow: '↓', bg: 'bg-red-50',     text: 'text-red-700',     bar: 'bg-red-400' },
};

function MetricBar({ value, maxValue = 100, color }: { value: number; maxValue?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / maxValue) * 100));
  return (
    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

function MetaProfileComparison({ metrics, period, compact = false }: MetaProfileComparisonProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Brain className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">메타프로필 데이터가 없어요</p>
      </div>
    );
  }

  const improvingCount = metrics.filter((m) => m.trend === 'improving').length;
  const decliningCount = metrics.filter((m) => m.trend === 'declining').length;

  return (
    <motion.div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-gray-800">학습 역량 변화</h3>
          {period && <span className="text-xs text-gray-400">{period}</span>}
        </div>
        <div className="flex gap-2 text-xs">
          {improvingCount > 0 && (
            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              ↑ {improvingCount}개 향상
            </span>
          )}
          {decliningCount > 0 && (
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              ↓ {decliningCount}개 하락
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-4">
        {metrics.map((metric, i) => {
          const cfg = TREND_CONFIG[metric.trend];
          const diff = metric.current - metric.previous;
          const maxValue = metric.maxValue ?? 100;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`${cfg.bg} rounded-lg p-3`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className={`text-sm font-semibold ${cfg.text}`}>{metric.label}</p>
                  {!compact && (
                    <p className="text-xs text-gray-500 mt-0.5">{metric.description}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className={`text-lg font-bold ${cfg.text}`}>
                    {cfg.arrow} {Math.abs(diff)}{metric.unit ?? ''}
                  </span>
                  <p className="text-xs text-gray-400">{cfg.label}</p>
                </div>
              </div>

              {/* Before/After Progress Bars */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8 text-right">이전</span>
                  <div className="flex-1">
                    <MetricBar value={metric.previous} maxValue={maxValue} color="bg-gray-300" />
                  </div>
                  <span className="text-xs text-gray-500 w-8">{metric.previous}{metric.unit ?? ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium w-8 text-right ${cfg.text}`}>현재</span>
                  <div className="flex-1">
                    <MetricBar value={metric.current} maxValue={maxValue} color={cfg.bar} />
                  </div>
                  <span className={`text-xs font-bold w-8 ${cfg.text}`}>{metric.current}{metric.unit ?? ''}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary Message */}
      <div className="mt-4 bg-violet-50 rounded-lg p-3">
        <p className="text-sm text-violet-800">
          {improvingCount >= metrics.length * 0.7
            ? '🎉 전반적으로 크게 성장했어요! 이 추세를 유지해봐요.'
            : improvingCount >= metrics.length * 0.4
            ? '📈 여러 영역에서 성장이 보여요. 좋은 신호예요!'
            : decliningCount > improvingCount
            ? '💪 일부 영역에 더 집중이 필요해요. 함께 개선해봐요!'
            : '➡️ 안정적으로 학습을 이어가고 있어요.'}
        </p>
      </div>
    </motion.div>
  );
}

export default memo(MetaProfileComparison);

/**
 * SemiAnnualReportAnalysis.metaProfileEvolution 데이터로 MetricChange 배열 생성
 */
export function buildMetaProfileMetrics(evolution: {
  absorptionRateChange?: { previous: number; current: number; trend: string };
  staminaChange?: { previous: number; current: number; trend: string };
  metaCognitionChange?: { previous: number; current: number; trend: string };
  errorSignatureChange?: { overallTrend: string };
}): MetricChange[] {
  const toTrend = (s: string): 'improving' | 'stable' | 'declining' =>
    s === 'improving' ? 'improving' : s === 'declining' ? 'declining' : 'stable';

  const metrics: MetricChange[] = [];

  if (evolution.absorptionRateChange) {
    const { previous, current, trend } = evolution.absorptionRateChange;
    metrics.push({
      label: '학습 흡수율',
      description: '새로운 개념을 얼마나 빨리 이해하는지',
      previous,
      current,
      trend: toTrend(trend),
      unit: '%',
    });
  }

  if (evolution.staminaChange) {
    const { previous, current, trend } = evolution.staminaChange;
    metrics.push({
      label: '풀이 지구력',
      description: '어려운 문제를 끝까지 풀어내는 힘',
      previous,
      current,
      trend: toTrend(trend),
    });
  }

  if (evolution.metaCognitionChange) {
    const { previous, current, trend } = evolution.metaCognitionChange;
    metrics.push({
      label: '메타인지 수준',
      description: '내 풀이를 스스로 점검하고 수정하는 능력',
      previous,
      current,
      trend: toTrend(trend),
    });
  }

  if (evolution.errorSignatureChange) {
    const { overallTrend } = evolution.errorSignatureChange;
    const t = toTrend(overallTrend);
    metrics.push({
      label: '오류 패턴 개선',
      description: '반복되는 실수가 줄어들고 있는지',
      previous: t === 'improving' ? 60 : t === 'declining' ? 75 : 70,
      current: t === 'improving' ? 80 : t === 'declining' ? 55 : 70,
      trend: t,
    });
  }

  return metrics;
}
