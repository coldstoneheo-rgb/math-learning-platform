'use client';

/**
 * WeaknessJourneyMap Component
 *
 * 취약점 극복 여정을 지하철 노선도 스타일로 시각화
 * - 발견 🔴 → 훈련중 🟡 → 극복완료 🟢
 * - 서사적 연결로 성장 스토리 강화
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md - "WeaknessJourneyMap"
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CircleDot,
  Circle,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Sparkles,
  MapPin,
  Flag,
  Clock,
  ArrowRight,
} from 'lucide-react';

type JourneyStatus = 'discovered' | 'training' | 'improving' | 'resolved';

interface WeaknessJourneyItem {
  id: string;
  concept: string;
  status: JourneyStatus;
  discoveredDate?: string;
  resolvedDate?: string;
  duration?: string;
  details?: string;
  progress?: number;
}

interface WeaknessJourneyMapProps {
  journeyItems: WeaknessJourneyItem[];
  studentName?: string;
  reportPeriod?: string;
  compact?: boolean;
}

const STATUS_CONFIG: Record<JourneyStatus, {
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  lineColor: string;
  icon: typeof Circle;
  label: string;
  emoji: string;
}> = {
  discovered: {
    color: '#ef4444',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    textColor: 'text-red-700',
    lineColor: 'bg-red-300',
    icon: AlertCircle,
    label: '발견',
    emoji: '🔴',
  },
  training: {
    color: '#f59e0b',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    lineColor: 'bg-amber-300',
    icon: CircleDot,
    label: '훈련중',
    emoji: '🟡',
  },
  improving: {
    color: '#3b82f6',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    lineColor: 'bg-blue-300',
    icon: TrendingUp,
    label: '개선중',
    emoji: '🔵',
  },
  resolved: {
    color: '#10b981',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700',
    lineColor: 'bg-emerald-400',
    icon: CheckCircle2,
    label: '극복완료',
    emoji: '🟢',
  },
};

const STATUS_ORDER: JourneyStatus[] = ['discovered', 'training', 'improving', 'resolved'];

function JourneyStation({
  item,
  index,
  isLast,
  compact,
}: {
  item: WeaknessJourneyItem;
  index: number;
  isLast: boolean;
  compact: boolean;
}) {
  const config = STATUS_CONFIG[item.status];
  const Icon = config.icon;
  const statusIndex = STATUS_ORDER.indexOf(item.status);

  return (
    <motion.div
      className="flex items-stretch"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      {/* Station Node */}
      <div className="flex flex-col items-center mr-4">
        {/* Circle */}
        <motion.div
          className={`w-10 h-10 rounded-full ${config.bgColor} border-2 ${config.borderColor} flex items-center justify-center shadow-md z-10`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.1 + 0.1, type: 'spring' }}
          whileHover={{ scale: 1.1 }}
        >
          <Icon className={`w-5 h-5 ${config.textColor}`} />
        </motion.div>

        {/* Connecting Line */}
        {!isLast && (
          <div className="flex-1 w-1 bg-gradient-to-b from-slate-200 to-slate-300 my-1 rounded-full" />
        )}
      </div>

      {/* Station Content */}
      <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
        <motion.div
          className={`${config.bgColor} rounded-xl border ${config.borderColor} p-4 shadow-sm`}
          whileHover={{ scale: 1.01, y: -2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{config.emoji}</span>
              <span className={`text-xs font-semibold ${config.textColor} px-2 py-0.5 rounded-full ${config.bgColor} border ${config.borderColor}`}>
                {config.label}
              </span>
            </div>
            {item.duration && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.duration}
              </span>
            )}
          </div>

          {/* Concept Name */}
          <h4 className={`font-semibold ${config.textColor} text-sm mb-1`}>
            {item.concept}
          </h4>

          {/* Details */}
          {!compact && item.details && (
            <p className="text-xs text-slate-600 leading-relaxed mb-2">
              {item.details}
            </p>
          )}

          {/* Progress Bar for training/improving */}
          {(item.status === 'training' || item.status === 'improving') && item.progress !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span className={config.textColor}>진행률</span>
                <span className={`font-medium ${config.textColor}`}>{item.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full`}
                  style={{ backgroundColor: config.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.progress}%` }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* Journey Path Preview */}
          {!compact && (
            <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-200/50">
              {STATUS_ORDER.map((status, i) => {
                const stepConfig = STATUS_CONFIG[status];
                const isActive = i <= statusIndex;
                const isCurrent = i === statusIndex;

                return (
                  <div key={status} className="flex items-center">
                    <div
                      className={`w-3 h-3 rounded-full transition-all ${
                        isActive
                          ? isCurrent
                            ? `ring-2 ring-offset-1`
                            : ''
                          : 'bg-slate-200'
                      }`}
                      style={{
                        backgroundColor: isActive ? stepConfig.color : undefined,
                        '--tw-ring-color': isCurrent ? stepConfig.color : undefined,
                      } as React.CSSProperties}
                    />
                    {i < STATUS_ORDER.length - 1 && (
                      <div
                        className={`w-4 h-0.5 mx-0.5 ${
                          i < statusIndex ? 'bg-slate-300' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

function WeaknessJourneyMap({
  journeyItems,
  studentName,
  reportPeriod,
  compact = false,
}: WeaknessJourneyMapProps) {
  const stats = useMemo(() => {
    const resolved = journeyItems.filter(i => i.status === 'resolved').length;
    const inProgress = journeyItems.filter(i => i.status === 'training' || i.status === 'improving').length;
    const discovered = journeyItems.filter(i => i.status === 'discovered').length;
    const total = journeyItems.length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { resolved, inProgress, discovered, total, resolutionRate };
  }, [journeyItems]);

  if (journeyItems.length === 0) {
    return (
      <div className="bg-emerald-50 rounded-xl p-6 text-center border border-emerald-200">
        <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <p className="text-emerald-700 font-medium">추적 중인 취약점이 없어요!</p>
        <p className="text-emerald-600 text-sm mt-1">
          {studentName ? `${studentName} 학생이` : ''} 현재까지 큰 약점 없이 잘 학습하고 있습니다.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              취약점 극복 여정
              {reportPeriod && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {reportPeriod}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              발견부터 극복까지, 성장의 발자취
            </p>
          </div>
        </div>

        {/* Resolution Rate */}
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-600">{stats.resolutionRate}%</div>
          <div className="text-xs text-slate-500">해결률</div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[
          { label: '발견', count: stats.discovered, config: STATUS_CONFIG.discovered },
          { label: '훈련중', count: journeyItems.filter(i => i.status === 'training').length, config: STATUS_CONFIG.training },
          { label: '개선중', count: journeyItems.filter(i => i.status === 'improving').length, config: STATUS_CONFIG.improving },
          { label: '극복완료', count: stats.resolved, config: STATUS_CONFIG.resolved },
        ].map(({ label, count, config }) => (
          <div
            key={label}
            className={`${config.bgColor} rounded-lg p-2 text-center border ${config.borderColor}`}
          >
            <p className={`text-lg font-bold ${config.textColor}`}>{count}</p>
            <p className={`text-xs ${config.textColor} opacity-80`}>{config.emoji} {label}</p>
          </div>
        ))}
      </div>

      {/* Journey Map */}
      <div className="relative">
        {journeyItems.map((item, index) => (
          <JourneyStation
            key={item.id}
            item={item}
            index={index}
            isLast={index === journeyItems.length - 1}
            compact={compact}
          />
        ))}
      </div>

      {/* Footer Message */}
      {stats.resolved > 0 && (
        <motion.div
          className="mt-4 bg-emerald-50 rounded-xl p-4 border border-emerald-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <p className="text-sm text-emerald-800">
              🎉 <strong>{stats.resolved}개</strong> 취약점을 극복했어요!
              {studentName && ` ${studentName} 학생의`} 꾸준한 노력의 결과입니다.
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default memo(WeaknessJourneyMap);

/**
 * Helper: Convert status string to JourneyStatus
 */
export function toJourneyStatus(status: string): JourneyStatus {
  const mapping: Record<string, JourneyStatus> = {
    active: 'discovered',
    improving: 'improving',
    resolved: 'resolved',
    recurring: 'training',
  };
  return mapping[status] || 'discovered';
}
