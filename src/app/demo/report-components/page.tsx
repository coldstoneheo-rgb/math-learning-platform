'use client';

/**
 * Report Components Demo Page
 *
 * Phase 1-6 컴포넌트들의 시각적 테스트를 위한 데모 페이지
 */

import { useState } from 'react';
import {
  MomentumGauge,
  MomentumBadge,
  buildRadarData,
  WeaknessResolutionMap,
  buildWeaknessItems,
  MetaProfileComparison,
  buildMetaProfileMetrics,
  AnnualGrowthStory,
} from '@/components/report';
import dynamic from 'next/dynamic';
import ChartSkeleton from '@/components/common/ChartSkeleton';

const HabitTrendChart = dynamic(() => import('@/components/report').then(mod => mod.HabitTrendChart), { ssr: false, loading: () => <ChartSkeleton height={300} /> });
const MonthlyRadarChart = dynamic(() => import('@/components/report').then(mod => mod.MonthlyRadarChart), { ssr: false, loading: () => <ChartSkeleton height={300} /> });
const TrajectoryAreaChart = dynamic(() => import('@/components/report').then(mod => mod.TrajectoryAreaChart), { ssr: false, loading: () => <ChartSkeleton height={300} /> });

// Sample data for demos
const habitTrendData = [
  { weekNumber: 1, weekLabel: '3/4', habitScore: 62, assignmentCompletion: 24, focusLevel: 18, understandingLevel: 20 },
  { weekNumber: 2, weekLabel: '3/11', habitScore: 58, assignmentCompletion: 20, focusLevel: 18, understandingLevel: 20 },
  { weekNumber: 3, weekLabel: '3/18', habitScore: 71, assignmentCompletion: 32, focusLevel: 21, understandingLevel: 18 },
  { weekNumber: 4, weekLabel: '3/25', habitScore: 68, assignmentCompletion: 28, focusLevel: 20, understandingLevel: 20 },
  { weekNumber: 5, weekLabel: '4/1', habitScore: 75, assignmentCompletion: 32, focusLevel: 22, understandingLevel: 21 },
  { weekNumber: 6, weekLabel: '4/8', habitScore: 72, assignmentCompletion: 28, focusLevel: 24, understandingLevel: 20 },
  { weekNumber: 7, weekLabel: '4/15', habitScore: 80, assignmentCompletion: 36, focusLevel: 24, understandingLevel: 20 },
  { weekNumber: 8, weekLabel: '4/22', habitScore: 85, assignmentCompletion: 38, focusLevel: 25, understandingLevel: 22 },
];

const radarData = [
  { subject: 'conceptUnderstanding', subjectLabel: '개념\n이해', current: 78, previous: 65, fullMark: 100 },
  { subject: 'problemSolving', subjectLabel: '문제\n풀이', current: 72, previous: 68, fullMark: 100 },
  { subject: 'learningHabit', subjectLabel: '학습\n습관', current: 85, previous: 70, fullMark: 100 },
  { subject: 'assignmentPerformance', subjectLabel: '숙제\n수행', current: 90, previous: 75, fullMark: 100 },
  { subject: 'testPerformance', subjectLabel: '시험\n성과', current: 76, previous: 72, fullMark: 100 },
];

const weaknessItems = buildWeaknessItems(
  ['분수의 나눗셈', '방정식 이항'],
  ['소수점 계산'],
  ['다항식 전개']
);

const trajectoryData = [
  { month: '1월', score: 65 },
  { month: '2월', score: 68, milestone: '분수 개념 정복' },
  { month: '3월', score: 72 },
  { month: '4월', score: 78, milestone: '방정식 기초 완성' },
  { month: '5월', score: 82 },
  { month: '6월', score: 88, milestone: '상위권 진입' },
];

const metaProfileEvolution = {
  absorptionRateChange: { previous: 65, current: 78, trend: 'improving' as const },
  staminaChange: { previous: 58, current: 72, trend: 'improving' as const },
  metaCognitionChange: { previous: 45, current: 52, trend: 'stable' as const },
  errorSignatureChange: { overallTrend: 'improving' as const },
};

const growthStoryData = {
  beginningState: {
    date: '2025-01',
    description: '분수 개념이 약하고 계산 실수가 잦았어요',
    keyMetrics: { 평균점수: 65, 이해도: 58 },
  },
  majorMilestones: [
    { date: '2025-02', milestone: '분수 개념 정복', significance: '분모가 다른 분수 덧셈/뺄셈 마스터' },
    { date: '2025-04', milestone: '방정식 기초 완성', significance: '일차방정식 문제 해결력 향상' },
    { date: '2025-06', milestone: '상위권 진입', significance: '평균 85점 이상 유지' },
  ],
  turningPoints: [
    { date: '2025-03', event: '학습 습관 개선', impact: '숙제 완료율 90% 이상으로 향상' },
  ],
  endingState: {
    date: '2025-06',
    description: '자기주도 학습 능력이 크게 성장했어요',
    keyMetrics: { 평균점수: 88, 이해도: 85 },
  },
  narrativeSummary: '1년간 꾸준한 노력으로 분수 개념을 완전히 이해하고, 방정식 문제 해결력을 키웠습니다. 특히 학습 습관이 크게 개선되어 상위권으로 도약했습니다. 앞으로도 이 성장세를 유지하면 더 큰 성취를 이룰 수 있어요!',
};

export default function ReportComponentsDemo() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'macro' | 'dashboard'>('weekly');

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Components Demo</h1>
        <p className="text-gray-600 mb-6">Phase 1-6 리포트 컴포넌트 시각적 테스트</p>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'weekly', label: '주간 리포트 (Phase 1)' },
            { key: 'monthly', label: '월간 리포트 (Phase 2)' },
            { key: 'macro', label: '반기/연간 (Phase 3)' },
            { key: 'dashboard', label: '부모 대시보드 (Phase 6)' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Weekly Report Components */}
        {activeTab === 'weekly' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Phase 1: 주간 리포트 컴포넌트</h2>

            {/* MomentumGauge */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-700 mb-4">MomentumGauge — 성장 모멘텀 게이지</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-2">상승 중 (Rising)</p>
                  <MomentumGauge status="rising" habitScore={85} statusLabel="빠르게 성장하고 있어요!" weeklyComparison="지난주 대비 습관 점수가 10점 올랐어요" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">유지 중 (Steady)</p>
                  <MomentumGauge status="steady" habitScore={72} statusLabel="꾸준히 유지하고 있어요" weeklyComparison="지난주와 비슷한 수준이에요" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-2">관심 필요 (Needs Attention)</p>
                  <MomentumGauge status="needs_attention" habitScore={45} statusLabel="조금 더 집중이 필요해요" weeklyComparison="지난주 대비 습관 점수가 떨어졌어요" />
                </div>
              </div>
            </div>

            {/* MomentumBadge */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-700 mb-4">MomentumBadge — 인라인 배지</h3>
              <div className="flex gap-4 flex-wrap">
                <MomentumBadge status="rising" label="상승 중" />
                <MomentumBadge status="steady" label="유지 중" />
                <MomentumBadge status="needs_attention" label="관심 필요" />
              </div>
            </div>

            {/* HabitTrendChart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-700 mb-4">HabitTrendChart — 학습 습관 추이 (8주)</h3>
              <HabitTrendChart data={habitTrendData} showBreakdown={true} />
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-700 mb-4">HabitTrendChart — Compact 모드</h3>
              <HabitTrendChart data={habitTrendData} compact={true} />
            </div>
          </div>
        )}

        {/* Monthly Report Components */}
        {activeTab === 'monthly' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Phase 2: 월간 리포트 컴포넌트</h2>

            {/* GrowthRadarChart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-700 mb-4">GrowthRadarChart — 5축 역량 레이더</h3>
              <MonthlyRadarChart data={radarData} studentName="홍길동" />
            </div>

            {/* WeaknessResolutionMap */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-medium text-gray-700 mb-4">WeaknessResolutionMap — 취약점 해결 현황</h3>
              <WeaknessResolutionMap weaknesses={weaknessItems} studentName="홍길동" />
            </div>

            {/* Monthly Growth Summary Banner */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl p-4 text-white flex items-center gap-4">
              <span className="text-4xl">📈</span>
              <div>
                <p className="font-bold text-lg leading-tight">이번 달 큰 성장을 보였어요!</p>
                <p className="text-violet-100 text-sm mt-0.5">학습 습관이 15% 향상되었습니다</p>
              </div>
            </div>
          </div>
        )}

        {/* Macro Loop Components */}
        {activeTab === 'macro' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Phase 3: 반기/연간 리포트 컴포넌트</h2>

            {/* TrajectoryAreaChart */}
            <div>
              <h3 className="font-medium text-gray-700 mb-4">TrajectoryAreaChart — 성장 궤적</h3>
              <TrajectoryAreaChart
                data={trajectoryData}
                startScore={65}
                currentScore={88}
                growthRate={35}
                growthType="exponential"
                title="상반기 성장 궤적"
              />
            </div>

            {/* MetaProfileComparison */}
            <div>
              <h3 className="font-medium text-gray-700 mb-4">MetaProfileComparison — 학습 역량 변화</h3>
              <MetaProfileComparison
                metrics={buildMetaProfileMetrics(metaProfileEvolution)}
                period="2025 상반기"
              />
            </div>

            {/* AnnualGrowthStory */}
            <div>
              <h3 className="font-medium text-gray-700 mb-4">AnnualGrowthStory — 1년 성장 스토리</h3>
              <AnnualGrowthStory
                growthStory={growthStoryData}
                growthCategory="excellent"
                overallGrowthRate={35}
              />
            </div>
          </div>
        )}

        {/* Parent Dashboard Components */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800">Phase 6: 부모 대시보드</h2>

            {/* Dashboard HabitTrendChart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 학습 습관 추이</h3>
              <HabitTrendChart data={habitTrendData} showBreakdown={true} />
            </div>

            {/* Report Cards with Key Metrics */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">리포트 목록 (핵심 지표 표시)</h3>
              <div className="space-y-3">
                {/* Weekly Report Card */}
                <div className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded mb-1.5 bg-green-100 text-green-700">
                        주간 리포트
                      </span>
                      <h4 className="font-medium text-gray-900">4월 3주차 주간 리포트</h4>
                      <p className="text-sm text-gray-500 mt-0.5">2025.04.22</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-green-600">85점</div>
                      <div className="text-xs text-gray-500">습관</div>
                    </div>
                  </div>
                </div>

                {/* Monthly Report Card */}
                <div className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded mb-1.5 bg-purple-100 text-purple-700">
                        월간 리포트
                      </span>
                      <h4 className="font-medium text-gray-900">4월 월간 종합 리포트</h4>
                      <p className="text-sm text-gray-500 mt-0.5">2025.04.30</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-gray-700">📈</div>
                      <div className="text-xs text-gray-500">성장</div>
                    </div>
                  </div>
                </div>

                {/* Semi-annual Report Card */}
                <div className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded mb-1.5 bg-indigo-100 text-indigo-700">
                        반기 종합
                      </span>
                      <h4 className="font-medium text-gray-900">2025 상반기 종합 리포트</h4>
                      <p className="text-sm text-gray-500 mt-0.5">2025.06.30</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-emerald-600">+35%</div>
                      <div className="text-xs text-gray-500">성장률</div>
                    </div>
                  </div>
                </div>

                {/* Test Report Card */}
                <div className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded mb-1.5 bg-blue-100 text-blue-700">
                        시험 분석
                      </span>
                      <h4 className="font-medium text-gray-900">4월 단원평가</h4>
                      <p className="text-sm text-gray-500 mt-0.5">2025.04.15</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-indigo-600">88</div>
                      <div className="text-xs text-gray-500">/ 100점</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Demo page for visual testing — Not for production</p>
        </div>
      </div>
    </div>
  );
}
