'use client';

/**
 * GrowthProjectionChart Component
 *
 * 예상 성장 궤적을 시각화하는 차트
 * - 현재 페이스 유지 시 3개월/6개월 뒤 도달할 예상 위치를 점선으로 표시
 * - 학부모에게 지속 학습의 기대감 부여 (가입 유지/결제 유도)
 *
 * @see docs/REPORT_ENHANCEMENT_PLAN(by Gemini).md - "GrowthProjectionChart"
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
  Legend,
} from 'recharts';
import { TrendingUp, Target, Calendar, Info, Rocket } from 'lucide-react';

interface DataPoint {
  date: string;
  score: number;
  label?: string;
  isProjection?: boolean;
}

interface GrowthProjectionChartProps {
  historicalData: DataPoint[];
  projectedData?: DataPoint[];
  targetScore?: number;
  studentName?: string;
  showProjection?: boolean;
}

function formatChartMonth(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월`;
}

function GrowthProjectionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const isProjection = payload.some(p => p.dataKey === 'projected' && p.value !== undefined);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 p-3">
      <p className="text-xs font-medium text-slate-600 mb-1">
        {label ? formatChartMonth(label) : ''}
        {isProjection && <span className="text-violet-500 ml-1">(예상)</span>}
      </p>
      {payload.map((entry, index) => (
        entry.value !== undefined && (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.dataKey === 'actual' ? '실제' : '예상'}: {entry.value}점
          </p>
        )
      ))}
    </div>
  );
}

function GrowthProjectionChart({
  historicalData,
  projectedData,
  targetScore = 90,
  studentName,
  showProjection = true,
}: GrowthProjectionChartProps) {
  const currentScore = historicalData[historicalData.length - 1]?.score || 0;

  const autoProjectedData = useMemo(() => {
    if (projectedData) return projectedData;
    if (!showProjection || historicalData.length < 2) return [];

    const scores = historicalData.map(d => d.score);
    const avgGrowth = scores.length > 1
      ? (scores[scores.length - 1] - scores[0]) / (scores.length - 1)
      : 2;

    const monthGrowth = Math.max(1, Math.min(5, avgGrowth));
    const lastDate = new Date(historicalData[historicalData.length - 1].date);

    return [1, 2, 3, 4, 5, 6].map((monthOffset) => {
      const projectedDate = new Date(lastDate);
      projectedDate.setMonth(projectedDate.getMonth() + monthOffset);
      const projected = Math.min(100, Math.round(currentScore + monthGrowth * monthOffset));

      return {
        date: projectedDate.toISOString().split('T')[0],
        score: projected,
        label: `${monthOffset}개월 후`,
        isProjection: true,
      };
    });
  }, [historicalData, projectedData, showProjection, currentScore]);

  const allData = useMemo(() => {
    const historical = historicalData.map(d => ({
      ...d,
      actual: d.score,
      projected: undefined as number | undefined,
    }));

    const lastHistorical = historical[historical.length - 1];
    const projections = autoProjectedData.map((d, idx) => ({
      ...d,
      actual: idx === 0 ? lastHistorical?.actual : undefined,
      projected: d.score,
    }));

    if (projections.length > 0 && lastHistorical) {
      projections[0] = {
        ...projections[0],
        actual: lastHistorical.actual,
        projected: lastHistorical.actual,
      };
    }

    return [...historical, ...projections];
  }, [historicalData, autoProjectedData]);

  const projection3Month = autoProjectedData[2]?.score;
  const projection6Month = autoProjectedData[5]?.score;
  const reachTargetMonth = autoProjectedData.findIndex(d => d.score >= targetScore) + 1;

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
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              성장 예측 그래프
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                AI 예측
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              현재 학습 페이스 유지 시 예상 성장 궤적
            </p>
          </div>
        </div>

        {targetScore && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <Target className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">목표: {targetScore}점</span>
          </div>
        )}
      </div>

      {/* Projection Summary Cards */}
      {showProjection && (
        <motion.div
          className="grid grid-cols-3 gap-3 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200/60">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">3개월 후</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-600">{projection3Month || '-'}</span>
              <span className="text-sm text-blue-500">점</span>
            </div>
            {projection3Month && (
              <p className="text-xs text-blue-600 mt-1">
                +{projection3Month - currentScore}점 예상
              </p>
            )}
          </div>

          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200/60">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-medium text-violet-700">6개월 후</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-violet-600">{projection6Month || '-'}</span>
              <span className="text-sm text-violet-500">점</span>
            </div>
            {projection6Month && (
              <p className="text-xs text-violet-600 mt-1">
                +{projection6Month - currentScore}점 예상
              </p>
            )}
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200/60">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">목표 달성</span>
            </div>
            <div className="flex items-baseline gap-1">
              {reachTargetMonth > 0 ? (
                <>
                  <span className="text-2xl font-bold text-emerald-600">{reachTargetMonth}</span>
                  <span className="text-sm text-emerald-500">개월 후</span>
                </>
              ) : projection6Month && projection6Month >= targetScore ? (
                <span className="text-sm font-medium text-emerald-600">6개월 내 가능!</span>
              ) : (
                <span className="text-sm text-emerald-600">꾸준히 노력 중</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={allData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

            <XAxis
              dataKey="date"
              tickFormatter={formatChartMonth}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
            />

            <YAxis
              domain={[50, 100]}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
            />

            <Tooltip content={<GrowthProjectionTooltip />} />

            {targetScore && (
              <ReferenceLine
                y={targetScore}
                stroke="#10b981"
                strokeDasharray="5 5"
                label={{
                  value: `목표 ${targetScore}점`,
                  position: 'right',
                  fill: '#10b981',
                  fontSize: 11,
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="actual"
              stroke="transparent"
              fill="url(#actualGradient)"
            />

            <Line
              type="monotone"
              dataKey="actual"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#3b82f6' }}
              connectNulls={false}
            />

            {showProjection && (
              <>
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="transparent"
                  fill="url(#projectedGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, fill: '#8b5cf6' }}
                  connectNulls={false}
                />
              </>
            )}

            <Legend
              formatter={(value) => (value === 'actual' ? '실제 점수' : '예상 점수')}
              iconType="line"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Note */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            예상 성장 곡선은 현재까지의 학습 데이터와 성장 패턴을 기반으로 AI가 예측한 결과입니다.
            꾸준한 학습을 유지하면 목표 달성이 가능합니다.
            {studentName && ` ${studentName} 학생, 화이팅!`}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default memo(GrowthProjectionChart);
