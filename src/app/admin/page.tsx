'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Report, Student } from '@/types';

interface ReportWithStudent extends Report {
  students: Pick<Student, 'name' | 'grade'>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ students: 0, reports: 0 });
  const [recentReports, setRecentReports] = useState<ReportWithStudent[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
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

      setStats({
        students: studentCount || 0,
        reports: reportCount || 0,
      });

      // 최근 리포트 로드
      const { data: reports } = await supabase
        .from('reports')
        .select(`*, students (name, grade)`)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentReports(reports || []);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

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
          <a href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-700">
            수학 학습 분석
          </a>
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
          <StatCard label="이번 주 분석" value={0} unit="건" />
          <StatCard label="평균 점수" value={0} unit="점" />
        </div>

        {/* 퀵 액션 카드 */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <DashboardCard
            title="학생 관리"
            description="학생 추가, 수정, 삭제"
            icon="👨‍🎓"
            href="/admin/students"
          />
          <DashboardCard
            title="학부모 관리"
            description="학부모 계정 생성 및 자녀 연결"
            icon="👨‍👩‍👧"
            href="/admin/parents"
          />
          <DashboardCard
            title="리포트 생성"
            description="시험지 분석 및 리포트 생성"
            icon="📊"
            href="/admin/reports/new"
          />
          <DashboardCard
            title="리포트 관리"
            description="생성된 리포트 조회 및 관리"
            icon="📋"
            href="/admin/reports"
          />
        </div>

        {/* 최근 리포트 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">최근 리포트</h3>
            <a href="/admin/reports" className="text-sm text-indigo-600 hover:text-indigo-700">
              전체 보기 →
            </a>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              아직 생성된 리포트가 없습니다.<br />
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
                  <div>
                    <span className="font-medium text-gray-900">{report.students?.name}</span>
                    <span className="text-gray-500 mx-2">·</span>
                    <span className="text-gray-600">{report.test_name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-indigo-600">
                      {report.total_score}/{report.max_score}
                    </span>
                    <span className="text-sm text-gray-400">{report.test_date}</span>
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

function StatCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">
        {value}<span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </div>
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
      className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-gray-100"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 text-sm">{description}</p>
    </a>
  );
}
