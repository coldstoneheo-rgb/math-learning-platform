'use client';

/**
 * GrowthTrajectoryChart Component
 *
 * 학생의 성장 궤적을 시각화하는 차트 컴포넌트
 * - 과거 점수 추이
 * - 예측 점수 (점선)
 * - 목표 대비 현재 위치
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import type { GrowthPrediction } from '@/types';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const }
  },
};

const predictionCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: 0.3 + i * 0.1, duration: 0.3 }
  }),
};

interface ScoreDataPoint {
  date: string;
  score: number;
  label?: string;
}

interface GrowthTrajectoryChartProps {
  // 과거 점수 데이터
  scoreHistory?: ScoreDataPoint[];
  // 성장 예측 데이터
  predictions?: GrowthPrediction[];
  // 현재 점수
  currentScore?: number;
  // 목표 점수
  targetScore?: number;
  // 차트 제목
  title?: string;
  // 간소화 모드
  compact?: boolean;
}

// 날짜 포맷팅 함수
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch {
    return dateStr;
  }
}

// 예측 데이터를 차트 형식으로 변환
function convertPredictions(
  predictions: GrowthPrediction[],
  currentScore?: number
): ScoreDataPoint[] {
  if (!predictions || predictions.length === 0) return [];

  const baseDate = new Date();
  const result: ScoreDataPoint[] = [];

  // 현재 점수 추가
  if (currentScore !== undefined) {
    result.push({
      date: baseDate.toISOString().split('T')[0],
      score: currentScore,
      label: '현재',
    });
  }

  // 예측 데이터 추가
  predictions.forEach((pred) => {
    let monthsToAdd = 0;
    switch (pred.timeframe) {
      case '1개월':
        monthsToAdd = 1;
        break;
      case '3개월':
        monthsToAdd = 3;
        break;
      case '6개월':
        monthsToAdd = 6;
        break;
      case '1년':
        monthsToAdd = 12;
        break;
    }

    const futureDate = new Date(baseDate);
    futureDate.setMonth(futureDate.getMonth() + monthsToAdd);

    result.push({
      date: futureDate.toISOString().split('T')[0],
      score: pred.predictedScore,
      label: pred.timeframe,
    });
  });

  return result;
}

// 커스텀 툴팁
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload: ScoreDataPoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900">
        {data.label || formatDate(label || '')}
      </p>
      <p className="text-lg font-bold text-indigo-600">{data.score}점</p>
    </div>
  );
}

function GrowthTrajectoryChart({
  scoreHistory = [],
  predictions = [],
  currentScore,
  targetScore,
  title = '성장 궤적',
  compact = false,
}: GrowthTrajectoryChartProps) {
  // 데이터 병합
  const historyData = scoreHistory.map((item) => ({
    ...item,
    type: 'history' as const,
  }));

  const predictionData = convertPredictions(predictions, currentScore);

  // 차트 데이터 준비
  const chartData: Array<{
    date: string;
    score?: number;
    predicted?: number;
    label?: string;
  }> = [];

  // 과거 데이터 추가
  historyData.forEach((item) => {
    chartData.push({
      date: item.date,
      score: item.score,
      label: item.label,
    });
  });

  // 예측 데이터 추가 (현재 점수 포함)
  if (predictionData.length > 0) {
    predictionData.forEach((item, index) => {
      if (index === 0 && currentScore !== undefined) {
        // 현재 점수는 실선과 점선 모두에 포함
        const existing = chartData.find((d) => d.date === item.date);
        if (existing) {
          existing.predicted = item.score;
        } else {
          chartData.push({
            date: item.date,
            score: item.score,
            predicted: item.score,
            label: item.label,
          });
        }
      } else {
        chartData.push({
          date: item.date,
          predicted: item.score,
          label: item.label,
        });
      }
    });
  }

  // 날짜순 정렬
  chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 데이터가 없으면 표시하지 않음
  if (chartData.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-500">성장 데이터가 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">
          시험 분석을 진행하면 성장 궤적이 표시됩니다.
        </p>
      </div>
    );
  }

  // Y축 범위 계산
  const allScores = chartData
    .flatMap((d) => [d.score, d.predicted])
    .filter((v): v is number => v !== undefined);
  const minScore = Math.max(0, Math.min(...allScores) - 10);
  const maxScore = Math.min(100, Math.max(...allScores) + 10);

  if (compact) {
    return (
      <div className="bg-white rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">{title}</h4>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white rounded-xl shadow-sm p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          {title}
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-indigo-500" />
            <span className="text-gray-600">실제 점수</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-indigo-500 border-dashed" style={{ borderStyle: 'dashed' }} />
            <span className="text-gray-600">예측</span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDate(value)}
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
            />
            <YAxis
              domain={[minScore, maxScore]}
              tick={{ fontSize: 12 }}
              stroke="#9ca3af"
              tickFormatter={(value) => `${value}점`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* 목표선 */}
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

            {/* 실제 점수 라인 */}
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 4 }}
              activeDot={{ r: 6 }}
              name="실제 점수"
              connectNulls
            />

            {/* 예측 점수 라인 (점선) */}
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#a5b4fc"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#a5b4fc', r: 4 }}
              name="예측"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 예측 요약 */}
      {predictions && predictions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">예측 요약</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {predictions.map((pred, index) => (
              <motion.div
                key={index}
                custom={index}
                variants={predictionCardVariants}
                initial="hidden"
                animate="visible"
                className="bg-indigo-50 rounded-lg p-3 text-center"
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                <div className="text-xs text-indigo-700 mb-1">{pred.timeframe} 후</div>
                <div className="text-lg font-bold text-indigo-700">
                  {pred.predictedScore}점
                </div>
                <div className="text-xs text-gray-600">
                  신뢰도 {pred.confidenceLevel}%
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default memo(GrowthTrajectoryChart);
