'use client';

/**
 * HabitTrendChart Component
 *
 * 학습 습관 점수의 주간 추이를 보여주는 라인 차트
 * - 최대 12주간의 데이터 표시
 * - 숙제 완료, 집중도, 이해도 breakdown 표시
 * - 부모 친화적인 색상과 라벨 사용
 */

import { memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BookOpen } from 'lucide-react';

interface WeeklyHabitData {
  weekNumber: number;
  weekLabel: string;
  habitScore: number;
  assignmentCompletion?: number;
  focusLevel?: number;
  understandingLevel?: number;
}

interface HabitTrendChartProps {
  data: WeeklyHabitData[];
  currentWeek?: number;
  showBreakdown?: boolean;
  compact?: boolean;
}

function HabitTrendChart({
  data,
  currentWeek,
  showBreakdown = false,
  compact = false,
}: HabitTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          아직 학습 습관 데이터가 충분하지 않아요
        </p>
        <p className="text-gray-400 text-xs mt-1">
          수업과 숙제를 진행하면 그래프가 나타납니다
        </p>
      </div>
    );
  }

  // 현재 주 데이터와 이전 주 비교
  const latestData = data[data.length - 1];
  const previousData = data.length > 1 ? data[data.length - 2] : null;
  const trend = previousData
    ? latestData.habitScore - previousData.habitScore
    : 0;

  // 평균 점수 계산
  const avgScore = Math.round(
    data.reduce((sum, d) => sum + d.habitScore, 0) / data.length
  );

  const chartHeight = compact ? 180 : 280;

  return (
    <motion.div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-800">학습 습관 추이</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* 현재 점수 */}
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600">
              {latestData.habitScore}
              <span className="text-sm text-gray-500 font-normal">점</span>
            </p>
            <div className="flex items-center gap-1 text-xs">
              {trend > 0 ? (
                <>
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-green-600">+{trend}점</span>
                </>
              ) : trend < 0 ? (
                <>
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-red-600">{trend}점</span>
                </>
              ) : (
                <>
                  <Minus className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-500">유지</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="habitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="weekLabel"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '13px',
            }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                habitScore: '학습 습관 점수',
                assignmentCompletion: '숙제 완료',
                focusLevel: '집중도',
                understandingLevel: '이해도',
              };
              return [`${value}점`, labels[name as string] || name];
            }}
            labelFormatter={(label) => `${label}`}
          />
          {!compact && (
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              formatter={(value) => {
                const labels: Record<string, string> = {
                  habitScore: '종합 점수',
                  assignmentCompletion: '숙제',
                  focusLevel: '집중',
                  understandingLevel: '이해',
                };
                return labels[value] || value;
              }}
            />
          )}

          {/* 평균선 */}
          <ReferenceLine
            y={avgScore}
            stroke="#9ca3af"
            strokeDasharray="5 5"
            label={{
              value: `평균 ${avgScore}`,
              position: 'right',
              fontSize: 10,
              fill: '#9ca3af',
            }}
          />

          {/* 영역 (배경 그라데이션) */}
          <Area
            type="monotone"
            dataKey="habitScore"
            fill="url(#habitGradient)"
            stroke="none"
          />

          {/* 메인 라인 */}
          <Line
            type="monotone"
            dataKey="habitScore"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: '#4f46e5' }}
          />

          {/* Breakdown 라인 (선택적) */}
          {showBreakdown && (
            <>
              <Line
                type="monotone"
                dataKey="assignmentCompletion"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="focusLevel"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="understandingLevel"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary */}
      {!compact && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
          <div className="text-center">
            <p className="text-xs text-gray-500">평균 점수</p>
            <p className="text-lg font-semibold text-gray-700">{avgScore}점</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">최고 점수</p>
            <p className="text-lg font-semibold text-green-600">
              {Math.max(...data.map((d) => d.habitScore))}점
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">분석 기간</p>
            <p className="text-lg font-semibold text-gray-700">{data.length}주</p>
          </div>
        </div>
      )}

      {/* Insight */}
      <div className="mt-4 bg-indigo-50 rounded-lg p-3">
        <p className="text-sm text-indigo-800">
          {trend > 5 ? (
            <>
              <span className="font-semibold">훌륭해요!</span> 지난주보다 학습
              습관이 많이 개선되었어요.
            </>
          ) : trend > 0 ? (
            <>
              <span className="font-semibold">좋아요!</span> 조금씩 학습 습관이
              좋아지고 있어요.
            </>
          ) : trend === 0 ? (
            <>
              <span className="font-semibold">꾸준해요!</span> 학습 습관을 잘
              유지하고 있어요.
            </>
          ) : trend > -5 ? (
            <>
              <span className="font-semibold">괜찮아요!</span> 다음 주에 조금 더
              집중해봐요.
            </>
          ) : (
            <>
              <span className="font-semibold">힘내요!</span> 이번 주는 조금
              힘들었나봐요. 다음 주 화이팅!
            </>
          )}
        </p>
      </div>
    </motion.div>
  );
}

export default memo(HabitTrendChart);
