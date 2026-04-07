'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User, Report, Student, Schedule, ClassSession, Assignment, StudentWeakness } from '@/types';

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

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, reports: 0, weeklyReports: 0 });
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

    if (!userData || userData.role !== 'teacher') {
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

    setStats({
      students: studentCount || 0,
      reports: reportCount || 0,
      weeklyReports: weeklyCount || 0,
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

    // 각 학생별 추가 정보 로드
    const todayInfo: TodayStudentInfo[] = [];

    for (const schedule of schedules) {
      const studentId = schedule.student_id;

      // 최근 수업 기록
      const { data: lastSessions } = await supabase
        .from('class_sessions')
        .select('*')
        .eq('student_id', studentId)
        .order('session_date', { ascending: false })
        .limit(1);

      // 미완료 숙제
      const { data: assignments } = await supabase
        .from('assignments')
        .select('*')
        .eq('student_id', studentId)
        .in('status', ['assigned', 'in_progress', 'overdue']);

      // 활성 취약점
      const { data: weaknesses } = await supabase
        .from('student_weaknesses')
        .select('*')
        .eq('student_id', studentId)
        .in('status', ['active', 'recurring'])
        .order('severity', { ascending: false })
        .limit(3);

      // 최근 리포트
      const { data: recentReports } = await supabase
        .from('reports')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1);

      todayInfo.push({
        student: schedule.students,
        schedule: schedule,
        lastSession: lastSessions?.[0] || undefined,
        pendingAssignments: assignments || [],
        activeWeaknesses: weaknesses || [],
        recentReport: recentReports?.[0] || undefined,
      });
    }

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-700">
            수학 학습 분석
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.name} 선생님</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">대시보드</h2>

        {/* 통계 카드 */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <StatCard label="등록 학생" value={stats.students} unit="명" />
          <StatCard label="생성 리포트" value={stats.reports} unit="개" />
          <StatCard label="이번 주 분석" value={stats.weeklyReports} unit="건" />
          <StatCard label="시스템 완성도" value={80} unit="%" description="수업 관리 시스템 추가" />
        </div>

        {/* 오늘 수업 섹션 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">📚 오늘 수업</h3>
              <span className="text-sm text-gray-500">{formatDate(todayDate)}</span>
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                {todayStudents.length}명
              </span>
            </div>
            <Link href="/admin/schedules" className="text-sm text-indigo-600 hover:text-indigo-700">
              일정 관리 →
            </Link>
          </div>

          {todayStudents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-gray-500">
                오늘은 예정된 수업이 없습니다.
              </p>
              <a
                href="/admin/schedules"
                className="inline-block mt-4 text-sm text-indigo-600 hover:text-indigo-700"
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
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          <DashboardCard
            title="학생 관리"
            description="추가, 수정, 삭제"
            icon="👨‍🎓"
            href="/admin/students"
          />
          <DashboardCard
            title="수업 일정"
            description="요일별 수업 시간"
            icon="📅"
            href="/admin/schedules"
          />
          <DashboardCard
            title="수업 기록"
            description="수업 내용 기록"
            icon="✏️"
            href="/admin/class-record"
          />
          <DashboardCard
            title="학부모 관리"
            description="계정 및 자녀 연결"
            icon="👨‍👩‍👧"
            href="/admin/parents"
          />
        </div>
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <DashboardCard
            title="리포트 생성"
            description="주간/월간/시험"
            icon="📊"
            href="/admin/reports/create"
          />
          <DashboardCard
            title="리포트 관리"
            description="조회 및 관리"
            icon="📋"
            href="/admin/reports"
          />
          <DashboardCard
            title="전략 관리"
            description="효과 추적"
            icon="🎯"
            href="/admin/strategies"
          />
          <DashboardCard
            title="분석 대시보드"
            description="성과 및 예측"
            icon="📈"
            href="/admin/analytics"
          />
        </div>

        {/* 최근 이벤트 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">최근 이벤트</h3>
            <Link href="/admin/reports" className="text-sm text-indigo-600 hover:text-indigo-700">
              전체 보기 →
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              아직 이벤트가 없습니다.<br />
              시험지를 분석하여 첫 리포트를 생성해보세요.
            </p>
          ) : (
            <div className="divide-y">
              {recentReports.map((report) => (
                <a
                  key={report.id}
                  href={`/admin/reports/${report.id}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm">
                      {report.report_type === 'test' ? '📝' : report.report_type === 'weekly' ? '📅' : report.report_type === 'monthly' ? '📆' : '📊'}
                    </span>
                    <div>
                      <span className="font-medium text-gray-900">{report.students?.name}</span>
                      <span className="text-gray-500 mx-2">
                        {report.report_type === 'test' ? '시험 분석 완료' :
                         report.report_type === 'weekly' ? '주간 리포트 생성' :
                         report.report_type === 'monthly' ? '월간 리포트 생성' : '통합 분석 완료'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {report.report_type === 'test' && report.total_score && (
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-sm font-medium">
                        {report.total_score}점
                      </span>
                    )}
                    <span className="text-sm text-gray-400">
                      {new Date(report.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, unit, description }: { label: string; value: number; unit: string; description?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 stat-card">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">
        {value}<span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </div>
      {description && (
        <div className="text-xs text-gray-400 mt-1">{description}</div>
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
      className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow border border-gray-100 dashboard-card"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-xs">{description}</p>
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

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg font-semibold text-indigo-600">
            {student.name.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{student.name}</div>
            <div className="text-sm text-gray-500">
              {getGradeLabel(student.grade)} · {formatTime(schedule.start_time)}
              {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
            </div>
          </div>
        </div>
        <a
          href={`/admin/class-record?student=${student.id}`}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          기록
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {/* 진도 정보 */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">📊 최근 점수</div>
          <div className="font-medium text-gray-900">
            {recentReport?.total_score ? (
              <>
                {recentReport.total_score}
                <span className="text-gray-400">/{recentReport.max_score}</span>
              </>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        </div>

        {/* 이전 수업 키워드 */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">🏷️ 최근 학습</div>
          <div className="font-medium text-gray-900 truncate">
            {lastSession?.learning_keywords?.length ? (
              lastSession.learning_keywords.slice(0, 2).map((k, i) => (
                <span key={i} className="text-xs bg-blue-100 text-blue-700 px-1 rounded mr-1">
                  #{k}
                </span>
              ))
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        </div>

        {/* 숙제 상태 */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">📝 숙제</div>
          <div className="font-medium">
            {pendingAssignments.length === 0 ? (
              <span className="text-gray-400">없음</span>
            ) : overdueAssignments > 0 ? (
              <span className="text-red-600">⏳ {overdueAssignments}건 미완료</span>
            ) : (
              <span className="text-green-600">✓ {completedAssignments}건 완료</span>
            )}
          </div>
        </div>

        {/* 주의 포인트 */}
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-1">⚠️ 주의 포인트</div>
          <div className="font-medium text-gray-900 truncate">
            {activeWeaknesses.length > 0 ? (
              <span className="text-amber-600">
                {activeWeaknesses[0].concept}
                {activeWeaknesses.length > 1 && ` 외 ${activeWeaknesses.length - 1}`}
              </span>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
