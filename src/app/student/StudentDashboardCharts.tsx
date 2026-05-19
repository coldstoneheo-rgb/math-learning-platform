import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from 'recharts';

interface ScoreTrendItem {
  name: string;
  score: number | undefined;
  date?: string;
}

interface CapabilityDataPoint {
  subject: string;
  value: number;
}

export type CapabilityView =
  | { status: 'available'; data: CapabilityDataPoint[] }
  | { status: 'withheld'; data: null };

interface StudentDashboardChartsProps {
  scoreTrendData: ScoreTrendItem[];
  capabilityView: CapabilityView | null;
}

export default function StudentDashboardCharts({ scoreTrendData, capabilityView }: StudentDashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">점수 추이</h2>
        {scoreTrendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240} minWidth={0}>
            <LineChart data={scoreTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
                formatter={(value) => [`${value ?? 0}점`, '점수']}
              />
              <Line
                type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3}
                dot={{ fill: '#6366f1', strokeWidth: 2 }} activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex flex-col items-center justify-center text-gray-400 gap-2">
            <span className="text-3xl">📝</span>
            <p className="text-sm">시험 분석 리포트가 생기면 그래프가 나타납니다</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">수학 역량</h2>
        {capabilityView?.status === 'available' ? (
          <ResponsiveContainer width="100%" height={240} minWidth={0}>
            <RadarChart data={capabilityView.data}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="역량" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
            </RadarChart>
          </ResponsiveContainer>
        ) : capabilityView?.status === 'withheld' ? (
          <div className="h-[240px] flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-5 text-center">
            <p className="text-sm font-semibold text-amber-900">교사 확정값 기반 역량 분석 준비 중</p>
            <p className="mt-2 text-sm text-amber-800">
              선생님이 보정한 확정값과 맞지 않을 수 있는 이전 역량 지표는 잠시 숨겨두었어요.
            </p>
          </div>
        ) : (
          <div className="h-[240px] flex flex-col items-center justify-center text-gray-400 gap-2">
            <span className="text-3xl">🧭</span>
            <p className="text-sm">역량 분석 데이터가 생기면 여기에 표시됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
