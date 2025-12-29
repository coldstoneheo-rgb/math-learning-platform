'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, Assignment, AssignmentStatus } from '@/types';

interface AssignmentWithStudent extends Omit<Assignment, 'students'> {
  students: Pick<Student, 'id' | 'name' | 'grade'>;
}

const STATUS_LABELS: Record<AssignmentStatus, { label: string; color: string }> = {
  assigned: { label: '배정됨', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '진행중', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '완료', color: 'bg-green-100 text-green-700' },
  overdue: { label: '미완료', color: 'bg-red-100 text-red-700' },
};

export default function AssignmentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터
  const [filterStudent, setFilterStudent] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AssignmentStatus | 'all'>('all');

  // 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formStudentId, setFormStudentId] = useState<number | ''>('');
  const [formTitle, setFormTitle] = useState('');
  const [formSource, setFormSource] = useState('');
  const [formPageRange, setFormPageRange] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

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
    await loadData();
    setLoading(false);
  };

  const loadData = async () => {
    const supabase = createClient();

    // 학생 목록
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);

    // 숙제 목록
    const { data: assignmentsData } = await supabase
      .from('assignments')
      .select('*, students (id, name, grade)')
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: false });

    setAssignments(assignmentsData || []);
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const updateStatus = async (id: number, newStatus: AssignmentStatus) => {
    const supabase = createClient();

    const updateData: Partial<Assignment> = { status: newStatus };
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('assignments')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('상태 변경 오류:', error);
      return;
    }

    await loadData();
  };

  const deleteAssignment = async (id: number) => {
    if (!confirm('이 숙제를 삭제하시겠습니까?')) return;

    const supabase = createClient();
    const { error } = await supabase.from('assignments').delete().eq('id', id);

    if (error) {
      console.error('삭제 오류:', error);
      return;
    }

    await loadData();
  };

  const handleAddAssignment = async () => {
    if (!formStudentId || !formTitle.trim()) {
      alert('학생과 숙제 제목을 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.from('assignments').insert({
        student_id: formStudentId,
        title: formTitle,
        source: formSource || null,
        page_range: formPageRange || null,
        due_date: formDueDate || null,
        status: 'assigned',
        assignment_type: 'workbook',
      });

      if (error) throw error;

      // 폼 초기화
      setFormStudentId('');
      setFormTitle('');
      setFormSource('');
      setFormPageRange('');
      setFormDueDate('');
      setShowAddModal(false);

      await loadData();
    } catch (err) {
      console.error('추가 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 필터링된 숙제 목록
  const filteredAssignments = assignments.filter((a) => {
    if (filterStudent !== 'all' && a.student_id !== filterStudent) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    return true;
  });

  // 통계
  const stats = {
    total: assignments.length,
    pending: assignments.filter(a => a.status === 'assigned' || a.status === 'in_progress').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    overdue: assignments.filter(a => a.status === 'overdue').length,
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
            <a href="/admin" className="text-gray-500 hover:text-gray-700">
              ← 대시보드
            </a>
            <h1 className="text-xl font-bold text-gray-900">숙제 관리</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + 숙제 추가
            </button>
            <span className="text-gray-600">{user?.name} 선생님</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-gray-500">전체</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-gray-500">진행중</div>
            <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-gray-500">완료</div>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-gray-500">미완료</div>
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">학생</label>
              <select
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="all">전체</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({getGradeLabel(s.grade)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as AssignmentStatus | 'all')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="all">전체</option>
                <option value="assigned">배정됨</option>
                <option value="in_progress">진행중</option>
                <option value="completed">완료</option>
                <option value="overdue">미완료</option>
              </select>
            </div>
          </div>
        </div>

        {/* 숙제 목록 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {assignments.length === 0 ? (
                <>
                  등록된 숙제가 없습니다.
                  <br />
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 text-indigo-600 hover:text-indigo-700"
                  >
                    숙제 추가하기 →
                  </button>
                </>
              ) : (
                '필터 조건에 맞는 숙제가 없습니다.'
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">학생</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">숙제</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">교재/페이지</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">마감일</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">상태</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAssignments.map((assignment) => {
                  const isOverdue =
                    assignment.due_date &&
                    new Date(assignment.due_date) < new Date() &&
                    assignment.status !== 'completed';

                  return (
                    <tr key={assignment.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{assignment.students?.name}</div>
                        <div className="text-xs text-gray-500">
                          {getGradeLabel(assignment.students?.grade || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{assignment.title}</div>
                        {assignment.description && (
                          <div className="text-xs text-gray-500">{assignment.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {assignment.source && <div>{assignment.source}</div>}
                        {assignment.page_range && <div>{assignment.page_range}</div>}
                        {!assignment.source && !assignment.page_range && '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {assignment.due_date ? (
                          <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {new Date(assignment.due_date).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                            })}
                            {isOverdue && ' (지남)'}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[assignment.status].color}`}>
                          {STATUS_LABELS[assignment.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          {assignment.status !== 'completed' && (
                            <button
                              onClick={() => updateStatus(assignment.id, 'completed')}
                              className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded"
                            >
                              완료
                            </button>
                          )}
                          {assignment.status === 'completed' && (
                            <button
                              onClick={() => updateStatus(assignment.id, 'assigned')}
                              className="px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-50 rounded"
                            >
                              되돌리기
                            </button>
                          )}
                          <button
                            onClick={() => deleteAssignment(assignment.id)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">숙제 추가</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  학생 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(Number(e.target.value) || '')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">학생 선택</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({getGradeLabel(s.grade)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  숙제 제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="예: 3단원 복습 문제"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교재</label>
                  <input
                    type="text"
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    placeholder="체크체크 중1-2"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">페이지</label>
                  <input
                    type="text"
                    value={formPageRange}
                    onChange={(e) => setFormPageRange(e.target.value)}
                    placeholder="p.45-50"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">마감일</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddAssignment}
                disabled={saving || !formStudentId || !formTitle.trim()}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
