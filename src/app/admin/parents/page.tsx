'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student } from '@/types';

interface ParentWithChildren extends User {
  students: Pick<Student, 'id' | 'name' | 'grade'>[];
}

export default function ParentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [parents, setParents] = useState<ParentWithChildren[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentWithChildren | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
  });
  const [linkData, setLinkData] = useState({
    studentId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

    if (!userData || userData.role !== 'teacher') {
      router.push('/');
      return;
    }

    setUser(userData);
    await Promise.all([loadParents(), loadStudents()]);
    setLoading(false);
  };

  const loadParents = async () => {
    const supabase = createClient();

    // 학부모 목록 조회
    const { data: parentUsers, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'parent')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('학부모 목록 조회 오류:', error);
      return;
    }

    // 각 학부모의 자녀 정보 조회
    const parentsWithChildren: ParentWithChildren[] = [];
    for (const parent of parentUsers || []) {
      const { data: children } = await supabase
        .from('students')
        .select('id, name, grade')
        .eq('parent_id', parent.id);

      parentsWithChildren.push({
        ...parent,
        students: children || [],
      });
    }

    setParents(parentsWithChildren);
  };

  const loadStudents = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('name');

    if (error) {
      console.error('학생 목록 조회 오류:', error);
      return;
    }

    setStudents(data || []);
  };

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const supabase = createClient();

      // 1. Supabase Auth로 계정 생성
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('계정 생성 실패');

      // 2. users 테이블에 정보 저장 (upsert: 트리거가 이미 생성했을 수 있음)
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: formData.email,
          name: formData.name,
          role: 'parent',
        }, { onConflict: 'id' });

      if (userError) throw userError;

      setSuccessMessage(`학부모 계정이 생성되었습니다. (${formData.email})`);
      await loadParents();
      closeModal();
    } catch (err: any) {
      console.error('계정 생성 오류:', err);
      setError(err.message || '계정 생성 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParent) return;

    setError('');
    setSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('students')
        .update({ parent_id: selectedParent.id })
        .eq('id', parseInt(linkData.studentId));

      if (error) throw error;

      setSuccessMessage('자녀가 연결되었습니다.');
      await Promise.all([loadParents(), loadStudents()]);
      closeLinkModal();
    } catch (err: any) {
      console.error('연결 오류:', err);
      setError(err.message || '연결 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkStudent = async (studentId: number) => {
    if (!confirm('이 자녀와의 연결을 해제하시겠습니까?')) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('students')
        .update({ parent_id: null })
        .eq('id', studentId);

      if (error) throw error;

      setSuccessMessage('연결이 해제되었습니다.');
      await Promise.all([loadParents(), loadStudents()]);
    } catch (err: any) {
      console.error('연결 해제 오류:', err);
      alert('연결 해제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteParent = async (parent: ParentWithChildren) => {
    if (parent.students.length > 0) {
      alert('먼저 연결된 자녀를 모두 해제해주세요.');
      return;
    }

    if (!confirm(`"${parent.name}" 학부모 계정을 삭제하시겠습니까?`)) return;

    try {
      const supabase = createClient();

      // users 테이블에서 삭제
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', parent.id);

      if (error) throw error;

      setSuccessMessage('학부모 계정이 삭제되었습니다.');
      await loadParents();
    } catch (err: any) {
      console.error('삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const openAddModal = () => {
    setFormData({ email: '', name: '', password: '' });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError('');
  };

  const openLinkModal = (parent: ParentWithChildren) => {
    setSelectedParent(parent);
    setLinkData({ studentId: '' });
    setError('');
    setShowLinkModal(true);
  };

  const closeLinkModal = () => {
    setShowLinkModal(false);
    setSelectedParent(null);
    setError('');
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  // 연결 가능한 학생 (아직 학부모가 없는 학생)
  const availableStudents = students.filter(s => !s.parent_id);

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
            <h1 className="text-xl font-bold text-gray-900">학부모 계정 관리</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      {/* 메인 */}
      <main className="container mx-auto px-4 py-8">
        {/* 성공 메시지 */}
        {successMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="text-green-700 hover:text-green-900">
              ✕
            </button>
          </div>
        )}

        {/* 상단 액션 */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600">총 {parents.length}명</p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + 학부모 계정 생성
          </button>
        </div>

        {/* 학부모 목록 */}
        {parents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">등록된 학부모가 없습니다.</p>
            <button
              onClick={openAddModal}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              첫 학부모 계정 생성하기
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">연결된 자녀</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {parents.map((parent) => (
                  <tr key={parent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{parent.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{parent.email}</td>
                    <td className="px-6 py-4">
                      {parent.students.length === 0 ? (
                        <span className="text-gray-400 text-sm">연결된 자녀 없음</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {parent.students.map((child) => (
                            <span
                              key={child.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm"
                            >
                              {child.name} ({getGradeLabel(child.grade)})
                              <button
                                onClick={() => handleUnlinkStudent(child.id)}
                                className="text-indigo-400 hover:text-indigo-600 ml-1"
                                title="연결 해제"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(parent.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openLinkModal(parent)}
                        className="text-indigo-600 hover:text-indigo-800 text-sm mr-3"
                      >
                        자녀 연결
                      </button>
                      <button
                        onClick={() => handleDeleteParent(parent)}
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

        {/* 안내 메시지 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">학부모 계정 안내</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 학부모 계정을 생성하면 해당 이메일로 로그인할 수 있습니다.</li>
            <li>• 자녀를 연결하면 해당 학생의 리포트를 열람할 수 있습니다.</li>
            <li>• 한 학부모가 여러 자녀를 연결할 수 있습니다.</li>
          </ul>
        </div>
      </main>

      {/* 계정 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">학부모 계정 생성</h2>
            </div>

            <form onSubmit={handleCreateParent} className="p-6 space-y-4">
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
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="parent@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  초기 비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="6자 이상"
                />
                <p className="mt-1 text-xs text-gray-500">학부모에게 전달할 초기 비밀번호입니다.</p>
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
                  {saving ? '생성 중...' : '계정 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 자녀 연결 모달 */}
      {showLinkModal && selectedParent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">자녀 연결</h2>
              <p className="text-sm text-gray-500 mt-1">{selectedParent.name} 학부모</p>
            </div>

            <form onSubmit={handleLinkStudent} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {availableStudents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-500">연결 가능한 학생이 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-1">
                    모든 학생이 이미 학부모와 연결되어 있습니다.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    학생 선택 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={linkData.studentId}
                    onChange={(e) => setLinkData({ studentId: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">학생을 선택하세요</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({getGradeLabel(student.grade)})
                        {student.school && ` - ${student.school}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeLinkModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                {availableStudents.length > 0 && (
                  <button
                    type="submit"
                    disabled={saving || !linkData.studentId}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '연결 중...' : '연결'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
