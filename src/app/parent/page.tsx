'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, Report, AnalysisData } from '@/types';
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

interface StudentWithReports extends Student {
  reports: Report[];
}

export default function ParentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [children, setChildren] = useState<StudentWithReports[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<StudentWithReports | null>(null);

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
      router.push('/admin');
      return;
    }

    // 학부모가 아니면 접근 불가
    if (userData.role !== 'parent') {
      router.push('/');
      return;
    }

    setUser(userData);
    await loadChildren(authUser.id);
    setLoading(false);
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

    // 각 자녀의 리포트 조회
    const childrenWithReports: StudentWithReports[] = [];
    for (const student of studentData || []) {
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('student_id', student.id)
        .order('test_date', { ascending: false });

      childrenWithReports.push({
        ...student,
        reports: reports || [],
      });
    }

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
      test: '시험 분석',
      weekly: '주간 리포트',
      monthly: '월간 리포트',
      consolidated: '통합 분석',
    };
    return labels[type] || type;
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-indigo-600">수학 학습 분석</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.name}님</span>
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

                {/* 성장 그래프 섹션 */}
                <GrowthChartSection
                  scoreTrend={getScoreTrend(selectedChild.reports)}
                  mathCapability={getMathCapabilityData(selectedChild.reports)}
                  growthRate={getGrowthRate(selectedChild.reports)}
                />

                {/* 최근 리포트 목록 */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">리포트 목록</h3>

                  {selectedChild.reports.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      아직 생성된 리포트가 없습니다.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedChild.reports.map((report) => (
                        <a
                          key={report.id}
                          href={`/parent/reports/${report.id}`}
                          className="block p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="inline-block px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded mb-2">
                                {getReportTypeLabel(report.report_type)}
                              </span>
                              <h4 className="font-medium text-gray-900">
                                {report.test_name || '리포트'}
                              </h4>
                              <p className="text-sm text-gray-500 mt-1">
                                {report.test_date || new Date(report.created_at).toLocaleDateString('ko-KR')}
                              </p>
                            </div>
                            {report.total_score !== null && report.max_score && (
                              <div className="text-right">
                                <div className="text-2xl font-bold text-indigo-600">
                                  {report.total_score}
                                </div>
                                <div className="text-sm text-gray-500">
                                  / {report.max_score}점
                                </div>
                              </div>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
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
