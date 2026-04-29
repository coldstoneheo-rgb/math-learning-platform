'use client';

/**
 * GrowthRadarChart Component
 *
 * 월간 5개 역량을 레이더 차트로 시각화
 * - 개념이해도 / 문제풀이력 / 학습습관 / 숙제수행 / 시험성과
 * - 이번 달 vs 지난달 비교 (선택적)
 * - 부모 친화적 라벨과 설명
 */

import { memo } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export interface RadarCapabilityData {
  subject: string;
  subjectLabel: string;
  current: number;   // 0-100
  previous?: number; // 0-100, 지난달 비교용
  fullMark: number;
}

interface GrowthRadarChartProps {
  data: RadarCapabilityData[];
  studentName?: string;
  currentMonth?: string;
  previousMonth?: string;
  compact?: boolean;
}

const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  개념이해도: '배운 개념을 얼마나 잘 이해했는지',
  문제풀이력: '문제를 풀어내는 능력',
  학습습관: '규칙적인 학습 습관 정도',
  숙제수행: '숙제를 성실히 완료하는 정도',
  시험성과: '시험에서 실력 발휘 정도',
};

function GrowthRadarChart({
  data,
  studentName,
  currentMonth,
  previousMonth,
  compact = false,
}: GrowthRadarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">역량 데이터가 아직 없어요</p>
      </div>
    );
  }

  const hasPrevious = data.some((d) => d.previous !== undefined);
  const chartHeight = compact ? 200 : 300;

  // 강점/약점 계산
  const sortedByScore = [...data].sort((a, b) => b.current - a.current);
  const topStrength = sortedByScore[0];
  const topWeakness = sortedByScore[sortedByScore.length - 1];
  const avgScore = Math.round(data.reduce((sum, d) => sum + d.current, 0) / data.length);

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
          <Star className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-gray-800">월간 역량 분석</h3>
        </div>
        <div className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-sm font-medium">
          종합 {avgScore}점
        </div>
      </div>

      {/* Radar Chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="subjectLabel"
            tick={{ fontSize: compact ? 11 : 13, fill: '#4b5563' }}
          />
          <Tooltip
            formatter={(value, name) => {
              const label = name === 'current'
                ? (currentMonth || '이번 달')
                : (previousMonth || '지난달');
              return [`${value}점`, label];
            }}
            contentStyle={{
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '13px',
            }}
          />
          {hasPrevious && (
            <Radar
              name="previous"
              dataKey="previous"
              stroke="#d1d5db"
              fill="#d1d5db"
              fillOpacity={0.3}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          )}
          <Radar
            name="current"
            dataKey="current"
            stroke="#7c3aed"
            fill="#7c3aed"
            fillOpacity={0.35}
            strokeWidth={2.5}
          />
          {hasPrevious && !compact && (
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) =>
                value === 'current'
                  ? (currentMonth || '이번 달')
                  : (previousMonth || '지난달')
              }
            />
          )}
        </RadarChart>
      </ResponsiveContainer>

      {/* Capability Cards */}
      {!compact && (
        <div className="mt-4 grid grid-cols-5 gap-2">
          {data.map((item) => {
            const diff = hasPrevious && item.previous !== undefined
              ? item.current - item.previous
              : null;
            return (
              <div
                key={item.subject}
                className={`rounded-lg p-2 text-center ${
                  item.current >= 80
                    ? 'bg-green-50'
                    : item.current >= 60
                    ? 'bg-blue-50'
                    : 'bg-orange-50'
                }`}
              >
                <p className="text-xs text-gray-600 mb-1">{item.subjectLabel}</p>
                <p className={`text-lg font-bold ${
                  item.current >= 80
                    ? 'text-green-700'
                    : item.current >= 60
                    ? 'text-blue-700'
                    : 'text-orange-700'
                }`}>
                  {item.current}
                </p>
                {diff !== null && (
                  <p className={`text-xs ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {diff > 0 ? `+${diff}` : diff === 0 ? '→' : `${diff}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Insight */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start gap-2 bg-green-50 rounded-lg p-3">
          <span className="text-green-600 text-sm font-medium flex-shrink-0">강점</span>
          <p className="text-sm text-green-800">
            <span className="font-medium">{topStrength.subjectLabel}</span> — {topStrength.current}점으로 가장 뛰어나요.{' '}
            {CAPABILITY_DESCRIPTIONS[topStrength.subject] || ''}
          </p>
        </div>
        {topWeakness.current < 70 && (
          <div className="flex items-start gap-2 bg-orange-50 rounded-lg p-3">
            <span className="text-orange-600 text-sm font-medium flex-shrink-0">집중</span>
            <p className="text-sm text-orange-800">
              <span className="font-medium">{topWeakness.subjectLabel}</span> — {topWeakness.current}점.{' '}
              다음 달 집중 개선이 필요해요.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(GrowthRadarChart);

/**
 * 월간 데이터로부터 RadarCapabilityData 생성 헬퍼
 */
export function buildRadarData(input: {
  averageUnderstanding: number;   // 1-5
  averageAttention: number;       // 1-5
  habitScore?: number;            // 0-100
  assignmentCompletionRate: number; // 0-100
  testAverageScore?: number;      // 0-100
  previousData?: {
    averageUnderstanding: number;
    averageAttention: number;
    habitScore?: number;
    assignmentCompletionRate: number;
    testAverageScore?: number;
  };
}): RadarCapabilityData[] {
  // 1-5 스케일 → 0-100 변환
  const toScore = (val: number, max = 5) =>
    Math.round(((val - 1) / (max - 1)) * 100);

  return [
    {
      subject: '개념이해도',
      subjectLabel: '개념\n이해도',
      current: toScore(input.averageUnderstanding),
      previous: input.previousData
        ? toScore(input.previousData.averageUnderstanding)
        : undefined,
      fullMark: 100,
    },
    {
      subject: '문제풀이력',
      subjectLabel: '문제\n풀이력',
      current: toScore(input.averageAttention),
      previous: input.previousData
        ? toScore(input.previousData.averageAttention)
        : undefined,
      fullMark: 100,
    },
    {
      subject: '학습습관',
      subjectLabel: '학습\n습관',
      current: input.habitScore ?? 50,
      previous: input.previousData?.habitScore,
      fullMark: 100,
    },
    {
      subject: '숙제수행',
      subjectLabel: '숙제\n수행',
      current: Math.round(input.assignmentCompletionRate),
      previous: input.previousData
        ? Math.round(input.previousData.assignmentCompletionRate)
        : undefined,
      fullMark: 100,
    },
    {
      subject: '시험성과',
      subjectLabel: '시험\n성과',
      current: input.testAverageScore ?? 50,
      previous: input.previousData?.testAverageScore,
      fullMark: 100,
    },
  ];
}
