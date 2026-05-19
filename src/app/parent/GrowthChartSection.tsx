import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

export interface ScoreTrendItem {
  date: string;
  name: string;
  shortName: string;
  score: number;
  maxScore: number;
  percentage: number;
  displayDate: string;
}

export interface MathCapabilityItem {
  subject: string;
  value: number;
  fullMark: number;
}

export type MathCapabilityView =
  | { status: 'available'; data: MathCapabilityItem[] }
  | { status: 'withheld'; data: null };

export interface GrowthChartSectionProps {
  scoreTrend: ScoreTrendItem[];
  mathCapability: MathCapabilityView | null;
  growthRate: number | null;
}

export default function GrowthChartSection({ scoreTrend, mathCapability, growthRate }: GrowthChartSectionProps) {
  const [activeTab, setActiveTab] = useState<'trend' | 'capability'>('trend');
  const mathCapabilityData = mathCapability?.status === 'available' ? mathCapability.data : null;
  const visibleTab = scoreTrend.length === 0 && mathCapability ? 'capability' : activeTab;

  if (scoreTrend.length === 0 && !mathCapability) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      {/* 헤더 및 탭 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">성장 분석</h3>
          {growthRate !== null && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              growthRate > 0
                ? 'bg-green-100 text-green-700'
                : growthRate < 0
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {growthRate > 0 ? '+' : ''}{growthRate}% 성장
            </span>
          )}
        </div>

        {/* 탭 버튼 */}
        {mathCapability && scoreTrend.length > 0 && (
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('trend')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                visibleTab === 'trend'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              점수 추이
            </button>
            <button
              onClick={() => setActiveTab('capability')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                visibleTab === 'capability'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              수학 역량
            </button>
          </div>
        )}
      </div>

      {/* 성적 추이 차트 */}
      {visibleTab === 'trend' && scoreTrend.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={scoreTrend}
              margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
            >
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ScoreTrendItem;
                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                        <p className="font-medium text-gray-900">{data.name}</p>
                        <p className="text-sm text-gray-500">{data.date}</p>
                        <p className="text-lg font-bold text-indigo-600 mt-1">
                          {data.score} / {data.maxScore}점 ({data.percentage}%)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="percentage"
                stroke="#6366f1"
                strokeWidth={3}
                fill="url(#colorScore)"
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#4f46e5' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 수학 역량 레이더 차트 */}
      {visibleTab === 'capability' && mathCapability?.status === 'withheld' && (
        <div className="h-72 flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-6 text-center">
          <p className="text-sm font-semibold text-amber-900">교사 확정값 기반 역량 분석 준비 중</p>
          <p className="mt-2 max-w-md text-sm text-amber-800">
            선생님이 AI 초안의 채점 또는 문항 판정을 보정했기 때문에, 이전 초안에서 만든 수학 역량 지표는 표시하지 않습니다.
          </p>
        </div>
      )}

      {visibleTab === 'capability' && mathCapabilityData && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mathCapabilityData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 12, fill: '#374151' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickCount={5}
              />
              <Radar
                name="수학 역량"
                dataKey="value"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Legend />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as MathCapabilityItem;
                    return (
                      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                        <p className="font-medium text-gray-900">{data.subject}</p>
                        <p className="text-lg font-bold text-purple-600">{data.value}점</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 추이 요약 */}
      {scoreTrend.length >= 2 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
              <span className="text-gray-600">
                최근 점수: <span className="font-semibold text-gray-900">{scoreTrend[scoreTrend.length - 1].percentage}%</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-300"></span>
              <span className="text-gray-600">
                이전 점수: <span className="font-semibold text-gray-900">{scoreTrend[scoreTrend.length - 2].percentage}%</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
