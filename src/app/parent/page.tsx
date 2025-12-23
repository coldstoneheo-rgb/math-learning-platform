'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, Report } from '@/types';

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

  // 최근 5개 시험의 점수 추이 계산
  const getScoreTrend = (reports: Report[]) => {
    return reports
      .filter(r => r.report_type === 'test' && r.total_score && r.max_score)
      .slice(0, 5)
      .reverse()
      .map(r => ({
        date: r.test_date || '',
        name: r.test_name || '',
        score: r.total_score || 0,
        maxScore: r.max_score || 100,
        percentage: Math.round(((r.total_score || 0) / (r.max_score || 100)) * 100),
      }));
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

                {/* 성장 그래프 */}
                {getScoreTrend(selectedChild.reports).length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">성적 추이</h3>
                    <div className="h-48">
                      <SimpleBarChart data={getScoreTrend(selectedChild.reports)} />
                    </div>
                  </div>
                )}

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

// 간단한 막대 차트 컴포넌트
function SimpleBarChart({ data }: { data: { date: string; name: string; percentage: number }[] }) {
  const maxValue = 100;

  return (
    <div className="flex items-end justify-between h-full gap-2">
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center">
          <div className="text-sm font-semibold text-indigo-600 mb-1">{item.percentage}%</div>
          <div className="w-full bg-gray-100 rounded-t-lg relative" style={{ height: '120px' }}>
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-indigo-500 to-indigo-400 rounded-t-lg transition-all"
              style={{ height: `${(item.percentage / maxValue) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center truncate w-full" title={item.name}>
            {item.date ? new Date(item.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '-'}
          </div>
        </div>
      ))}
    </div>
  );
}
