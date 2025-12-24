'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Report, Student, ReportType } from '@/types';

interface ReportWithStudent extends Report {
  students: Pick<Student, 'name' | 'student_id' | 'grade'>;
}

// 리포트 타입 정의 (향후 확장 가능)
const REPORT_TYPES: { key: ReportType | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'test', label: '시험' },
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
  { key: 'consolidated', label: '통합' },
];

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [reports, setReports] = useState<ReportWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState<Set<ReportType | 'all'>>(new Set(['all']));

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

  // 필터 토글 함수
  const toggleFilter = (key: ReportType | 'all') => {
    const newFilters = new Set(selectedFilters);

    if (key === 'all') {
      // '전체' 선택 시 다른 필터 모두 해제
      newFilters.clear();
      newFilters.add('all');
    } else {
      // 개별 필터 선택 시 '전체' 해제
      newFilters.delete('all');

      if (newFilters.has(key)) {
        newFilters.delete(key);
        // 모든 필터가 해제되면 '전체' 선택
        if (newFilters.size === 0) {
          newFilters.add('all');
        }
      } else {
        newFilters.add(key);
      }
    }

    setSelectedFilters(newFilters);
  };

  // 필터링된 리포트
  const filteredReports = selectedFilters.has('all')
    ? reports
    : reports.filter(r => selectedFilters.has(r.report_type as ReportType));

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
        {/* 필터 태그 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 mr-2">필터:</span>
            {REPORT_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => toggleFilter(type.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedFilters.has(type.key)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
            <span className="ml-auto text-sm text-gray-500">
              총 {filteredReports.length}개
            </span>
          </div>
        </div>

        {/* 리포트 목록 */}
        {filteredReports.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">생성된 리포트가 없습니다.</p>
            <a href="/admin/reports/create" className="text-indigo-600 hover:text-indigo-700 font-medium">
              첫 리포트 생성하기
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">작성일</th>
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
                        {report.students && getGradeLabel(report.students.grade)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {report.test_name || getReportTypeLabel(report.report_type)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded ${
                        report.report_type === 'test' ? 'bg-blue-100 text-blue-700' :
                        report.report_type === 'weekly' ? 'bg-green-100 text-green-700' :
                        report.report_type === 'monthly' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {getReportTypeLabel(report.report_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(report.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`/admin/reports/${report.id}`}
                        className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                      >
                        보기
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
