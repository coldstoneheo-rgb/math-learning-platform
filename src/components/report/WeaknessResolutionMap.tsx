'use client';

/**
 * WeaknessResolutionMap Component
 *
 * 취약점 해결 현황을 시각적으로 보여주는 맵
 * - 해결됨 / 개선중 / 지속됨 / 신규 발견
 * - 칸반 스타일 4컬럼 레이아웃
 * - 부모가 자녀의 취약점 추적 현황을 한눈에 파악
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, TrendingUp, AlertTriangle, Plus, ShieldCheck } from 'lucide-react';

export type WeaknessStatus = 'resolved' | 'improving' | 'ongoing' | 'new';

export interface WeaknessItem {
  concept: string;
  status: WeaknessStatus;
  detail?: string;
  duration?: string;  // 예: "3주째"
}

interface WeaknessResolutionMapProps {
  weaknesses: WeaknessItem[];
  studentName?: string;
  compact?: boolean;
}

interface ColumnConfig {
  status: WeaknessStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  badgeColor: string;
  emoji: string;
}

const COLUMN_CONFIGS: ColumnConfig[] = [
  {
    status: 'resolved',
    label: '해결됨',
    icon: CheckCircle,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-800',
    iconColor: 'text-emerald-500',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    emoji: '✅',
  },
  {
    status: 'improving',
    label: '개선중',
    icon: TrendingUp,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-500',
    badgeColor: 'bg-blue-100 text-blue-700',
    emoji: '📈',
  },
  {
    status: 'ongoing',
    label: '지속됨',
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-500',
    badgeColor: 'bg-amber-100 text-amber-700',
    emoji: '⚠️',
  },
  {
    status: 'new',
    label: '신규 발견',
    icon: Plus,
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-800',
    iconColor: 'text-rose-500',
    badgeColor: 'bg-rose-100 text-rose-700',
    emoji: '🆕',
  },
];

function WeaknessResolutionMap({
  weaknesses,
  studentName,
  compact = false,
}: WeaknessResolutionMapProps) {
  // 상태별 그룹화
  const grouped = COLUMN_CONFIGS.reduce(
    (acc, col) => {
      acc[col.status] = weaknesses.filter((w) => w.status === col.status);
      return acc;
    },
    {} as Record<WeaknessStatus, WeaknessItem[]>
  );

  const totalResolved = grouped.resolved.length;
  const totalWeaknesses = weaknesses.length;
  const resolutionRate =
    totalWeaknesses > 0
      ? Math.round((totalResolved / totalWeaknesses) * 100)
      : 0;

  if (weaknesses.length === 0) {
    return (
      <div className="bg-emerald-50 rounded-xl p-6 text-center border border-emerald-200">
        <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <p className="text-emerald-700 font-medium">추적 중인 취약점이 없어요</p>
        <p className="text-emerald-600 text-sm mt-1">현재까지 큰 약점 없이 잘 학습하고 있습니다!</p>
      </div>
    );
  }

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
          <ShieldCheck className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-gray-800">취약점 해결 현황</h3>
        </div>
        {!compact && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-gray-500">해결률</p>
              <p className="text-lg font-bold text-emerald-600">{resolutionRate}%</p>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-emerald-200 flex items-center justify-center relative">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#d1fae5" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none"
                  stroke="#10b981" strokeWidth="3"
                  strokeDasharray={`${resolutionRate * 0.975} 97.5`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xs font-bold text-emerald-700 z-10">{totalResolved}</span>
            </div>
          </div>
        )}
      </div>

      {/* Progress Summary */}
      {!compact && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          {COLUMN_CONFIGS.map((col) => (
            <div key={col.status} className={`${col.bgColor} rounded-lg p-2 text-center border ${col.borderColor}`}>
              <p className="text-lg font-bold">{grouped[col.status].length}</p>
              <p className={`text-xs ${col.textColor}`}>{col.emoji} {col.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kanban Columns */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {COLUMN_CONFIGS.map((col, colIdx) => {
          const items = grouped[col.status];
          if (compact && items.length === 0) return null;
          const Icon = col.icon;

          return (
            <motion.div
              key={col.status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: colIdx * 0.08 }}
              className={`${col.bgColor} rounded-lg border ${col.borderColor} p-3 min-h-[80px]`}
            >
              {/* Column Header */}
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={`w-4 h-4 ${col.iconColor}`} />
                <span className={`text-xs font-semibold ${col.textColor}`}>{col.label}</span>
                {items.length > 0 && (
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium ${col.badgeColor}`}>
                    {items.length}
                  </span>
                )}
              </div>

              {/* Items */}
              {items.length > 0 ? (
                <div className="space-y-1.5">
                  {items.slice(0, compact ? 2 : 5).map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: colIdx * 0.08 + i * 0.04 }}
                      className="bg-white/70 rounded p-2"
                    >
                      <p className={`text-xs font-medium ${col.textColor}`}>{item.concept}</p>
                      {item.duration && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.duration}</p>
                      )}
                      {item.detail && !compact && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.detail}</p>
                      )}
                    </motion.div>
                  ))}
                  {items.length > (compact ? 2 : 5) && (
                    <p className="text-xs text-gray-500 text-center">
                      +{items.length - (compact ? 2 : 5)}개 더
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center mt-2">없음</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Message */}
      {totalResolved > 0 && !compact && (
        <div className="mt-4 bg-emerald-50 rounded-lg p-3 border border-emerald-100">
          <p className="text-sm text-emerald-800">
            🎉 이번 달 <span className="font-semibold">{totalResolved}개</span> 취약점을 해결했어요!
            {studentName ? ` ${studentName} 학생이` : ''} 꾸준히 노력한 결과입니다.
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default memo(WeaknessResolutionMap);

/**
 * 월간 리포트 데이터에서 WeaknessItem 배열 생성 헬퍼
 */
export function buildWeaknessItems(
  resolvedWeaknesses: string[],
  newChallenges: string[],
  ongoingWeaknesses?: string[]
): WeaknessItem[] {
  const items: WeaknessItem[] = [];

  resolvedWeaknesses.forEach((w) =>
    items.push({ concept: w, status: 'resolved' })
  );

  newChallenges.forEach((w) =>
    items.push({ concept: w, status: 'new' })
  );

  (ongoingWeaknesses || []).forEach((w) =>
    items.push({ concept: w, status: 'ongoing' })
  );

  return items;
}
