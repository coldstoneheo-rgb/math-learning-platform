'use client';

/**
 * MomentumGauge Component
 *
 * 성장 모멘텀(성장 추세)을 시각적으로 보여주는 게이지
 * - 부모 친화적인 용어 사용 (상승중, 유지중, 관심필요)
 * - 애니메이션 효과로 직관적인 표현
 * - 학습 습관 점수와 연동
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Rocket, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';

type MomentumStatus = 'rising' | 'steady' | 'needs_attention';

interface MomentumGaugeProps {
  status: MomentumStatus;
  statusLabel: string;
  habitScore?: number;
  weeklyComparison?: string;
  compact?: boolean;
}

function MomentumGauge({
  status,
  statusLabel,
  habitScore,
  weeklyComparison,
  compact = false,
}: MomentumGaugeProps) {
  const config = useMemo(() => {
    switch (status) {
      case 'rising':
        return {
          color: 'emerald',
          bgColor: 'bg-emerald-50',
          textColor: 'text-emerald-700',
          borderColor: 'border-emerald-200',
          gaugeColor: '#10b981',
          gaugeGradient: ['#34d399', '#059669'],
          Icon: Rocket,
          emoji: '🚀',
          angle: 135,
        };
      case 'steady':
        return {
          color: 'blue',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
          gaugeColor: '#3b82f6',
          gaugeGradient: ['#60a5fa', '#2563eb'],
          Icon: TrendingUp,
          emoji: '📈',
          angle: 90,
        };
      case 'needs_attention':
        return {
          color: 'amber',
          bgColor: 'bg-amber-50',
          textColor: 'text-amber-700',
          borderColor: 'border-amber-200',
          gaugeColor: '#f59e0b',
          gaugeGradient: ['#fbbf24', '#d97706'],
          Icon: AlertCircle,
          emoji: '💪',
          angle: 45,
        };
    }
  }, [status]);

  const { Icon, emoji, angle, bgColor, textColor, borderColor, gaugeGradient } = config;

  if (compact) {
    return (
      <motion.div
        className={`flex items-center gap-3 p-3 rounded-lg ${bgColor} border ${borderColor}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-2xl">{emoji}</span>
        <div>
          <p className={`font-semibold ${textColor}`}>{statusLabel}</p>
          {weeklyComparison && (
            <p className="text-xs text-gray-600 mt-0.5">{weeklyComparison}</p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`rounded-xl p-5 ${bgColor} border ${borderColor}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-5 h-5 ${textColor}`} />
          <h3 className="font-semibold text-gray-800">성장 모멘텀</h3>
        </div>
        {habitScore !== undefined && (
          <div className={`px-3 py-1 rounded-full bg-white/50 ${textColor} text-sm font-medium`}>
            학습 습관 {habitScore}점
          </div>
        )}
      </div>

      {/* Gauge */}
      <div className="flex justify-center mb-4">
        <div className="relative w-40 h-24">
          {/* Background Arc */}
          <svg viewBox="0 0 100 60" className="w-full h-full">
            <defs>
              <linearGradient id={`gaugeGradient-${status}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gaugeGradient[0]} />
                <stop offset="100%" stopColor={gaugeGradient[1]} />
              </linearGradient>
            </defs>

            {/* Background track */}
            <path
              d="M 10 55 A 40 40 0 0 1 90 55"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Colored arc based on status */}
            <motion.path
              d="M 10 55 A 40 40 0 0 1 90 55"
              fill="none"
              stroke={`url(#gaugeGradient-${status})`}
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: angle / 180 }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />

            {/* Indicator dot */}
            <motion.circle
              cx="50"
              cy="55"
              r="6"
              fill="white"
              stroke={gaugeGradient[1]}
              strokeWidth="3"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                cx: 50 + 40 * Math.cos((180 - angle) * (Math.PI / 180)),
                cy: 55 - 40 * Math.sin((180 - angle) * (Math.PI / 180)),
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>

          {/* Center emoji */}
          <motion.div
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
          >
            <span className="text-3xl">{emoji}</span>
          </motion.div>
        </div>
      </div>

      {/* Status Label */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className={`text-lg font-bold ${textColor}`}>{statusLabel}</p>
        {weeklyComparison && (
          <p className="text-sm text-gray-600 mt-2">{weeklyComparison}</p>
        )}
      </motion.div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-white/50">
        <div className="flex justify-between text-xs text-gray-500">
          <span>관심 필요</span>
          <span>유지 중</span>
          <span>상승 중</span>
        </div>
        <div className="flex mt-1">
          <div className="flex-1 h-1 bg-amber-300 rounded-l" />
          <div className="flex-1 h-1 bg-blue-400" />
          <div className="flex-1 h-1 bg-emerald-400 rounded-r" />
        </div>
      </div>

      {/* Tips based on status */}
      <div className="mt-4 bg-white/40 rounded-lg p-3">
        <p className="text-xs text-gray-700">
          {status === 'rising' && (
            <>
              <span className="font-semibold">훌륭해요!</span> 지금처럼만 하면 더 큰 성장을 이룰 수 있어요.
            </>
          )}
          {status === 'steady' && (
            <>
              <span className="font-semibold">좋아요!</span> 꾸준한 학습이 실력 향상의 지름길이에요.
            </>
          )}
          {status === 'needs_attention' && (
            <>
              <span className="font-semibold">화이팅!</span> 조금 더 집중하면 금세 좋아질 거예요.
            </>
          )}
        </p>
      </div>
    </motion.div>
  );
}

export default memo(MomentumGauge);

/**
 * 간단한 인라인 모멘텀 배지
 */
export function MomentumBadge({
  status,
  label,
}: {
  status: MomentumStatus;
  label: string;
}) {
  const config = {
    rising: { bg: 'bg-emerald-100', text: 'text-emerald-700', emoji: '🚀' },
    steady: { bg: 'bg-blue-100', text: 'text-blue-700', emoji: '📈' },
    needs_attention: { bg: 'bg-amber-100', text: 'text-amber-700', emoji: '💪' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.emoji}</span>
      <span>{label}</span>
    </span>
  );
}
