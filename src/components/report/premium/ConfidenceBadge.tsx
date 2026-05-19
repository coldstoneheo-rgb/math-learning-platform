'use client';

/**
 * ConfidenceBadge Component
 *
 * 분석 신뢰도를 표시하는 배지
 * - "데이터 15건 기반 분석", "최근 3주 데이터 누적" 등 표시
 * - 데이터가 부족할 경우 경고 메시지와 함께 신뢰도 표시
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md - "신뢰의 시각화"
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Database,
  Clock,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  dataCount?: number;
  dataPeriod?: string;
  description?: string;
  compact?: boolean;
}

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, {
  label: string;
  icon: typeof Shield;
  gradient: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  emoji: string;
  message: string;
}> = {
  high: {
    label: '높은 신뢰도',
    icon: ShieldCheck,
    gradient: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    emoji: '✅',
    message: '충분한 데이터를 기반으로 분석되었습니다.',
  },
  medium: {
    label: '보통 신뢰도',
    icon: Shield,
    gradient: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    emoji: '📊',
    message: '분석에 적절한 수준의 데이터가 수집되었습니다.',
  },
  low: {
    label: '낮은 신뢰도',
    icon: ShieldAlert,
    gradient: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    emoji: '⚠️',
    message: '데이터가 다소 부족하여 정확도가 제한적일 수 있습니다.',
  },
  insufficient: {
    label: '데이터 수집 중',
    icon: AlertTriangle,
    gradient: 'from-slate-400 to-gray-500',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
    emoji: '🔄',
    message: '아직 데이터가 모이는 중입니다. 정확한 분석을 위해 조금 더 기다려주세요.',
  },
};

function ConfidenceBadge({
  level,
  dataCount,
  dataPeriod,
  description,
  compact = false,
}: ConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[level];
  const Icon = config.icon;

  if (compact) {
    return (
      <motion.div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bgColor} ${config.textColor} border ${config.borderColor} text-xs font-medium`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        title={config.message}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>{config.label}</span>
        {dataCount && (
          <span className="opacity-70">({dataCount}건)</span>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`rounded-xl ${config.bgColor} border ${config.borderColor} p-4`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        {/* Icon with gradient background */}
        <div className={`p-2.5 rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-sm`}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold ${config.textColor}`}>
              {config.emoji} {config.label}
            </span>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
            {dataCount !== undefined && (
              <span className={`flex items-center gap-1 ${config.textColor} opacity-80`}>
                <Database className="w-3 h-3" />
                데이터 {dataCount}건
              </span>
            )}
            {dataPeriod && (
              <span className={`flex items-center gap-1 ${config.textColor} opacity-80`}>
                <Clock className="w-3 h-3" />
                {dataPeriod}
              </span>
            )}
          </div>

          {/* Message */}
          <p className={`text-xs ${config.textColor} opacity-80`}>
            {description || config.message}
          </p>
        </div>
      </div>

      {/* Confidence Bar */}
      {level !== 'insufficient' && (
        <div className="mt-4 pt-3 border-t border-slate-200/30">
          <div className="flex items-center gap-2 mb-1.5">
            <BarChart3 className={`w-3.5 h-3.5 ${config.textColor} opacity-60`} />
            <span className={`text-xs ${config.textColor}`}>신뢰도 수준</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  (level === 'high' && i <= 5) ||
                  (level === 'medium' && i <= 3) ||
                  (level === 'low' && i <= 1)
                    ? `bg-gradient-to-r ${config.gradient}`
                    : 'bg-slate-200'
                }`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.05 }}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(ConfidenceBadge);

/**
 * Helper function to determine confidence level based on data count
 */
export function getConfidenceLevel(dataCount: number): ConfidenceLevel {
  if (dataCount >= 10) return 'high';
  if (dataCount >= 5) return 'medium';
  if (dataCount >= 2) return 'low';
  return 'insufficient';
}

/**
 * MiniConfidenceBadge - 더 작은 인라인 버전
 */
export const MiniConfidenceBadge = memo(function MiniConfidenceBadge({
  level,
  dataCount,
}: {
  level: ConfidenceLevel;
  dataCount?: number;
}) {
  const config = CONFIDENCE_CONFIG[level];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${config.bgColor} ${config.textColor}`}
      title={config.message}
    >
      <Icon className="w-3 h-3" />
      {dataCount && <span>{dataCount}건</span>}
    </span>
  );
});
