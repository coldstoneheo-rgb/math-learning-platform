'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Report, Student } from '@/types';

interface ReportWithStudent extends Report {
  students: Pick<Student, 'name' | 'student_id' | 'grade'>;
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<ReportWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'test' | 'weekly' | 'monthly'>('all');

  useEffect(() => {
    checkAuthAndLoadReports();
  }, []);

  const checkAuthAndLoadReports = async () => {
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
    await loadReports();
    setLoading(false);
  };

  const loadReports = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        students (name, student_id, grade)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('리포트 조회 오류:', error);
      return;
    }

    setReports(data || []);
  };

  const handleDelete = async (report: ReportWithStudent) => {
    if (!confirm(`"${report.test_name}" 리포트를 삭제하시겠습니까?`)) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', report.id);

    if (error) {
      alert('삭제 중 오류가 발생했습니다.');
      return;
    }

    await loadReports();
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const getReportTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      test: '시험 분석',
      weekly: '주간 리포트',
      monthly: '월간 리포트',
      consolidated: '통합 리포트',
    };
    return labels[type] || type;
  };

  const filteredReports = filter === 'all' 
    ? reports 
    : reports.filter(r => r.report_type === filter);

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
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-500 hover:text-gray-700">← 대시보드</a>
            <h1 className="text-xl font-bold text-gray-900">리포트 관리</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 상단 액션 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <p className="text-gray-600">총 {filteredReports.length}개</p>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="all">전체</option>
              <option value="test">시험 분석</option>
              <option value="weekly">주간 리포트</option>
              <option value="monthly">월간 리포트</option>
            </select>
          </div>
          <a
            href="/admin/reports/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + 새 리포트
          </a>
        </div>

        {/* 리포트 목록 */}
        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">생성된 리포트가 없습니다.</p>
            <a href="/admin/reports/new" className="text-indigo-600 hover:text-indigo-700 font-medium">
              첫 리포트 생성하기
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시험명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">점수</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시험일</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {report.students?.name || '알 수 없음'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {report.students?.student_id} · {report.students && getGradeLabel(report.students.grade)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{report.test_name || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded">
                        {getReportTypeLabel(report.report_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="font-semibold text-gray-900">{report.total_score || 0}</span>
                      <span className="text-gray-500">/{report.max_score || 100}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{report.test_date || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`/admin/reports/${report.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                      >
                        상세
                      </a>
                      <button
                        onClick={() => handleDelete(report)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
