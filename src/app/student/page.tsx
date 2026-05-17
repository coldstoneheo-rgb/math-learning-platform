'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MetaHeader } from '@/components/report';
import {
  getDisplayableDerivedGuidance,
  selectLatestDisplayableGuidanceWithSection,
} from '@/lib/teacher-verified-analysis';
import type {
  User, Student, Report, AnalysisData, ReportType,
  StudyPlan, StudyTask, GrowthPrediction, ActionablePrescriptionItem, SelfAnalysisReport
} from '@/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from 'recharts';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface StudentWithDetails extends Student {
  reports: Report[];
  study_plans: (StudyPlan & { study_tasks: StudyTask[] })[];
}

const REPORT_TYPE_CONFIG: Record<ReportType, { name: string; color: string; bgColor: string }> = {
  level_test: { name: '레벨 테스트', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  test: { name: '시험 분석', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  weekly: { name: '주간', color: 'text-green-600', bgColor: 'bg-green-100' },
  monthly: { name: '월간', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  semi_annual: { name: '반기', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  annual: { name: '연간', color: 'text-red-600', bgColor: 'bg-red-100' },
  consolidated: { name: '종합', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  self_analysis: { name: '내 풀이 분석', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
};

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StudentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const supabase = createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) { router.push('/login'); return; }

    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (!userData) { router.push('/login'); return; }

    if (userData.role === 'teacher') { router.push('/teacher'); return; }
    if (userData.role === 'parent') { router.push('/parent'); return; }
    if (userData.role !== 'student') { router.push('/'); return; }

    setUser(userData);
    await loadStudentData(authUser.id);
    setLoading(false);
  };

  const loadStudentData = async (userId: string) => {
    const supabase = createClient();

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (studentError || !studentData) return;

    const [{ data: reports }, { data: studyPlans }] = await Promise.all([
      supabase.from('reports').select('*').eq('student_id', studentData.id)
        .order('test_date', { ascending: false }).limit(20),
      supabase.from('study_plans').select('*, study_tasks (*)')
        .eq('student_id', studentData.id).in('status', ['active', 'draft'])
        .order('created_at', { ascending: false }).limit(5),
    ]);

    setStudent({ ...studentData, reports: reports || [], study_plans: studyPlans || [] });
  };

  const getScoreTrendData = () => {
    if (!student?.reports) return [];
    return student.reports
      .filter(r => r.report_type === 'test' && r.total_score != null)
      .slice(0, 10).reverse()
      .map(r => ({ name: r.test_name?.slice(0, 8) || '시험', score: r.total_score, date: r.test_date }));
  };

  const getCapabilityData = () => {
    const latestReport = student?.reports?.find(r => {
      const a = r.analysis_data as AnalysisData | null;
      return a?.macroAnalysis?.mathCapability;
    });
    if (!latestReport) return [
      { subject: '계산 속도', value: 0 }, { subject: '계산 정확도', value: 0 },
      { subject: '응용력', value: 0 }, { subject: '논리력', value: 0 }, { subject: '불안 조절', value: 0 },
    ];
    const cap = (latestReport.analysis_data as AnalysisData).macroAnalysis?.mathCapability;
    return [
      { subject: '계산 속도', value: cap?.calculationSpeed || 0 },
      { subject: '계산 정확도', value: cap?.calculationAccuracy || 0 },
      { subject: '응용력', value: cap?.applicationAbility || 0 },
      { subject: '논리력', value: cap?.logic || 0 },
      { subject: '불안 조절', value: cap?.anxietyControl || 0 },
    ];
  };

  const getActiveTasks = () => {
    if (!student?.study_plans) return { total: 0, completed: 0 };
    return student.study_plans.reduce(
      (acc, plan) => ({
        total: acc.total + (plan.total_tasks || 0),
        completed: acc.completed + (plan.completed_tasks || 0),
      }),
      { total: 0, completed: 0 }
    );
  };

  // 최신 시험 분석 리포트에서 성장 예측 데이터 추출
  const getGrowthPredictions = (): GrowthPrediction[] => {
    return selectLatestDisplayableGuidanceWithSection(
      student?.reports,
      guidance => guidance.growthPredictions.length > 0
    ).growthPredictions;
  };

  // 최신 시험 분석 리포트에서 실행 전략 추출 (우선순위 1~3)
  const getTopPrescriptions = (): ActionablePrescriptionItem[] => {
    return selectLatestDisplayableGuidanceWithSection(
      student?.reports,
      guidance => guidance.actionablePrescription.length > 0
    )
      .actionablePrescription
      .slice(0, 3)
      .sort((a, b) => a.priority - b.priority);
  };

  // 상황에 맞는 동기부여 메시지 생성
  const getMotivation = () => {
    const trend = getScoreTrendData();
    const recent = trend[trend.length - 1]?.score as number | undefined;
    const prev = trend[trend.length - 2]?.score as number | undefined;
    const { total, completed } = getActiveTasks();
    const latestTestReport = student?.reports?.find(r => r.report_type === 'test' || r.report_type === 'level_test');
    const encouragement = getDisplayableDerivedGuidance(latestTestReport?.analysis_data as AnalysisData | undefined)
      .futureVision?.encouragement;

    if (total > 0 && completed === total) {
      return { emoji: '🎉', title: '오늘 계획 완료!', message: '모든 학습 계획을 완료했어요! 정말 대단합니다!' };
    }
    if (recent !== undefined && prev !== undefined && recent > prev) {
      const diff = recent - prev;
      return {
        emoji: '🚀', title: `${diff}점 향상!`,
        message: `지난 시험보다 ${diff}점 올랐어요! 이 기세라면 목표 달성도 가능합니다!`,
      };
    }
    if (recent !== undefined && prev !== undefined && recent < prev) {
      return {
        emoji: '💡', title: '다음엔 더 잘할 수 있어!',
        message: encouragement || '한 번의 결과가 전부가 아닙니다. 지금 집중하면 분명 좋아질 거예요!',
      };
    }
    return {
      emoji: '💪', title: '오늘도 화이팅!',
      message: encouragement || '꾸준한 노력이 큰 성장을 만듭니다. 한 걸음씩 나아가 봐요!',
    };
  };

  const getGradeString = (grade: number) => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">학생 정보를 찾을 수 없습니다</h2>
          <p className="text-gray-600">선생님께 문의하여 계정을 연결해 주세요.</p>
        </div>
      </div>
    );
  }

  const scoreTrendData = getScoreTrendData();
  const capabilityData = getCapabilityData();
  const { total: totalTasks, completed: completedTasks } = getActiveTasks();
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const growthPredictions = getGrowthPredictions();
  const topPrescriptions = getTopPrescriptions();
  const motivation = getMotivation();

  const latestSelfAnalysis = student?.reports?.find(r => r.report_type === 'self_analysis');

  // 최근 점수 향상 여부
  const recentScores = scoreTrendData.slice(-2);
  const scoreImproved = recentScores.length === 2 &&
    (recentScores[1].score as number) > (recentScores[0].score as number);
  const latestScore = scoreTrendData[scoreTrendData.length - 1]?.score;

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
              <span className="hidden sm:block text-sm text-gray-500">{user?.email}</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ===== 요약 카드 ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">총 리포트</p>
                <p className="text-3xl font-bold text-indigo-600">{student.reports.length}</p>
              </div>
              <span className="text-2xl">📊</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">학습 진도</p>
                <p className="text-3xl font-bold text-green-600">{progressPercentage}%</p>
                <p className="text-xs text-gray-400">{completedTasks}/{totalTasks} 완료</p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">최근 점수</p>
                {latestScore != null ? (
                  <div className="flex items-end gap-1">
                    <p className="text-3xl font-bold text-purple-600">{latestScore}</p>
                    {scoreImproved && <span className="text-green-500 text-sm mb-1">▲</span>}
                  </div>
                ) : (
                  <p className="text-xl font-bold text-gray-400">-</p>
                )}
              </div>
              <span className="text-2xl">📈</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">분석 리포트</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {student.reports.filter(r => r.report_type === 'test').length}
                </p>
                <p className="text-xs text-gray-400">시험 분석</p>
              </div>
              <span className="text-2xl">🏆</span>
            </div>
          </div>
        </div>

        {/* ===== 내 풀이 분석 하이라이트 (Phase 5.3) ===== */}
        {latestSelfAnalysis && (() => {
          const analysisData = latestSelfAnalysis.analysis_data as SelfAnalysisReport;
          return (
            <div className="mb-8 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0">
                  ✨
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-emerald-900">최근 내 풀이 분석 결과</h2>
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                      {latestSelfAnalysis.test_date}
                    </span>
                  </div>
                  <p className="text-sm text-emerald-700 mb-2">
                    {analysisData.oneLineSummary || '스스로 학습을 분석하고 성장하는 모습이 멋져요!'}
                  </p>
                  {analysisData.nextSteps?.immediate && analysisData.nextSteps.immediate.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 bg-white/60 px-3 py-1.5 rounded-lg inline-flex">
                      <span className="font-bold">🎯 당장 실천할 것:</span>
                      <span>{analysisData.nextSteps.immediate[0]}</span>
                    </div>
                  )}
                </div>
              </div>
              <Link
                href={`/student/reports/${latestSelfAnalysis.id}`}
                className="shrink-0 w-full md:w-auto text-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                리포트 다시 보기
              </Link>
            </div>
          );
        })()}

        {/* ===== 메타프로필 (학습 역량 지표) ===== */}
        {student.meta_profile && (
          <div className="mb-8">
            <MetaHeader
              metaProfile={student.meta_profile}
              studentName={student.name}
              studentGrade={student.grade}
              compact
            />
          </div>
        )}

        {/* ===== 차트 영역 ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">점수 추이</h2>
            {scoreTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
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
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={capabilityData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="역량" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ===== 성장 예측 ===== */}
        {growthPredictions.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">🔮 나의 성장 예측</h2>
            <p className="text-sm text-gray-500 mb-5">지금처럼 공부하면 이런 결과를 기대할 수 있어요!</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {growthPredictions.map((pred) => {
                const isHighConfidence = pred.confidenceLevel >= 70;
                return (
                  <div key={pred.timeframe} className="bg-gradient-to-b from-indigo-50 to-white rounded-xl p-4 text-center border border-indigo-100">
                    <p className="text-xs font-medium text-indigo-500 mb-2">{pred.timeframe} 후</p>
                    <p className="text-3xl font-bold text-indigo-700 mb-1">{pred.predictedScore}<span className="text-base font-normal">점</span></p>
                    <div className="flex items-center justify-center gap-1">
                      <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isHighConfidence ? 'bg-green-400' : 'bg-yellow-400'}`}
                          style={{ width: `${pred.confidenceLevel}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{pred.confidenceLevel}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">달성 가능성</p>
                  </div>
                );
              })}
            </div>
            {growthPredictions[0]?.assumptions?.length > 0 && (
              <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                <p className="text-xs text-indigo-600 font-medium mb-1">✨ 이렇게 하면 달성 가능해요</p>
                <ul className="space-y-0.5">
                  {growthPredictions[0].assumptions.slice(0, 3).map((a, i) => (
                    <li key={i} className="text-xs text-indigo-700">• {a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ===== AI 맞춤 학습 전략 ===== */}
        {topPrescriptions.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">📚 지금 당장 이렇게 해봐요!</h2>
            <p className="text-sm text-gray-500 mb-5">최근 분석을 바탕으로 AI가 추천하는 학습 전략이에요.</p>
            <div className="space-y-4">
              {topPrescriptions.map((item, idx) => (
                <div key={idx} className={`rounded-xl p-4 border-l-4 ${
                  item.priority === 1 ? 'bg-red-50 border-red-400' :
                  item.priority === 2 ? 'bg-yellow-50 border-yellow-400' : 'bg-blue-50 border-blue-400'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      item.priority === 1 ? 'bg-red-100 text-red-700' :
                      item.priority === 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.priority === 1 ? '🔴 지금 바로' : item.priority === 2 ? '🟡 이번 주' : '🔵 꾸준히'}
                    </span>
                    <h3 className="font-semibold text-gray-800 text-sm">{item.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs bg-white/70 rounded-lg p-3">
                    {item.whatToDo && (
                      <div className="flex gap-1.5"><span className="text-indigo-500 font-medium shrink-0">📖 무엇을:</span><span className="text-gray-700">{item.whatToDo}</span></div>
                    )}
                    {item.howMuch && (
                      <div className="flex gap-1.5"><span className="text-indigo-500 font-medium shrink-0">⏱️ 얼마나:</span><span className="text-gray-700">{item.howMuch}</span></div>
                    )}
                    {item.howTo && (
                      <div className="flex gap-1.5 sm:col-span-2"><span className="text-indigo-500 font-medium shrink-0">💡 어떻게:</span><span className="text-gray-700">{item.howTo}</span></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 진행 중인 학습 계획 ===== */}
        <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">진행 중인 학습 계획</h2>
          {student.study_plans.length > 0 ? (
            <div className="space-y-4">
              {student.study_plans.map((plan) => (
                <div key={plan.id} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-800">{plan.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {plan.status === 'active' ? '진행중' : '준비중'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span>{plan.start_date} ~ {plan.end_date}</span>
                    <span>{plan.completed_tasks || 0}/{plan.total_tasks || 0} 완료</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${plan.progress_percentage || 0}%` }}
                    />
                  </div>
                  {plan.study_tasks && plan.study_tasks.length > 0 && (
                    <div className="space-y-1.5">
                      {plan.study_tasks.slice(0, 4).map((task) => (
                        <div key={task.id} className={`flex items-center gap-2 text-sm ${
                          task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-600'
                        }`}>
                          <span className={`w-4 h-4 rounded border flex items-center justify-center text-xs shrink-0 ${
                            task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                          }`}>
                            {task.status === 'completed' && '✓'}
                          </span>
                          <span className="truncate">{task.title}</span>
                          {task.estimated_minutes && task.status !== 'completed' && (
                            <span className="ml-auto text-xs text-gray-400 shrink-0">{task.estimated_minutes}분</span>
                          )}
                        </div>
                      ))}
                      {plan.study_tasks.length > 4 && (
                        <p className="text-xs text-gray-400 pl-6">외 {plan.study_tasks.length - 4}개 항목</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">등록된 학습 계획이 없습니다</p>
              <p className="text-xs mt-1">선생님이 분석 리포트를 작성하면 자동으로 생성돼요!</p>
            </div>
          )}
        </div>

        {/* ===== 리포트 목록 (필터) ===== */}
        <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">
              내 리포트
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({(reportTypeFilter === 'all' ? student.reports : student.reports.filter(r => r.report_type === reportTypeFilter)).length}개)
              </span>
            </h2>
          </div>
          {/* 필터 버튼 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'all', label: '전체' },
              { key: 'test', label: '시험' },
              { key: 'level_test', label: '레벨테스트' },
              { key: 'weekly', label: '주간' },
              { key: 'monthly', label: '월간' },
              { key: 'semi_annual', label: '반기' },
              { key: 'annual', label: '연간' },
              { key: 'self_analysis', label: '내 풀이' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setReportTypeFilter(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  reportTypeFilter === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {student.reports.length > 0 ? (() => {
            const filtered = reportTypeFilter === 'all'
              ? student.reports
              : student.reports.filter(r => r.report_type === reportTypeFilter);
            if (filtered.length === 0) {
              return (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">해당 유형의 리포트가 없습니다</p>
                  <button onClick={() => setReportTypeFilter('all')} className="mt-2 text-xs text-indigo-500 hover:underline">
                    전체 보기
                  </button>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((report) => {
                  const config = REPORT_TYPE_CONFIG[report.report_type as ReportType];
                  const analysis = report.analysis_data as AnalysisData | null;
                  return (
                    <Link key={report.id} href={`/student/reports/${report.id}`}
                      className="block border rounded-xl p-4 hover:shadow-md transition-shadow hover:border-indigo-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${config?.bgColor} ${config?.color}`}>
                          {config?.name || report.report_type}
                        </span>
                        {report.total_score != null && (
                          <span className="text-lg font-bold text-indigo-600">{report.total_score}점</span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-800 truncate text-sm">{report.test_name || '리포트'}</h3>
                      <p className="text-xs text-gray-500 mt-1">{report.test_date}</p>
                      {analysis?.macroAnalysis?.oneLineSummary && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{analysis.macroAnalysis.oneLineSummary}</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })() : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">아직 리포트가 없습니다</p>
            </div>
          )}
        </div>

        {/* ===== 내 풀이 분석받기 배너 ===== */}
        <div className="mb-6 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-4xl shrink-0">✨</span>
              <div>
                <h2 className="text-base font-bold mb-1">내 풀이를 AI가 분석해드려요!</h2>
                <p className="text-emerald-100 text-sm">
                  문제풀이 사진을 올리면 지금까지 쌓인 데이터와 비교하여 성장 분석을 해드립니다.
                </p>
              </div>
            </div>
            <Link href="/student/self-analysis/new"
              className="flex-shrink-0 px-4 py-2 bg-white text-emerald-700 font-semibold rounded-lg hover:bg-emerald-50 transition-colors text-sm">
              분석받기 →
            </Link>
          </div>
        </div>

        {/* ===== 개인화된 동기부여 메시지 ===== */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-8 text-white text-center">
          <div className="text-4xl mb-3">{motivation.emoji}</div>
          <h2 className="text-2xl font-bold mb-2">{motivation.title}</h2>
          <p className="text-indigo-100 max-w-md mx-auto">{motivation.message}</p>
        </div>

      </main>

      <footer className="bg-white border-t mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} 수학 학습 플랫폼. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
