'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, Report, AnalysisData, WeeklyReportAnalysis, Notification, ParentChecklist } from '@/types';
import { HabitTrendChart } from '@/components/report';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import {
  LineChart,
  Line,
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
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface StudentWithReports extends Student {
  reports: Report[];
}

export default function ParentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<StudentWithReports[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<StudentWithReports | null>(null);
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');
  // Phase 5: 알림 및 체크리스트 상태
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [checklistSummary, setChecklistSummary] = useState<{ completed: number; total: number } | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (!userData) {
      router.push('/login');
      return;
    }

    // 선생님이면 admin으로 리다이렉트
    if (userData.role === 'teacher') {
      router.push('/teacher');
      return;
    }

    // 학부모가 아니면 접근 불가
    if (userData.role !== 'parent') {
      router.push('/');
      return;
    }

    setUser(userData);
    await loadChildren(authUser.id);
    // Phase 5: 알림 및 체크리스트 로드
    await loadUnreadNotifications(authUser.id);
    setLoading(false);
  };

  const loadUnreadNotifications = async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setUnreadNotifications(data as Notification[]);
  };

  const markNotificationRead = async (notificationId: number) => {
    const supabase = createClient();
    await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    setUnreadNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const loadChecklistSummary = async (userId: string, studentId: number) => {
    const supabase = createClient();
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    const weekStart = monday.toISOString().split('T')[0];

    const { data } = await supabase
      .from('parent_checklists')
      .select('items')
      .eq('parent_id', userId)
      .eq('student_id', studentId)
      .eq('week_start_date', weekStart)
      .single();

    if (data) {
      const items = (data as ParentChecklist).items;
      setChecklistSummary({
        completed: items.filter(i => i.completed).length,
        total: items.length,
      });
    } else {
      setChecklistSummary(null);
    }
  };


  const loadChildren = async (parentId: string) => {
    const supabase = createClient();

    // 연결된 자녀 조회
    const { data: studentData, error } = await supabase
      .from('students')
      .select('*')
      .eq('parent_id', parentId);

    if (error) {
      console.error('자녀 정보 조회 오류:', error);
      return;
    }

    // 각 자녀의 리포트 병렬 조회 (성능 최적화)
    const reportPromises = (studentData || []).map(student =>
      supabase
        .from('reports')
        .select('*')
        .eq('student_id', student.id)
        .order('test_date', { ascending: false })
    );

    const reportResults = await Promise.all(reportPromises);

    const childrenWithReports: StudentWithReports[] = (studentData || []).map((student, index) => ({
      ...student,
      reports: reportResults[index]?.data || [],
    }));

    setChildren(childrenWithReports);
    if (childrenWithReports.length > 0) {
      setSelectedChild(childrenWithReports[0]);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초등학교 ${grade}학년`;
    if (grade <= 9) return `중학교 ${grade - 6}학년`;
    return `고등학교 ${grade - 9}학년`;
  };

  const getReportTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      level_test: '레벨 테스트',
      test: '시험 분석',
      weekly: '주간 리포트',
      monthly: '월간 리포트',
      semi_annual: '반기 종합',
      annual: '연간 종합',
      consolidated: '통합 분석',
      self_analysis: '내 풀이 분석',
    };
    return labels[type] || type;
  };

  const getReportTypeBadgeColor = (type: string): string => {
    const colors: Record<string, string> = {
      level_test: 'bg-red-100 text-red-700',
      test: 'bg-blue-100 text-blue-700',
      weekly: 'bg-green-100 text-green-700',
      monthly: 'bg-purple-100 text-purple-700',
      semi_annual: 'bg-indigo-100 text-indigo-700',
      annual: 'bg-amber-100 text-amber-700',
      consolidated: 'bg-orange-100 text-orange-700',
      self_analysis: 'bg-emerald-100 text-emerald-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  // 리포트 타입별 핵심 지표 추출
  const getReportKeyMetric = (report: Report): { label: string; value: string; color: string } | null => {
    const raw = report.analysis_data as unknown as Record<string, unknown>;
    const reportType = report.report_type;

    if (reportType === 'weekly') {
      const analysis = (raw?.aiAnalysis ?? raw) as WeeklyReportAnalysis | null;
      const score = analysis?.habitScore?.score ?? analysis?.microLoopFeedback?.continuityScore;
      if (score) {
        const color = score >= 70 ? 'text-green-600' : score >= 50 ? 'text-blue-600' : 'text-amber-600';
        return { label: '습관', value: `${score}점`, color };
      }
    }

    if (reportType === 'monthly') {
      const analysis = raw as { aiAnalysis?: { monthlyGrowthSummary?: { growthEmoji?: string } } };
      const emoji = analysis?.aiAnalysis?.monthlyGrowthSummary?.growthEmoji;
      if (emoji) {
        return { label: '성장', value: emoji, color: 'text-gray-700' };
      }
    }

    if (reportType === 'semi_annual') {
      const analysis = raw as { growthTrajectory?: { growthRate?: number } };
      const rate = analysis?.growthTrajectory?.growthRate;
      if (rate !== undefined) {
        const color = rate > 0 ? 'text-emerald-600' : rate < 0 ? 'text-red-600' : 'text-gray-600';
        return { label: '성장률', value: `${rate > 0 ? '+' : ''}${rate}%`, color };
      }
    }

    if (reportType === 'annual') {
      const analysis = raw as { baselineComparison?: { overallGrowthRate?: number } };
      const rate = analysis?.baselineComparison?.overallGrowthRate;
      if (rate !== undefined) {
        const color = rate > 0 ? 'text-emerald-600' : rate < 0 ? 'text-red-600' : 'text-gray-600';
        return { label: '연간', value: `${rate > 0 ? '+' : ''}${rate}%`, color };
      }
    }

    if (reportType === 'self_analysis') {
      const analysis = raw as { comparisonWithHistory?: { overallTrend?: string } };
      const trend = analysis?.comparisonWithHistory?.overallTrend;
      if (trend) {
        const emoji = trend === 'improving' ? '📈' : trend === 'stable' ? '➡️' : '📌';
        return { label: '추세', value: emoji, color: 'text-gray-700' };
      }
    }

    return null;
  };

  // 최근 10개 시험의 점수 추이 계산 (차트용)
  const getScoreTrend = (reports: Report[]) => {
    return reports
      .filter(r => r.report_type === 'test' && r.total_score && r.max_score)
      .slice(0, 10)
      .reverse()
      .map(r => ({
        date: r.test_date || '',
        name: r.test_name || '',
        shortName: (r.test_name || '').length > 8
          ? (r.test_name || '').substring(0, 8) + '...'
          : (r.test_name || ''),
        score: r.total_score || 0,
        maxScore: r.max_score || 100,
        percentage: Math.round(((r.total_score || 0) / (r.max_score || 100)) * 100),
        displayDate: r.test_date
          ? new Date(r.test_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
          : '',
      }));
  };

  // 수학 역량 레이더 차트 데이터 추출
  const getMathCapabilityData = (reports: Report[]) => {
    const latestReport = reports.find(r =>
      r.report_type === 'test' &&
      r.analysis_data &&
      (r.analysis_data as AnalysisData).macroAnalysis?.mathCapability
    );

    if (!latestReport) return null;

    const capability = (latestReport.analysis_data as AnalysisData).macroAnalysis?.mathCapability;
    if (!capability) return null;

    return [
      { subject: '계산 속도', value: capability.calculationSpeed, fullMark: 100 },
      { subject: '계산 정확도', value: capability.calculationAccuracy, fullMark: 100 },
      { subject: '응용력', value: capability.applicationAbility, fullMark: 100 },
      { subject: '논리력', value: capability.logic, fullMark: 100 },
      { subject: '불안 조절', value: capability.anxietyControl, fullMark: 100 },
    ];
  };

  // 성장률 계산 (최근 5개 vs 이전 5개)
  const getGrowthRate = (reports: Report[]) => {
    const testReports = reports
      .filter(r => r.report_type === 'test' && r.total_score && r.max_score)
      .map(r => ((r.total_score || 0) / (r.max_score || 100)) * 100);

    if (testReports.length < 2) return null;

    const recentAvg = testReports.slice(0, Math.min(5, Math.floor(testReports.length / 2)))
      .reduce((a, b) => a + b, 0) / Math.min(5, Math.floor(testReports.length / 2));
    const pastAvg = testReports.slice(Math.min(5, Math.floor(testReports.length / 2)))
      .reduce((a, b) => a + b, 0) / (testReports.length - Math.min(5, Math.floor(testReports.length / 2)));

    return Math.round(recentAvg - pastAvg);
  };

  // 최근 8주 학습 습관 데이터 추출 (주간 리포트 기반)
  const getHabitTrendData = (reports: Report[]) => {
    const weeklyReports = reports
      .filter(r => r.report_type === 'weekly' && r.analysis_data)
      .slice(0, 8)
      .reverse();

    if (weeklyReports.length === 0) return [];

    return weeklyReports.map((report, idx) => {
      const raw = report.analysis_data as unknown as Record<string, unknown>;
      const analysis = (raw?.aiAnalysis ?? raw) as WeeklyReportAnalysis | null;
      const habitScore = analysis?.habitScore?.score ?? analysis?.microLoopFeedback?.continuityScore ?? 0;
      const breakdown = analysis?.habitScore?.breakdown;

      const weekDate = report.test_date ? new Date(report.test_date) : new Date(report.created_at);
      const weekLabel = weekDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

      return {
        weekNumber: idx + 1,
        weekLabel,
        habitScore,
        assignmentCompletion: breakdown?.assignmentCompletion,
        focusLevel: breakdown?.focusLevel,
        understandingLevel: breakdown?.understandingLevel,
      };
    });
  };

  // 평균 점수 계산
  const getAverageScore = (reports: Report[]) => {
    const testReports = reports.filter(r => r.report_type === 'test' && r.total_score && r.max_score);
    if (testReports.length === 0) return null;

    const totalPercentage = testReports.reduce((sum, r) => {
      return sum + ((r.total_score || 0) / (r.max_score || 100)) * 100;
    }, 0);

    return Math.round(totalPercentage / testReports.length);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm relative">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-600">수학 학습 분석</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">{user?.name}님</span>

            {/* 알림 벨 (Phase 5) */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(prev => !prev)}
                className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors"
                aria-label="알림"
              >
                <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                  </span>
                )}
              </button>

              {/* 알림 드롭다운 */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <h3 className="font-semibold text-gray-800 text-sm">알림</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {unreadNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">새 알림이 없습니다</div>
                    ) : (
                      unreadNotifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => { markNotificationRead(n.id); setShowNotifications(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors border border-gray-200 rounded-lg"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 py-8">
        {children.length === 0 ? (
          /* 연결된 자녀 없음 */
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">👨‍👩‍👧</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">연결된 자녀가 없습니다</h2>
            <p className="text-gray-500">
              선생님에게 자녀 연결을 요청해주세요.
            </p>
          </div>
        ) : (
          <>
            {/* 자녀 선택 (여러 명인 경우) */}
            {children.length > 1 && (
              <div className="mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedChild(child)}
                      className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                        selectedChild?.id === child.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedChild && (
              <>
                {/* 자녀 정보 카드 */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 mb-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold mb-1">{selectedChild.name}</h2>
                      <p className="text-indigo-100">{getGradeLabel(selectedChild.grade)}</p>
                      {selectedChild.school && (
                        <p className="text-indigo-100 text-sm mt-1">{selectedChild.school}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-indigo-100">평균 점수</div>
                      <div className="text-3xl font-bold">
                        {getAverageScore(selectedChild.reports) !== null
                          ? `${getAverageScore(selectedChild.reports)}점`
                          : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 통계 카드 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <StatCard
                    label="총 리포트"
                    value={selectedChild.reports.length}
                    unit="개"
                  />
                  <StatCard
                    label="시험 분석"
                    value={selectedChild.reports.filter(r => r.report_type === 'test').length}
                    unit="건"
                  />
                  <StatCard
                    label="최근 점수"
                    value={
                      selectedChild.reports.find(r => r.report_type === 'test')?.total_score || '-'
                    }
                    unit={selectedChild.reports.find(r => r.report_type === 'test')?.total_score ? '점' : ''}
                  />
                  <StatCard
                    label="최고 점수"
                    value={
                      Math.max(
                        ...selectedChild.reports
                          .filter(r => r.report_type === 'test' && r.total_score)
                          .map(r => r.total_score || 0),
                        0
                      ) || '-'
                    }
                    unit={selectedChild.reports.some(r => r.total_score) ? '점' : ''}
                  />
                </div>

                {/* Phase 5: 체크리스트 요약 위젯 */}
                {user && (() => {
                  const pct = checklistSummary ? Math.round((checklistSummary.completed / checklistSummary.total) * 100) : 0;
                  const hasPending = checklistSummary && checklistSummary.completed < checklistSummary.total;
                  return (
                    <a
                      href="/parent/checklist"
                      onClick={() => user && loadChecklistSummary(user.id, selectedChild.id)}
                      className={`block rounded-xl p-5 mb-6 transition-all hover:shadow-md ${
                        !checklistSummary
                          ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                          : pct === 100
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                          : hasPending
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                          : 'bg-white border border-gray-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {!checklistSummary ? '📋' : pct === 100 ? '🎉' : hasPending ? '⚡' : '✅'}
                          </span>
                          <div>
                            <h3 className="font-semibold text-sm">
                              {!checklistSummary
                                ? '이번 주 가이드 체크리스트'
                                : pct === 100
                                ? '이번 주 체크리스트 완료!'
                                : `${checklistSummary.completed}/${checklistSummary.total}개 완료`}
                            </h3>
                            <p className={`text-xs mt-0.5 ${
                              !checklistSummary || hasPending || pct === 100 ? 'text-white/80' : 'text-gray-400'
                            }`}>
                              {!checklistSummary
                                ? '탭하여 이번 주 가이드를 확인하세요'
                                : pct === 100
                                ? '훌륭한 한 주였어요!'
                                : `${checklistSummary.total - checklistSummary.completed}개 항목이 남아있어요`}
                            </p>
                          </div>
                        </div>
                        {checklistSummary && (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-white/30 rounded-full overflow-hidden">
                              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm font-bold">{pct}%</span>
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })()}

                {/* Growth Loop 진행 상황 */}
                <GrowthLoopStatus reports={selectedChild.reports} />


                {/* 성장 그래프 섹션 */}
                <GrowthChartSection
                  scoreTrend={getScoreTrend(selectedChild.reports)}
                  mathCapability={getMathCapabilityData(selectedChild.reports)}
                  growthRate={getGrowthRate(selectedChild.reports)}
                />

                {/* 학습 습관 추이 (최근 8주) */}
                {getHabitTrendData(selectedChild.reports).length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 학습 습관 추이</h3>
                    <HabitTrendChart
                      data={getHabitTrendData(selectedChild.reports)}
                      showBreakdown={true}
                      compact={false}
                    />
                  </div>
                )}

                {/* 아이 풀이 분석받기 배너 */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-5 mb-6 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">📸</span>
                      <div>
                        <h3 className="font-bold mb-0.5">아이 풀이를 AI가 분석해드려요</h3>
                        <p className="text-emerald-100 text-xs">
                          풀이 사진을 올리면 누적 학습 데이터와 비교하여 성장 분석을 제공합니다.
                        </p>
                      </div>
                    </div>
                    <a
                      href="/parent/self-analysis/new"
                      className="flex-shrink-0 px-4 py-2 bg-white text-emerald-700 font-semibold rounded-lg hover:bg-emerald-50 transition-colors text-sm"
                    >
                      분석받기 →
                    </a>
                  </div>
                </div>

                {/* 리포트 목록 */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <h3 className="text-lg font-semibold text-gray-900">
                      리포트 목록
                      <span className="ml-2 text-sm font-normal text-gray-400">
                        ({selectedChild.reports.filter(r => reportTypeFilter === 'all' || r.report_type === reportTypeFilter).length}개)
                      </span>
                    </h3>
                    {/* 타입 필터 */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { value: 'all', label: '전체' },
                        { value: 'test', label: '시험' },
                        { value: 'level_test', label: '레벨테스트' },
                        { value: 'weekly', label: '주간' },
                        { value: 'monthly', label: '월간' },
                        { value: 'semi_annual', label: '반기' },
                        { value: 'annual', label: '연간' },
                        { value: 'self_analysis', label: '내 풀이' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setReportTypeFilter(opt.value)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            reportTypeFilter === opt.value
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedChild.reports.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">아직 생성된 리포트가 없습니다.</p>
                  ) : (
                    <>
                      {selectedChild.reports.filter(r => reportTypeFilter === 'all' || r.report_type === reportTypeFilter).length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <p className="text-sm">해당 유형의 리포트가 없습니다.</p>
                          <button onClick={() => setReportTypeFilter('all')} className="mt-2 text-xs text-indigo-500 hover:underline">
                            전체 보기
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedChild.reports
                            .filter(r => reportTypeFilter === 'all' || r.report_type === reportTypeFilter)
                            .map((report) => (
                              <a
                                key={report.id}
                                href={`/parent/reports/${report.id}`}
                                className="block p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                              >
                                <div className="flex justify-between items-start gap-3">
                                  <div className="min-w-0">
                                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded mb-1.5 ${getReportTypeBadgeColor(report.report_type)}`}>
                                      {getReportTypeLabel(report.report_type)}
                                    </span>
                                    <h4 className="font-medium text-gray-900 truncate">{report.test_name || '리포트'}</h4>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                      {report.test_date || new Date(report.created_at).toLocaleDateString('ko-KR')}
                                    </p>
                                  </div>
                                  {report.total_score !== null && report.max_score ? (
                                    <div className="text-right shrink-0">
                                      <div className="text-2xl font-bold text-indigo-600">{report.total_score}</div>
                                      <div className="text-xs text-gray-500">/ {report.max_score}점</div>
                                    </div>
                                  ) : (() => {
                                    const metric = getReportKeyMetric(report);
                                    return metric ? (
                                      <div className="text-right shrink-0">
                                        <div className={`text-xl font-bold ${metric.color}`}>{metric.value}</div>
                                        <div className="text-xs text-gray-500">{metric.label}</div>
                                      </div>
                                    ) : null;
                                  })()}
                                </div>
                              </a>
                            ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}

// 성장 그래프 섹션 컴포넌트
interface ScoreTrendItem {
  date: string;
  name: string;
  shortName: string;
  score: number;
  maxScore: number;
  percentage: number;
  displayDate: string;
}

interface MathCapabilityItem {
  subject: string;
  value: number;
  fullMark: number;
}

interface GrowthChartSectionProps {
  scoreTrend: ScoreTrendItem[];
  mathCapability: MathCapabilityItem[] | null;
  growthRate: number | null;
}

function GrowthChartSection({ scoreTrend, mathCapability, growthRate }: GrowthChartSectionProps) {
  const [activeTab, setActiveTab] = useState<'trend' | 'capability'>('trend');

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
        {mathCapability && (
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('trend')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'trend'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              성적 추이
            </button>
            <button
              onClick={() => setActiveTab('capability')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'capability'
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
      {activeTab === 'trend' && scoreTrend.length > 0 && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
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
      {activeTab === 'capability' && mathCapability && (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mathCapability}>
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
                첫 점수: <span className="font-semibold text-gray-900">{scoreTrend[0].percentage}%</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">
                총 변화:
                <span className={`font-semibold ml-1 ${
                  scoreTrend[scoreTrend.length - 1].percentage - scoreTrend[0].percentage > 0
                    ? 'text-green-600'
                    : scoreTrend[scoreTrend.length - 1].percentage - scoreTrend[0].percentage < 0
                    ? 'text-red-600'
                    : 'text-gray-900'
                }`}>
                  {scoreTrend[scoreTrend.length - 1].percentage - scoreTrend[0].percentage > 0 ? '+' : ''}
                  {scoreTrend[scoreTrend.length - 1].percentage - scoreTrend[0].percentage}%p
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Growth Loop 진행 상황 컴포넌트
function GrowthLoopStatus({ reports }: { reports: Report[] }) {
  const hasLevelTest = reports.some(r => r.report_type === 'level_test');
  const testCount = reports.filter(r => r.report_type === 'test').length;
  const weeklyCount = reports.filter(r => r.report_type === 'weekly').length;
  const monthlyCount = reports.filter(r => r.report_type === 'monthly').length;
  const semiAnnualCount = reports.filter(r => r.report_type === 'semi_annual').length;
  const annualCount = reports.filter(r => r.report_type === 'annual').length;

  // 최근 연간 리포트에서 성장 서사 추출
  const latestAnnual = reports.find(r => r.report_type === 'annual');
  const annualData = latestAnnual?.analysis_data as Record<string, unknown> | undefined;
  const growthNarrative = annualData?.growthNarrativeFinal as {
    headline?: string;
    transformationSummary?: string;
    lookingAhead?: string;
  } | undefined;

  // 최근 반기 리포트에서 장기 비전 추출
  const latestSemiAnnual = reports.find(r => r.report_type === 'semi_annual');
  const semiAnnualData = latestSemiAnnual?.analysis_data as Record<string, unknown> | undefined;
  const longTermVision = semiAnnualData?.longTermVisionUpdate as {
    yearEndProjection?: string;
    nextYearOutlook?: string;
  } | undefined;

  const loopSteps = [
    { key: 'level_test', label: 'Baseline', icon: '🎯', active: hasLevelTest, count: hasLevelTest ? 1 : 0 },
    { key: 'test', label: '시험 분석', icon: '📝', active: testCount > 0, count: testCount },
    { key: 'weekly', label: '주간', icon: '📅', active: weeklyCount > 0, count: weeklyCount },
    { key: 'monthly', label: '월간', icon: '📆', active: monthlyCount > 0, count: monthlyCount },
    { key: 'semi_annual', label: '반기', icon: '📈', active: semiAnnualCount > 0, count: semiAnnualCount },
    { key: 'annual', label: '연간', icon: '📚', active: annualCount > 0, count: annualCount },
  ];

  const completedSteps = loopSteps.filter(s => s.active).length;
  const progressPercentage = Math.round((completedSteps / loopSteps.length) * 100);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">성장 여정 (Growth Loop)</h3>
        <span className="text-sm text-indigo-600 font-medium">
          {completedSteps}/{loopSteps.length} 단계 완료 ({progressPercentage}%)
        </span>
      </div>

      {/* 진행 바 */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* 단계별 상태 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {loopSteps.map((step, index) => (
          <div
            key={step.key}
            className={`relative text-center p-3 rounded-lg transition-all ${
              step.active
                ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200'
                : 'bg-gray-50 border-2 border-gray-100'
            }`}
          >
            {/* 연결선 */}
            {index < loopSteps.length - 1 && (
              <div className={`absolute top-1/2 -right-2 w-4 h-0.5 ${
                step.active ? 'bg-indigo-300' : 'bg-gray-200'
              } hidden md:block`} />
            )}

            <div className="text-2xl mb-1">{step.icon}</div>
            <div className={`text-xs font-medium ${step.active ? 'text-indigo-700' : 'text-gray-400'}`}>
              {step.label}
            </div>
            {step.count > 0 && (
              <div className="text-xs text-indigo-500 mt-1">{step.count}건</div>
            )}
            {step.active && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 성장 서사 요약 (연간 리포트가 있는 경우) */}
      {growthNarrative && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-amber-800 mb-2">📖 {growthNarrative.headline || '성장 스토리'}</h4>
          <p className="text-sm text-amber-900">{growthNarrative.transformationSummary}</p>
          {growthNarrative.lookingAhead && (
            <p className="text-sm text-amber-700 mt-2">🔮 {growthNarrative.lookingAhead}</p>
          )}
        </div>
      )}

      {/* 장기 비전 (반기 리포트가 있는 경우) */}
      {!growthNarrative && longTermVision && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
          <h4 className="font-medium text-indigo-800 mb-2">🔮 장기 비전</h4>
          <p className="text-sm text-indigo-900">{longTermVision.yearEndProjection}</p>
          {longTermVision.nextYearOutlook && (
            <p className="text-sm text-indigo-700 mt-1">내년 전망: {longTermVision.nextYearOutlook}</p>
          )}
        </div>
      )}

      {/* Baseline 미설정 안내 */}
      {!hasLevelTest && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
          <span className="font-medium">🎯 Baseline 미설정:</span> 레벨 테스트를 통해 학습 출발점을 설정하면 더 정확한 성장 분석이 가능합니다.
        </div>
      )}
    </div>
  );
}
