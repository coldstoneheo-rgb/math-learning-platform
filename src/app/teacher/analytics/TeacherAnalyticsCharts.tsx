import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface StrategyEffectiveness {
  type: string;
  totalCount: number;
  completedCount: number;
  completionRate: number;
  avgImprovement: number;
  avgRating: number;
  successRate: number;
}

interface PredictionStats {
  timeframe: string;
  total_predictions: number;
  verified_count: number;
  accurate_count: number;
  accuracy_rate: number | null;
  avg_error_percentage: number | null;
}

interface ConceptImprovement {
  concept: string;
  occurrenceCount: number;
  avgImprovement: number;
  totalImprovement: number;
}

interface TeacherAnalyticsChartsProps {
  scoresTrend: Array<{ month: string; avgScore: number }>;
  strategyEffectiveness: StrategyEffectiveness[];
  predictionStats: PredictionStats[];
  conceptImprovements: ConceptImprovement[];
}

export default function TeacherAnalyticsCharts({
  scoresTrend,
  strategyEffectiveness,
  predictionStats,
  conceptImprovements,
}: TeacherAnalyticsChartsProps) {
  return (
    <>
      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 성적 추이 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">성적 추이 (최근 6개월)</h3>
          {scoresTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scoresTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  name="평균 점수"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              데이터가 없습니다
            </div>
          )}
        </div>

        {/* 전략 유형별 효과 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">전략 유형별 효과</h3>
          {strategyEffectiveness.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={strategyEffectiveness}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="type" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgImprovement" name="평균 개선율(%)" fill="#6366f1" />
                <Bar dataKey="successRate" name="성공률(%)" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              전략 데이터가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 예측 정확도 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">예측 정확도 (기간별)</h3>
          {predictionStats.length > 0 && predictionStats.some(s => s.verified_count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={predictionStats.filter(s => s.verified_count > 0)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timeframe" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="accuracy_rate" name="정확도(%)" fill="#8b5cf6" />
                <Bar dataKey="avg_error_percentage" name="평균 오차(%)" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              검증된 예측 데이터가 없습니다
            </div>
          )}
        </div>

        {/* 개념별 개선 현황 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">개념별 개선 현황 (Top 10)</h3>
          {conceptImprovements.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={conceptImprovements}
                layout="vertical"
                margin={{ left: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="concept" type="category" width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalImprovement" name="총 개선율(%)" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              개념별 데이터가 없습니다
            </div>
          )}
        </div>
      </div>
    </>
  );
}
