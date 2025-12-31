'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, Report, AnalysisData, ReportType, StudyPlan, StudyTask } from '@/types';
import {
  LineChart,
  Line,
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
} from 'recharts';

interface StudentWithDetails extends Student {
  reports: Report[];
  study_plans: (StudyPlan & { study_tasks: StudyTask[] })[];
}

// 리포트 타입별 한글 이름과 배지 색상
const REPORT_TYPE_CONFIG: Record<ReportType, { name: string; color: string; bgColor: string }> = {
  level_test: { name: '레벨 테스트', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  test: { name: '시험 분석', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  weekly: { name: '주간', color: 'text-green-600', bgColor: 'bg-green-100' },
  monthly: { name: '월간', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  semi_annual: { name: '반기', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  annual: { name: '연간', color: 'text-red-600', bgColor: 'bg-red-100' },
  consolidated: { name: '종합', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
};

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StudentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

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

    // 교사면 admin으로 리다이렉트
    if (userData.role === 'teacher') {
      router.push('/admin');
      return;
    }

    // 학부모면 parent로 리다이렉트
    if (userData.role === 'parent') {
      router.push('/parent');
      return;
    }

    // 학생만 접근 가능
    if (userData.role !== 'student') {
      router.push('/');
      return;
    }

    setUser(userData);
    await loadStudentData(authUser.id);
    setLoading(false);
  };

  const loadStudentData = async (userId: string) => {
    const supabase = createClient();

    // 학생 정보 조회 (user_id로 연결된 학생 찾기)
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (studentError || !studentData) {
      console.error('학생 정보 조회 오류:', studentError);
      return;
    }

    // 리포트 조회
    const { data: reports } = await supabase
      .from('reports')
      .select('*')
      .eq('student_id', studentData.id)
      .order('test_date', { ascending: false })
      .limit(20);

    // 학습 계획 조회
    const { data: studyPlans } = await supabase
      .from('study_plans')
      .select(`
        *,
        study_tasks (*)
      `)
      .eq('student_id', studentData.id)
      .in('status', ['active', 'draft'])
      .order('created_at', { ascending: false })
      .limit(5);

    setStudent({
      ...studentData,
      reports: reports || [],
      study_plans: studyPlans || [],
    });
  };

  // 점수 추이 데이터 생성
  const getScoreTrendData = () => {
    if (!student?.reports) return [];

    return student.reports
      .filter((r) => r.report_type === 'test' && r.total_score != null)
      .slice(0, 10)
      .reverse()
      .map((r) => ({
        name: r.test_name?.slice(0, 8) || '시험',
        score: r.total_score,
        date: r.test_date,
      }));
  };

  // 수학 역량 레이더 차트 데이터
  const getCapabilityData = () => {
    const latestReport = student?.reports?.find((r) => {
      const analysis = r.analysis_data as AnalysisData | null;
      return analysis?.macroAnalysis?.mathCapability;
    });

    if (!latestReport) {
      return [
        { subject: '계산 속도', value: 0 },
        { subject: '계산 정확도', value: 0 },
        { subject: '응용력', value: 0 },
        { subject: '논리력', value: 0 },
        { subject: '불안 조절', value: 0 },
      ];
    }

    const cap = (latestReport.analysis_data as AnalysisData).macroAnalysis?.mathCapability;
    return [
      { subject: '계산 속도', value: cap?.calculationSpeed || 0 },
      { subject: '계산 정확도', value: cap?.calculationAccuracy || 0 },
      { subject: '응용력', value: cap?.applicationAbility || 0 },
      { subject: '논리력', value: cap?.logic || 0 },
      { subject: '불안 조절', value: cap?.anxietyControl || 0 },
    ];
  };

  // 진행 중인 학습 항목 수 계산
  const getActiveTasks = () => {
    if (!student?.study_plans) return { total: 0, completed: 0 };

    let total = 0;
    let completed = 0;

    for (const plan of student.study_plans) {
      total += plan.total_tasks || 0;
      completed += plan.completed_tasks || 0;
    }

    return { total, completed };
  };

  // 학년 문자열
  const getGradeString = (grade: number) => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">학생 정보를 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-4">
            선생님께 문의하여 계정을 연결해 주세요.
          </p>
        </div>
      </div>
    );
  }

  const scoreTrendData = getScoreTrendData();
  const capabilityData = getCapabilityData();
  const { total: totalTasks, completed: completedTasks } = getActiveTasks();
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {student.name[0]}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{student.name}</h1>
                <p className="text-sm text-gray-500">
                  {getGradeString(student.grade)} · {student.school || '학교 미등록'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user?.email}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  router.push('/login');
                }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 요약 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* 총 리포트 수 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">총 리포트</p>
                <p className="text-3xl font-bold text-indigo-600">{student.reports.length}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>

          {/* 학습 진도 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">학습 진도</p>
                <p className="text-3xl font-bold text-green-600">{progressPercentage}%</p>
                <p className="text-xs text-gray-400 mt-1">{completedTasks}/{totalTasks} 완료</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>

          {/* 최근 점수 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">최근 점수</p>
                {scoreTrendData.length > 0 ? (
                  <p className="text-3xl font-bold text-purple-600">
                    {scoreTrendData[scoreTrendData.length - 1]?.score || '-'}
                  </p>
                ) : (
                  <p className="text-xl font-bold text-gray-400">-</p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📈</span>
              </div>
            </div>
          </div>

          {/* 배지 (플레이스홀더) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">획득 배지</p>
                <p className="text-3xl font-bold text-yellow-600">0</p>
                <p className="text-xs text-gray-400 mt-1">곧 만나요!</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🏆</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 점수 추이 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">점수 추이</h2>
            {scoreTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={scoreTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px' }}
                    formatter={(value: number) => [`${value}점`, '점수']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-400">
                아직 시험 데이터가 없습니다
              </div>
            )}
          </div>

          {/* 수학 역량 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">수학 역량</h2>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={capabilityData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar
                  name="역량"
                  dataKey="value"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 학습 계획 */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">진행 중인 학습 계획</h2>
          </div>

          {student.study_plans.length > 0 ? (
            <div className="space-y-4">
              {student.study_plans.map((plan) => (
                <div key={plan.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">{plan.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {plan.status === 'active' ? '진행중' : '준비중'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span>{plan.start_date} ~ {plan.end_date}</span>
                    <span>{plan.completed_tasks || 0}/{plan.total_tasks || 0} 완료</span>
                  </div>
                  {/* 진행률 바 */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${plan.progress_percentage || 0}%` }}
                    />
                  </div>
                  {/* 학습 항목 미리보기 */}
                  {plan.study_tasks && plan.study_tasks.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {plan.study_tasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center gap-2 text-sm ${
                            task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-600'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                            task.status === 'completed'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300'
                          }`}>
                            {task.status === 'completed' && '✓'}
                          </span>
                          {task.title}
                        </div>
                      ))}
                      {plan.study_tasks.length > 3 && (
                        <p className="text-xs text-gray-400">
                          외 {plan.study_tasks.length - 3}개 항목...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>등록된 학습 계획이 없습니다</p>
            </div>
          )}
        </div>

        {/* 최근 리포트 */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">최근 리포트</h2>
          </div>

          {student.reports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {student.reports.slice(0, 6).map((report) => {
                const config = REPORT_TYPE_CONFIG[report.report_type as ReportType];
                const analysis = report.analysis_data as AnalysisData | null;

                return (
                  <Link
                    key={report.id}
                    href={`/student/reports/${report.id}`}
                    className="block border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${config?.bgColor} ${config?.color}`}>
                        {config?.name || report.report_type}
                      </span>
                      {report.total_score != null && (
                        <span className="text-lg font-bold text-indigo-600">
                          {report.total_score}점
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-gray-800 truncate">
                      {report.test_name || '리포트'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{report.test_date}</p>
                    {analysis?.macroAnalysis?.oneLineSummary && (
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                        {analysis.macroAnalysis.oneLineSummary}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>아직 리포트가 없습니다</p>
            </div>
          )}
        </div>

        {/* 동기부여 메시지 */}
        <div className="mt-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white text-center">
          <div className="text-4xl mb-4">💪</div>
          <h2 className="text-2xl font-bold mb-2">오늘도 화이팅!</h2>
          <p className="text-indigo-100">
            꾸준한 노력이 큰 성장을 만듭니다. 한 걸음씩 나아가 봐요!
          </p>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} 수학 학습 플랫폼. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
