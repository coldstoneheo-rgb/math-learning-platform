'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Student, User } from '@/types';

export default function StudentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
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
    } catch (err: any) {
      console.error('저장 오류:', err);
      setError(err.message || '저장 중 오류가 발생했습니다.');
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
    } catch (err: any) {
      console.error('삭제 오류:', err);
      alert('삭제 중 오류가 발생했습니다.');
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
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-500 hover:text-gray-700">
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
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생 ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">학년</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">학교</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시작일</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{student.student_id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{getGradeLabel(student.grade)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.school || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.start_date || '-'}</td>
                    <td className="px-6 py-4 text-right">
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
                  onChange={(e) => setFormData({ ...formData, learning_style: e.target.value as any })}
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
    </div>
  );
}
