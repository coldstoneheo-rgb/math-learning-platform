'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';

const TeacherAnalyticsCharts = dynamic(
  () => import('./TeacherAnalyticsCharts'),
  { 
    ssr: false, 
    loading: () => (
      <div className="w-full flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 animate-pulse h-[300px]">
        <span className="text-gray-400">차트 데이터를 불러오는 중...</span>
      </div>
    )
  }
);

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

interface TopStrategy {
  type: string;
  title: string;
  concept: string | null;
  usageCount: number;
  avgImprovement: number;
  avgRating: number | null;
  successRate: number;
}

interface OverallStats {
  totalStudents: number;
  totalReports: number;
  avgScore: number;
  totalStrategies: number;
  avgImprovement: number;
  predictionAccuracy: number;
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalStudents: 0,
    totalReports: 0,
    avgScore: 0,
    totalStrategies: 0,
    avgImprovement: 0,
    predictionAccuracy: 0,
  });
  const [strategyEffectiveness, setStrategyEffectiveness] = useState<StrategyEffectiveness[]>([]);
  const [predictionStats, setPredictionStats] = useState<PredictionStats[]>([]);
  const [conceptImprovements, setConceptImprovements] = useState<ConceptImprovement[]>([]);
  const [topStrategies, setTopStrategies] = useState<TopStrategy[]>([]);
  const [scoresTrend, setScoresTrend] = useState<Array<{ month: string; avgScore: number }>>([]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'teacher') {
      router.push('/');
      return;
    }

    await loadAnalyticsData();
    setLoading(false);
  };

  const loadAnalyticsData = async () => {
    const supabase = createClient();

    // 1. Overall Stats
    const [studentsResult, reportsResult] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id, total_score', { count: 'exact' }),
    ]);

    const totalStudents = studentsResult.count || 0;
    const totalReports = reportsResult.count || 0;
    const reports = reportsResult.data || [];
    const avgScore = reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + (r.total_score || 0), 0) / reports.length)
      : 0;

    // 2. Strategy Effectiveness
    try {
      const effectivenessResponse = await fetch('/api/strategies/effectiveness');
      const effectivenessData = await effectivenessResponse.json();

      if (effectivenessData.success) {
        setStrategyEffectiveness(effectivenessData.effectivenessByType || []);
        setConceptImprovements(effectivenessData.improvementByConcept?.slice(0, 10) || []);
        setTopStrategies(effectivenessData.bestPatterns || []);

        setOverallStats(prev => ({
          ...prev,
          totalStudents,
          totalReports,
          avgScore,
          totalStrategies: effectivenessData.totalStats?.totalStrategies || 0,
          avgImprovement: Math.round((effectivenessData.totalStats?.avgImprovement || 0) * 10) / 10,
        }));
      }
    } catch (error) {
      console.error('Failed to load strategy effectiveness:', error);
    }

    // 3. Prediction Stats
    try {
      const predictionResponse = await fetch('/api/predictions/verify');
      const predictionData = await predictionResponse.json();

      if (predictionData.success) {
        setPredictionStats(predictionData.stats || []);

        // 전체 예측 정확도 계산
        const verifiedPredictions = (predictionData.stats || []).filter(
          (s: PredictionStats) => s.verified_count > 0
        );
        const totalAccurate = verifiedPredictions.reduce(
          (sum: number, s: PredictionStats) => sum + (s.accurate_count || 0), 0
        );
        const totalVerified = verifiedPredictions.reduce(
          (sum: number, s: PredictionStats) => sum + (s.verified_count || 0), 0
        );

        setOverallStats(prev => ({
          ...prev,
          predictionAccuracy: totalVerified > 0 ? Math.round(totalAccurate / totalVerified * 100) : 0,
        }));
      }
    } catch (error) {
      console.error('Failed to load prediction stats:', error);
    }

    // 4. Scores Trend (최근 6개월)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: trendData } = await supabase
      .from('reports')
      .select('test_date, total_score')
      .eq('report_type', 'test')
      .gte('test_date', sixMonthsAgo.toISOString().split('T')[0])
      .not('total_score', 'is', null)
      .order('test_date', { ascending: true });

    if (trendData) {
      // 월별로 그룹화
      const monthlyScores = new Map<string, number[]>();

      trendData.forEach(report => {
        const month = report.test_date.substring(0, 7); // YYYY-MM
        const scores = monthlyScores.get(month) || [];
        scores.push(report.total_score);
        monthlyScores.set(month, scores);
      });

      const trendChartData = Array.from(monthlyScores.entries())
        .map(([month, scores]) => ({
          month,
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setScoresTrend(trendChartData);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/teacher" className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-gray-800">데이터 분석 대시보드</h1>
          </div>
          <button
            onClick={() => loadAnalyticsData()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            새로고침
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Overall Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="전체 학생"
            value={overallStats.totalStudents}
            suffix="명"
            color="indigo"
          />
          <StatCard
            label="총 리포트"
            value={overallStats.totalReports}
            suffix="개"
            color="purple"
          />
          <StatCard
            label="평균 점수"
            value={overallStats.avgScore}
            suffix="점"
            color="cyan"
          />
          <StatCard
            label="추적 전략"
            value={overallStats.totalStrategies}
            suffix="개"
            color="emerald"
          />
          <StatCard
            label="평균 개선율"
            value={overallStats.avgImprovement}
            suffix="%"
            color="amber"
          />
          <StatCard
            label="예측 정확도"
            value={overallStats.predictionAccuracy}
            suffix="%"
            color="rose"
          />
        </div>

        <TeacherAnalyticsCharts
          scoresTrend={scoresTrend}
          strategyEffectiveness={strategyEffectiveness}
          predictionStats={predictionStats}
          conceptImprovements={conceptImprovements}
        />

        {/* Top Strategies Table */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">가장 효과적인 전략 TOP 10</h3>
          {topStrategies.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">순위</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">유형</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">전략명</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">대상 개념</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">사용 횟수</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">평균 개선율</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">성공률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topStrategies.map((strategy, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          strategy.type === '개념 교정' ? 'bg-blue-100 text-blue-700' :
                          strategy.type === '습관 교정' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {strategy.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800">{strategy.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{strategy.concept || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center text-gray-800">{strategy.usageCount}</td>
                      <td className="px-4 py-3 text-sm text-center font-medium text-green-600">
                        +{strategy.avgImprovement}%
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`font-medium ${
                          strategy.successRate >= 70 ? 'text-green-600' :
                          strategy.successRate >= 50 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {strategy.successRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              충분한 전략 데이터가 없습니다. 전략 효과를 추적하면 여기에 표시됩니다.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link
            href="/teacher/strategies"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            전략 관리
          </Link>
          <button
            onClick={async () => {
              const response = await fetch('/api/predictions/verify', { method: 'POST', body: JSON.stringify({}) });
              const data = await response.json();
              alert(`${data.verified || 0}개의 예측이 검증되었습니다.`);
              loadAnalyticsData();
            }}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            예측 검증 실행
          </button>
        </div>
      </main>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  suffix: string;
  color: 'indigo' | 'purple' | 'cyan' | 'emerald' | 'amber' | 'rose';
}

function StatCard({ label, value, suffix, color }: StatCardProps) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <div className={`rounded-xl p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">
        {value.toLocaleString()}<span className="text-lg">{suffix}</span>
      </p>
    </div>
  );
}
