'use client';

/**
 * TrajectoryAreaChart Component
 *
 * 반기/연간 성장 궤적을 AreaChart로 시각화
 * - 점수 변화 곡선 + 마일스톤 표시
 * - 성장 유형별 색상 (exponential/linear/plateau/fluctuating)
 * - 시작점 vs 현재점 Before/After 요약 카드
 */

import { memo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
  Dot,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

export interface TrajectoryPoint {
  month: string;
  score: number;
  milestone?: string;
}

interface TrajectoryAreaChartProps {
  data: TrajectoryPoint[];
  startScore?: number;
  currentScore?: number;
  growthRate?: number;
  growthType?: 'exponential' | 'linear' | 'plateau' | 'fluctuating';
  title?: string;
  compact?: boolean;
}

const GROWTH_TYPE_CONFIG = {
  exponential: { color: '#10b981', label: '빠른 성장', emoji: '🚀' },
  linear:      { color: '#3b82f6', label: '꾸준한 성장', emoji: '📈' },
  plateau:     { color: '#f59e0b', label: '성장 정체', emoji: '➡️' },
  fluctuating: { color: '#8b5cf6', label: '기복 있는 성장', emoji: '〰️' },
};

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: TrajectoryPoint;
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (!cx || !cy) return null;
  if (!payload?.milestone) return <circle cx={cx} cy={cy} r={4} fill="#6366f1" stroke="white" strokeWidth={2} />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="white" strokeWidth={2} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={10} fill="#92400e">
        ★
      </text>
    </g>
  );
}

function TrajectoryAreaChart({
  data,
  startScore,
  currentScore,
  growthRate,
  growthType = 'linear',
  title,
  compact = false,
}: TrajectoryAreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">성장 곡선 데이터가 없어요</p>
      </div>
    );
  }

  const cfg = GROWTH_TYPE_CONFIG[growthType];
  const improvement = startScore && currentScore ? currentScore - startScore : null;
  const chartHeight = compact ? 180 : 260;
  const hasMilestones = data.some((d) => d.milestone);

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
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-800">{title || '성장 궤적'}</h3>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium`} style={{
          backgroundColor: cfg.color + '20',
          color: cfg.color,
        }}>
          {cfg.emoji} {cfg.label}
        </span>
      </div>

      {/* Before/After 요약 */}
      {(startScore !== undefined || currentScore !== undefined) && !compact && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">시작 점수</p>
            <p className="text-xl font-bold text-gray-600">{startScore ?? '-'}</p>
          </div>
          <div className="flex items-center justify-center">
            <div className="text-center">
              {improvement !== null && (
                <>
                  <p className={`text-2xl font-black ${improvement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {improvement >= 0 ? '+' : ''}{improvement}점
                  </p>
                  {growthRate !== undefined && (
                    <p className="text-xs text-gray-500">{growthRate}% 성장</p>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <p className="text-xs text-indigo-500">현재 점수</p>
            <p className="text-xl font-bold text-indigo-700">{currentScore ?? '-'}</p>
          </div>
        </div>
      )}

      {/* Area Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={data} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="trajectoryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cfg.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
            formatter={(value) => [`${value}점`, '점수']}
            labelFormatter={(label) => {
              const point = data.find((d) => d.month === label);
              return point?.milestone ? `${label} ★ ${point.milestone}` : label;
            }}
          />
          {/* 시작점 참조선 */}
          {startScore !== undefined && (
            <ReferenceLine y={startScore} stroke="#d1d5db" strokeDasharray="5 5"
              label={{ value: `시작 ${startScore}`, position: 'left', fontSize: 10, fill: '#9ca3af' }} />
          )}
          <Area
            type="monotone" dataKey="score"
            stroke={cfg.color} strokeWidth={3}
            fill="url(#trajectoryGradient)"
            dot={hasMilestones ? <CustomDot /> : { fill: cfg.color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: cfg.color }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* 마일스톤 목록 */}
      {hasMilestones && !compact && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-500 mb-2">★ 주요 마일스톤</p>
          <div className="flex flex-wrap gap-2">
            {data.filter((d) => d.milestone).map((d, i) => (
              <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-1">
                {d.month} — {d.milestone}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(TrajectoryAreaChart);
