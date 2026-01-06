'use client';

/**
 * ErrorPatternTrend Component
 *
 * 오류 패턴 추이를 시각화하는 컴포넌트
 * - 오류 유형별 분포
 * - 추이 (증가/감소/유지)
 * - 영역별 취약도
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

// 오류 유형 정의
type ErrorType = '개념 오류' | '절차 오류' | '계산 오류' | '문제 오독' | '기타/부주의';
type TrendType = 'increasing' | 'decreasing' | 'stable';

interface ErrorTypeData {
  type: ErrorType;
  frequency: number;
  recentTrend?: TrendType;
}

interface DomainVulnerability {
  domain: string;
  vulnerabilityScore: number;
  lastAssessed?: string;
}

interface ErrorPatternTrendProps {
  // 주요 오류 유형
  primaryErrorTypes?: ErrorTypeData[];
  // 특징적 오류 패턴 설명
  signaturePatterns?: string[];
  // 영역별 취약도
  domainVulnerability?: DomainVulnerability[];
  // 마지막 업데이트
  lastUpdated?: string;
  // 간소화 모드
  compact?: boolean;
}

// 오류 유형별 색상
const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  '개념 오류': '#ef4444', // red
  '절차 오류': '#f97316', // orange
  '계산 오류': '#eab308', // yellow
  '문제 오독': '#8b5cf6', // purple
  '기타/부주의': '#6b7280', // gray
};

// 추이 아이콘
function TrendIcon({ trend }: { trend: TrendType }) {
  if (trend === 'increasing') {
    return <span className="text-red-500">↑ 증가</span>;
  }
  if (trend === 'decreasing') {
    return <span className="text-green-500">↓ 감소</span>;
  }
  return <span className="text-gray-500">→ 유지</span>;
}

// 취약도 색상 결정
function getVulnerabilityColor(score: number): string {
  if (score >= 70) return '#ef4444'; // red - 심각
  if (score >= 50) return '#f97316'; // orange - 주의
  if (score >= 30) return '#eab308'; // yellow - 경계
  return '#22c55e'; // green - 양호
}

// 취약도 레벨 라벨
function getVulnerabilityLabel(score: number): string {
  if (score >= 70) return '심각';
  if (score >= 50) return '주의';
  if (score >= 30) return '경계';
  return '양호';
}

// 커스텀 툴팁
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ErrorTypeData }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium text-gray-900">{data.type}</p>
      <p className="text-lg font-bold" style={{ color: ERROR_TYPE_COLORS[data.type] }}>
        {data.frequency}%
      </p>
      {data.recentTrend && (
        <p className="text-xs mt-1">
          <TrendIcon trend={data.recentTrend} />
        </p>
      )}
    </div>
  );
}

export default function ErrorPatternTrend({
  primaryErrorTypes = [],
  signaturePatterns = [],
  domainVulnerability = [],
  lastUpdated,
  compact = false,
}: ErrorPatternTrendProps) {
  // 데이터가 없으면 표시하지 않음
  if (primaryErrorTypes.length === 0 && domainVulnerability.length === 0) {
    return null;
  }

  // 파이 차트 데이터 준비
  const pieData = primaryErrorTypes.map((item) => ({
    name: item.type,
    value: item.frequency,
    color: ERROR_TYPE_COLORS[item.type],
  }));

  // 취약도 데이터 정렬 (높은 순)
  const sortedVulnerabilities = [...domainVulnerability].sort(
    (a, b) => b.vulnerabilityScore - a.vulnerabilityScore
  );

  if (compact) {
    return (
      <div className="bg-white rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">오류 패턴</h4>
        <div className="flex flex-wrap gap-2">
          {primaryErrorTypes.slice(0, 3).map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
              style={{ backgroundColor: `${ERROR_TYPE_COLORS[item.type]}20` }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: ERROR_TYPE_COLORS[item.type] }}
              />
              <span style={{ color: ERROR_TYPE_COLORS[item.type] }}>
                {item.type} {item.frequency}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">🎯 오류 패턴 분석</h3>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            마지막 업데이트: {new Date(lastUpdated).toLocaleDateString('ko-KR')}
          </span>
        )}
      </div>

      {/* 오류 유형 분포 */}
      {primaryErrorTypes.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">오류 유형 분포</h4>
          <div className="grid md:grid-cols-2 gap-4">
            {/* 파이 차트 */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${value}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 오류 유형 리스트 */}
            <div className="space-y-2">
              {primaryErrorTypes.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg"
                  style={{ backgroundColor: `${ERROR_TYPE_COLORS[item.type]}10` }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ERROR_TYPE_COLORS[item.type] }}
                    />
                    <span className="text-sm font-medium text-gray-700">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold"
                      style={{ color: ERROR_TYPE_COLORS[item.type] }}
                    >
                      {item.frequency}%
                    </span>
                    {item.recentTrend && (
                      <span className="text-xs">
                        <TrendIcon trend={item.recentTrend} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 영역별 취약도 */}
      {sortedVulnerabilities.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3">영역별 취약도</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedVulnerabilities}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="domain" type="category" width={60} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`${value}% (${getVulnerabilityLabel(value)})`, '취약도']}
                />
                <Bar dataKey="vulnerabilityScore" radius={[0, 4, 4, 0]}>
                  {sortedVulnerabilities.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getVulnerabilityColor(entry.vulnerabilityScore)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 취약도 범례 */}
          <div className="flex justify-center gap-4 mt-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-gray-500">양호 (0-29)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <span className="text-gray-500">경계 (30-49)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span className="text-gray-500">주의 (50-69)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span className="text-gray-500">심각 (70+)</span>
            </div>
          </div>
        </div>
      )}

      {/* 특징적 오류 패턴 */}
      {signaturePatterns.length > 0 && (
        <div className="bg-orange-50 rounded-lg p-4">
          <h4 className="font-medium text-orange-800 mb-2">⚡ 특징적 오류 패턴</h4>
          <ul className="space-y-1">
            {signaturePatterns.map((pattern, index) => (
              <li key={index} className="text-sm text-orange-700 flex items-start gap-2">
                <span className="text-orange-500">•</span>
                {pattern}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
