'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  getGrowthTruthBrief,
  summarizeGrowthReadiness,
  type GrowthReadinessSummary,
} from '@/lib/teacher-verified-analysis';
import type { User, Report, Student, Schedule, ClassSession, Assignment, StudentWeakness, AnalysisData } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { ThemeToggle } from '@/components/common/ThemeToggle';

interface ReportWithStudent extends Report {
  students: Pick<Student, 'name' | 'grade'>;
}

interface ScheduleWithStudent extends Schedule {
  students: Student;
}

interface TodayStudentInfo {
  student: Student;
  schedule: ScheduleWithStudent;
  lastSession?: ClassSession;
  pendingAssignments: Assignment[];
  activeWeaknesses: StudentWeakness[];
  recentReport?: Report;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

const getGrowthReadinessClass = (tone: GrowthReadinessSummary['tone']): string => {
  switch (tone) {
    case 'success':
      return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
    case 'warning':
      return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
    case 'danger':
      return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50';
    default:
      return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
};

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, reports: 0, weeklyReports: 0, needsAttentionReports: 0 });
  const [recentReports, setRecentReports] = useState<ReportWithStudent[]>([]);
  const [todayStudents, setTodayStudents] = useState<TodayStudentInfo[]>([]);
  const [todayDate, setTodayDate] = useState<Date>(new Date());

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
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

    if (!userData || !['teacher', 'super_admin'].includes(userData.role)) {
      router.push('/');
      return;
    }

    setUser(userData);

    // 통계 로드
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    const { count: reportCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true });

    // 이번 주 리포트 수
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { count: weeklyCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString());

    let needsAttentionReports = 0;
    let from = 0;
    const pageSize = 1000;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    while (true) {
      const { data: growthStatusReports, error: growthStatusError } = await supabase
        .from('reports')
        .select('report_type, analysis_data')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .range(from, from + pageSize - 1);

      if (growthStatusError) {
        console.error('성장 분석 보완 필요 건수 조회 오류:', growthStatusError);
        break;
      }

      needsAttentionReports += (growthStatusReports || []).filter((report) =>
        summarizeGrowthReadiness(report.analysis_data as AnalysisData | null, report.report_type).needsAttention
      ).length;

      if (!growthStatusReports || growthStatusReports.length < pageSize) break;
      from += pageSize;
    }

    setStats({
      students: studentCount || 0,
      reports: reportCount || 0,
      weeklyReports: weeklyCount || 0,
      needsAttentionReports,
    });

    // 최근 리포트 로드
    const { data: reports } = await supabase
      .from('reports')
      .select(`*, students (name, grade)`)
      .order('created_at', { ascending: false })
      .limit(5);

    setRecentReports(reports || []);

    // 오늘 수업 학생 로드
    await loadTodayStudents(supabase);

    setLoading(false);
  };

  const loadTodayStudents = async (supabase: ReturnType<typeof createClient>) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일, 1=월, ...
    setTodayDate(today);

    // 오늘 요일에 해당하는 활성 스케줄 조회
    const { data: schedules } = await supabase
      .from('schedules')
      .select('*, students (*)')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .order('start_time');

    if (!schedules || schedules.length === 0) {
      setTodayStudents([]);
      return;
    }

    // 각 학생별 쿼리 병렬 처리
    const todayInfoPromises = schedules.map(async (schedule) => {
      const studentId = schedule.student_id;

      const [lastSessionsRes, assignmentsRes, weaknessesRes, recentReportsRes] = await Promise.all([
        supabase.from('class_sessions').select('*').eq('student_id', studentId).order('session_date', { ascending: false }).limit(1),
        supabase.from('assignments').select('*').eq('student_id', studentId).in('status', ['assigned', 'in_progress', 'overdue']),
        supabase.from('student_weaknesses').select('*').eq('student_id', studentId).in('status', ['active', 'recurring']).order('severity', { ascending: false }).limit(3),
        supabase.from('reports').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(1)
      ]);

      return {
        student: schedule.students,
        schedule: schedule,
        lastSession: lastSessionsRes.data?.[0] || undefined,
        pendingAssignments: assignmentsRes.data || [],
        activeWeaknesses: weaknessesRes.data || [],
        recentReport: recentReportsRes.data?.[0] || undefined,
      };
    });

    const todayInfo = await Promise.all(todayInfoPromises);

    setTodayStudents(todayInfo);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const formatTime = (time: string): string => {
    return time.substring(0, 5);
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* 프리미엄 모바일 대응 헤더 */}
      <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-indigo-50 dark:border-slate-800">
        <div className="container mx-auto px-4 py-6 flex flex-col items-center gap-4 text-center">

          {/* 플랫폼 브랜딩 (My Math Master) */}
          <div className="flex flex-col items-center">
            <Link href="/" className="inline-flex items-center gap-2 text-2xl font-black text-indigo-900 dark:text-indigo-400 tracking-tight">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="whitespace-nowrap">My Math Master</span>
            </Link>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium whitespace-nowrap">
              데이터가 증명하는 최상위권 수학 성장 플랫폼
            </p>
          </div>

          {/* 컨트롤 패널 (유저명, 테마, 로그아웃) */}
          <div className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 shadow-sm mt-1 overflow-visible">
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                {user?.name?.charAt(0) || 'T'}
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                {user?.name} 선생님
              </span>
            </div>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0"></div>
            <div className="shrink-0">
              <ThemeToggle />
            </div>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0"></div>
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors whitespace-nowrap px-1 shrink-0"
            >
              로그아웃
            </button>
          </div>

        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">대시보드</h2>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <StatCard label="등록 학생" value={stats.students} unit="명" />
          <StatCard label="생성 리포트" value={stats.reports} unit="개" />
          <StatCard label="이번 주 분석" value={stats.weeklyReports} unit="건" />
          <StatCard label="보완 필요" value={stats.needsAttentionReports} unit="건" description="성장 분석 재확인" />
        </div>

        {/* 오늘 수업 섹션 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 mb-8 border border-transparent dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📚 오늘 수업</h3>
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl self-start md:self-auto border border-gray-100 dark:border-slate-700">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{formatDate(todayDate)}</span>
              <span className="w-px h-3 bg-gray-300 dark:bg-slate-700"></span>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {todayStudents.length}명
              </span>
              <Link href="/teacher/schedules" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold ml-2 flex items-center gap-1 bg-white dark:bg-slate-700 px-2 py-1 rounded shadow-sm border border-transparent dark:border-slate-600">
                일정 관리 <span>→</span>
              </Link>
            </div>
          </div>

          {todayStudents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-gray-500 dark:text-gray-400">
                오늘은 예정된 수업이 없습니다.
              </p>
              <a
                href="/teacher/schedules"
                className="inline-block mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
              >
                수업 일정 등록하기 →
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {todayStudents.map((info) => (
                <TodayStudentCard key={info.student.id} info={info} getGradeLabel={getGradeLabel} formatTime={formatTime} />
              ))}
            </div>
          )}
        </div>

        {/* 퀵 액션 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
          <DashboardCard
            title="학생 관리"
            description="추가, 수정, 삭제"
            icon="👨‍🎓"
            href="/teacher/students"
          />
          <DashboardCard
            title="수업 일정"
            description="요일별 수업 시간"
            icon="📅"
            href="/teacher/schedules"
          />
          <DashboardCard
            title="수업 기록"
            description="수업 내용 기록"
            icon="✏️"
            href="/teacher/class-record"
          />
          <DashboardCard
            title="학부모 관리"
            description="계정 및 자녀 연결"
            icon="👨‍👩‍👧"
            href="/teacher/parents"
          />
          <DashboardCard
            title="리포트 생성"
            description="주간/월간/시험"
            icon="📊"
            href="/teacher/reports/create"
          />
          <DashboardCard
            title="리포트 관리"
            description="조회 및 관리"
            icon="📋"
            href="/teacher/reports"
          />
          <DashboardCard
            title="전략 관리"
            description="효과 추적"
            icon="🎯"
            href="/teacher/strategies"
          />
          <DashboardCard
            title="분석 대시보드"
            description="성과 및 예측"
            icon="📈"
            href="/teacher/analytics"
          />
        </div>

        <div className="mb-10">
          <div className="flex flex-col gap-1.5 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">데이터 고도화</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">과거 데이터와 AI 기억을 성장 분석에 연결합니다.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <DashboardCard
              title="과거 데이터 가져오기"
              description="이미지/PDF/CSV 복원"
              icon="🗂️"
              href="/teacher/migration"
            />
            <DashboardCard
              title="AI 기억 서랍 관리"
              description="RAG 인덱싱/검색"
              icon="🧠"
              href="/teacher/embeddings"
            />
          </div>
        </div>

        {/* 최근 이벤트 */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-transparent dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">최근 이벤트</h3>
            <Link href="/teacher/reports" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
              전체 보기 →
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              아직 이벤트가 없습니다.<br />
              시험지를 분석하여 첫 리포트를 생성해보세요.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {recentReports.map((report) => {
                const growthReadiness = summarizeGrowthReadiness(
                  report.analysis_data as AnalysisData | null,
                  report.report_type
                );
                const growthBrief = getGrowthTruthBrief(
                  report.analysis_data as AnalysisData | null,
                  report.report_type
                );

                return (
                  <a
                    key={report.id}
                    href={`/teacher/reports/${report.id}`}
                    className="flex flex-col gap-3 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded transition-colors md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-sm">
                        {report.report_type === 'test' ? '📝' : report.report_type === 'weekly' ? '📅' : report.report_type === 'monthly' ? '📆' : '📊'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">{report.students?.name}</span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {report.report_type === 'test' ? '시험 분석 완료' :
                            report.report_type === 'weekly' ? '주간 리포트 생성' :
                            report.report_type === 'monthly' ? '월간 리포트 생성' : '통합 분석 완료'}
                          </span>
                        </div>
                        <p className="mt-1 max-w-xl truncate text-xs text-gray-500 dark:text-gray-400">
                          {growthBrief.compactText}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 md:gap-3">
                      <span className={`px-2 py-1 text-xs rounded border ${getGrowthReadinessClass(growthReadiness.tone)}`}>
                        {growthReadiness.label}
                      </span>
                      {report.report_type === 'test' && report.total_score && (
                        <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded text-sm font-medium">
                          {report.total_score}점
                        </span>
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(report.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, unit, description }: { label: string; value: number; unit: string; description?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 stat-card border border-transparent dark:border-slate-800">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}<span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>
      </div>
      {description && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</div>
      )}
    </div>
  );
}

function DashboardCard({ title, description, icon, href }: {
  title: string;
  description: string;
  icon: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="block bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-slate-800 dashboard-card active:scale-[0.98] group"
    >
      <div className="text-2xl mb-2 transform transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1 origin-left">{icon}</div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 text-[11px] leading-tight md:text-xs">{description}</p>
    </a>
  );
}

function TodayStudentCard({
  info,
  getGradeLabel,
  formatTime
}: {
  info: TodayStudentInfo;
  getGradeLabel: (grade: number) => string;
  formatTime: (time: string) => string;
}) {
  const { student, schedule, lastSession, pendingAssignments, activeWeaknesses, recentReport } = info;

  const completedAssignments = pendingAssignments.filter(a => a.status === 'completed').length;
  const overdueAssignments = pendingAssignments.filter(a => a.status === 'overdue').length;
  const growthReadiness = recentReport
    ? summarizeGrowthReadiness(recentReport.analysis_data as AnalysisData | null, recentReport.report_type)
    : null;
  const growthBrief = recentReport
    ? getGrowthTruthBrief(recentReport.analysis_data as AnalysisData | null, recentReport.report_type)
    : null;

  return (
    <div className="bg-slate-50/50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-lg font-semibold text-indigo-600 dark:text-indigo-400">
            {student.name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">{student.name}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {getGradeLabel(student.grade)} · {formatTime(schedule.start_time)}
              {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
            </div>
          </div>
        </div>
        <a
          href={`/teacher/class-record?student=${student.id}`}
          className="px-3 py-1.5 text-sm bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
        >
          기록
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {/* 최근 리포트 */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📊 최근 리포트</div>
          {recentReport ? (
            <a href={`/teacher/reports/${recentReport.id}`} className="block">
              <div className="flex flex-wrap items-center gap-1.5">
                {recentReport.total_score ? (
                  <span className="font-medium text-gray-900 dark:text-white">
                    {recentReport.total_score}
                    <span className="text-gray-500 dark:text-gray-400">/{recentReport.max_score}</span>
                  </span>
                ) : (
                  <span className="font-medium text-gray-900 dark:text-white">리포트 확인</span>
                )}
                {growthReadiness && (
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] ${getGrowthReadinessClass(growthReadiness.tone)}`}>
                    {growthReadiness.label}
                  </span>
                )}
              </div>
              {growthBrief && (
                <p className="mt-1 truncate text-[11px] font-normal text-gray-500 dark:text-gray-400">
                  {growthBrief.compactText}
                </p>
              )}
            </a>
          ) : (
            <div className="font-medium text-gray-900 dark:text-white">
              <span className="text-gray-400 dark:text-gray-600">-</span>
            </div>
          )}
        </div>

        {/* 이전 수업 키워드 */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">🏷️ 최근 학습</div>
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {lastSession?.learning_keywords?.length ? (
              lastSession.learning_keywords.slice(0, 2).map((k, i) => (
                <span key={i} className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1 rounded mr-1">
                  #{k}
                </span>
              ))
            ) : (
              <span className="text-gray-400 dark:text-gray-600">-</span>
            )}
          </div>
        </div>

        {/* 숙제 상태 */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📝 숙제</div>
          <div className="font-medium">
            {pendingAssignments.length === 0 ? (
              <span className="text-gray-400 dark:text-gray-600">없음</span>
            ) : overdueAssignments > 0 ? (
              <span className="text-red-600 dark:text-red-400 font-semibold">⏳ {overdueAssignments}건 미완료</span>
            ) : (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ {completedAssignments}건 완료</span>
            )}
          </div>
        </div>

        {/* 주의 포인트 */}
        <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">⚠️ 주의 포인트</div>
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {activeWeaknesses.length > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {activeWeaknesses[0].concept}
                {activeWeaknesses.length > 1 && ` 외 ${activeWeaknesses.length - 1}`}
              </span>
            ) : (
              <span className="text-gray-400 dark:text-gray-600">-</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
