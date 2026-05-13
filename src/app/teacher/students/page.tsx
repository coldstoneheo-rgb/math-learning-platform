'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Student, User } from '@/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';

// 학생 가입 계정 (auth users 중 role='student')
interface StudentUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export default function StudentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    grade: '',
    school: '',
    start_date: '',
    learning_style: '' as '' | 'visual' | 'verbal' | 'logical',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 계정 연결 모달 상태
  const [showAccountLinkModal, setShowAccountLinkModal] = useState(false);
  const [linkingStudent, setLinkingStudent] = useState<Student | null>(null);
  const [studentUsers, setStudentUsers] = useState<StudentUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

  useEffect(() => {
    checkAuthAndLoadStudents();
  }, []);

  const checkAuthAndLoadStudents = async () => {
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
    await loadStudents();
    setLoading(false);
  };

  const loadStudents = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('학생 목록 조회 오류:', error);
      return;
    }

    setStudents(data || []);
  };

  const generateStudentId = async (grade: number): Promise<string> => {
    const supabase = createClient();
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    
    // 학년에 따른 레벨 결정
    let level = 'M'; // 기본 중등
    if (grade <= 6) level = 'P'; // 초등
    else if (grade <= 9) level = 'M'; // 중등
    else level = 'H'; // 고등

    // 해당 레벨+연도의 마지막 시퀀스 조회
    const prefix = `${level}${year}`;
    const { data } = await supabase
      .from('students')
      .select('student_id')
      .like('student_id', `${prefix}%`)
      .order('student_id', { ascending: false })
      .limit(1);

    let sequence = 1;
    if (data && data.length > 0) {
      const lastId = data[0].student_id;
      const lastSeq = parseInt(lastId.slice(-3), 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${grade}${sequence.toString().padStart(3, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const supabase = createClient();
      const gradeNum = parseInt(formData.grade, 10);

      if (editingStudent) {
        // 수정
        const { error } = await supabase
          .from('students')
          .update({
            name: formData.name.trim(),
            grade: gradeNum,
            school: formData.school.trim() || null,
            start_date: formData.start_date || null,
            learning_style: formData.learning_style || null,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;
      } else {
        // 추가
        const studentId = await generateStudentId(gradeNum);
        const { error } = await supabase
          .from('students')
          .insert({
            student_id: studentId,
            name: formData.name.trim(),
            grade: gradeNum,
            school: formData.school.trim() || null,
            start_date: formData.start_date || null,
            learning_style: formData.learning_style || null,
          });

        if (error) throw error;
      }

      await loadStudents();
      closeModal();
    } catch (err) {
      console.error('저장 오류:', err);
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생���습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      grade: student.grade.toString(),
      school: student.school || '',
      start_date: student.start_date || '',
      learning_style: student.learning_style || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (student: Student) => {
    if (!confirm(`"${student.name}" 학생을 삭제하시겠습니까?\n관련된 모든 리포트도 함께 삭제됩니다.`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (error) throw error;
      await loadStudents();
    } catch (err) {
      console.error('삭제 오류:', err);
      addToast(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormData({
      name: '',
      grade: '',
      school: '',
      start_date: '',
      learning_style: '',
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setError('');
  };

  // 계정 연결 모달 열기: role='student'인 미연결 계정 목록 조회
  const openAccountLinkModal = async (student: Student) => {
    setLinkingStudent(student);
    setSelectedUserId(student.user_id || '');
    setShowAccountLinkModal(true);

    const supabase = createClient();
    // role='student'인 전체 사용자 조회
    const { data: allStudentUsers } = await supabase
      .from('users')
      .select('id, email, name, created_at')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (!allStudentUsers) { setStudentUsers([]); return; }

    // 이미 다른 학생 프로필에 연결된 user_id 목록 조회 (현재 편집 중인 학생 제외)
    const { data: linkedStudents } = await supabase
      .from('students')
      .select('user_id')
      .not('user_id', 'is', null)
      .neq('id', student.id);

    const linkedUserIds = new Set((linkedStudents || []).map(s => s.user_id));
    // 미연결 계정 + 현재 이미 연결된 계정 포함 (선택 해제 옵션 위해)
    setStudentUsers(allStudentUsers.filter(u => !linkedUserIds.has(u.id)) as StudentUser[]);
  };

  const closeAccountLinkModal = () => {
    setShowAccountLinkModal(false);
    setLinkingStudent(null);
    setStudentUsers([]);
    setSelectedUserId('');
  };

  const handleAccountLink = async () => {
    if (!linkingStudent) return;
    setLinkSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('students')
        .update({ user_id: selectedUserId || null })
        .eq('id', linkingStudent.id);

      if (error) throw error;

      addToast(
        selectedUserId ? '학생 계정이 연결되었습니다.' : '계정 연결이 해제되었습니다.',
        'success'
      );
      await loadStudents();
      closeAccountLinkModal();
    } catch (err) {
      console.error('계정 연결 오류:', err);
      addToast(err instanceof Error ? err.message : '계정 연결 중 오류가 발생했습니다.', 'error');
    } finally {
      setLinkSaving(false);
    }
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toasts={toasts} onRemove={removeToast} />
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/teacher" className="text-gray-500 hover:text-gray-700">
              ← 대시보드
            </a>
            <h1 className="text-xl font-bold text-gray-900">학생 관리</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      {/* 메인 */}
      <main className="container mx-auto px-4 py-8">
        {/* 상단 액션 */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">총 {students.length}명</p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + 학생 추가
          </button>
        </div>

        {/* 학생 목록 */}
        {students.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">등록된 학생이 없습니다.</p>
            <button
              onClick={openAddModal}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              첫 학생 추가하기
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">학생 ID</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">이름</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">학년</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap hidden sm:table-cell">학교</th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">계정 연결</th>
                  <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4 text-sm font-mono text-gray-500">{student.student_id}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-gray-600">{getGradeLabel(student.grade)}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-sm text-gray-600 hidden sm:table-cell">{student.school || '-'}</td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      {student.user_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
                          연결됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          미연결
                        </span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right">
                      <button
                        onClick={() => openAccountLinkModal(student)}
                        className="text-emerald-700 hover:text-emerald-900 text-sm mr-3"
                      >
                        계정 연결
                      </button>
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(student)}
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

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingStudent ? '학생 정보 수정' : '새 학생 추가'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  학년 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="">선택하세요</option>
                  <optgroup label="초등학교">
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <option key={g} value={g}>초등 {g}학년</option>
                    ))}
                  </optgroup>
                  <optgroup label="중학교">
                    {[7, 8, 9].map((g) => (
                      <option key={g} value={g}>중등 {g - 6}학년</option>
                    ))}
                  </optgroup>
                  <optgroup label="고등학교">
                    {[10, 11, 12].map((g) => (
                      <option key={g} value={g}>고등 {g - 9}학년</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학교</label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="OO중학교"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수업 시작일</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학습 스타일</label>
                <select
                  value={formData.learning_style}
                  onChange={(e) => setFormData({ ...formData, learning_style: e.target.value as 'visual' | 'verbal' | 'logical' | '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="">선택 안 함</option>
                  <option value="visual">시각형 (Visual)</option>
                  <option value="verbal">언어형 (Verbal)</option>
                  <option value="logical">논리형 (Logical)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? '저장 중...' : editingStudent ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 계정 연결 모달 */}
      {showAccountLinkModal && linkingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">학생 계정 연결</h2>
              <p className="text-sm text-gray-500 mt-1">{linkingStudent.name} 학생의 로그인 계정을 연결합니다.</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="account-link-select" className="block text-sm font-medium text-gray-700 mb-1">
                  학생 계정 선택
                </label>
                {studentUsers.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-sm">연결 가능한 학생 계정이 없습니다.</p>
                    <p className="text-gray-400 text-xs mt-1">'학생'으로 가입한 사용자가 없거나 모두 다른 학생과 연결되어 있습니다.</p>
                  </div>
                ) : (
                  <select
                    id="account-link-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">연결 해제 (미연결 상태로 변경)</option>
                    {studentUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {linkingStudent.user_id && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  현재 연결됨: {studentUsers.find(u => u.id === linkingStudent.user_id)?.email || '(ID: ' + linkingStudent.user_id?.slice(0, 8) + '...)'}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAccountLinkModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleAccountLink}
                  disabled={linkSaving || studentUsers.length === 0}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {linkSaving ? '저장 중...' : selectedUserId ? '연결' : '연결 해제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
