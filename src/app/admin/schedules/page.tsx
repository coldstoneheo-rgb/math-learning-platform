'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, Schedule, ScheduleInput } from '@/types';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface ScheduleWithStudent extends Omit<Schedule, 'students'> {
  students: Pick<Student, 'id' | 'name' | 'grade' | 'student_id'>;
}

export default function SchedulesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithStudent | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<ScheduleInput>({
    student_id: 0,
    day_of_week: 1, // 기본값: 월요일
    start_time: '16:00',
    end_time: '17:30',
    is_active: true,
  });

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

    // 학생 목록 로드
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);

    // 스케줄 로드 (학생 정보 포함)
    const { data: schedulesData } = await supabase
      .from('schedules')
      .select('*, students (id, name, grade, student_id)')
      .order('day_of_week')
      .order('start_time');

    setSchedules(schedulesData || []);
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const formatTime = (time: string): string => {
    // "HH:MM:SS" -> "HH:MM"
    return time.substring(0, 5);
  };

  const openAddModal = () => {
    setEditingSchedule(null);
    setFormData({
      student_id: students[0]?.id || 0,
      day_of_week: 1,
      start_time: '16:00',
      end_time: '17:30',
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (schedule: ScheduleWithStudent) => {
    setEditingSchedule(schedule);
    setFormData({
      student_id: schedule.student_id,
      day_of_week: schedule.day_of_week,
      start_time: formatTime(schedule.start_time),
      end_time: schedule.end_time ? formatTime(schedule.end_time) : '',
      is_active: schedule.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.student_id) {
      alert('학생을 선택해주세요.');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      if (editingSchedule) {
        // 수정
        const { error } = await supabase
          .from('schedules')
          .update({
            student_id: formData.student_id,
            day_of_week: formData.day_of_week,
            start_time: formData.start_time,
            end_time: formData.end_time || null,
            is_active: formData.is_active,
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;
      } else {
        // 추가
        const { error } = await supabase
          .from('schedules')
          .insert({
            student_id: formData.student_id,
            day_of_week: formData.day_of_week,
            start_time: formData.start_time,
            end_time: formData.end_time || null,
            is_active: formData.is_active,
          });

        if (error) throw error;
      }

      await loadData();
      setShowModal(false);
    } catch (err: unknown) {
      console.error('저장 오류:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 수업 일정을 삭제하시겠습니까?')) return;

    const supabase = createClient();
    const { error } = await supabase.from('schedules').delete().eq('id', id);

    if (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
      return;
    }

    await loadData();
  };

  const toggleActive = async (schedule: ScheduleWithStudent) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('schedules')
      .update({ is_active: !schedule.is_active })
      .eq('id', schedule.id);

    if (error) {
      console.error('상태 변경 오류:', error);
      return;
    }

    await loadData();
  };

  // 요일별로 스케줄 그룹화
  const schedulesByDay = DAY_LABELS.map((_, dayIndex) => ({
    day: dayIndex,
    label: DAY_LABELS[dayIndex],
    schedules: schedules.filter(s => s.day_of_week === dayIndex),
  }));

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
            <h1 className="text-xl font-bold text-gray-900">수업 일정 관리</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              + 일정 추가
            </button>
            <span className="text-gray-600">{user?.name} 선생님</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 요일별 스케줄 그리드 */}
        <div className="grid grid-cols-7 gap-4">
          {schedulesByDay.map(({ day, label, schedules: daySchedules }) => (
            <div
              key={day}
              className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                day === 0 || day === 6 ? 'bg-gray-50' : ''
              }`}
            >
              {/* 요일 헤더 */}
              <div
                className={`px-4 py-3 text-center font-semibold border-b ${
                  day === 0
                    ? 'bg-red-50 text-red-600'
                    : day === 6
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-50 text-gray-700'
                }`}
              >
                {label}요일
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({daySchedules.filter(s => s.is_active).length}명)
                </span>
              </div>

              {/* 스케줄 목록 */}
              <div className="p-2 space-y-2 min-h-[200px]">
                {daySchedules.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">
                    수업 없음
                  </p>
                ) : (
                  daySchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`p-3 rounded-lg border transition-all ${
                        schedule.is_active
                          ? 'bg-white border-gray-200 hover:border-indigo-300'
                          : 'bg-gray-100 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-900 text-sm">
                          {schedule.students?.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getGradeLabel(schedule.students?.grade || 0)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        {formatTime(schedule.start_time)}
                        {schedule.end_time && ` - ${formatTime(schedule.end_time)}`}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(schedule)}
                          className="flex-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => toggleActive(schedule)}
                          className={`flex-1 px-2 py-1 text-xs rounded ${
                            schedule.is_active
                              ? 'text-yellow-600 hover:bg-yellow-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {schedule.is_active ? '비활성화' : '활성화'}
                        </button>
                        <button
                          onClick={() => handleDelete(schedule.id)}
                          className="flex-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 학생별 일정 요약 */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">학생별 수업 일정</h2>

          {students.length === 0 ? (
            <p className="text-gray-500 text-center py-4">등록된 학생이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">학생</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">학년</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">수업 일정</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700">주당 수업</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((student) => {
                    const studentSchedules = schedules.filter(
                      (s) => s.student_id === student.id && s.is_active
                    );
                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {getGradeLabel(student.grade)}
                        </td>
                        <td className="px-4 py-3">
                          {studentSchedules.length === 0 ? (
                            <span className="text-gray-400">미등록</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {studentSchedules
                                .sort((a, b) => a.day_of_week - b.day_of_week)
                                .map((s) => (
                                  <span
                                    key={s.id}
                                    className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs"
                                  >
                                    {DAY_LABELS[s.day_of_week]} {formatTime(s.start_time)}
                                  </span>
                                ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-indigo-600">
                            {studentSchedules.length}회
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSchedule ? '수업 일정 수정' : '수업 일정 추가'}
            </h3>

            <div className="space-y-4">
              {/* 학생 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  학생 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.student_id}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, student_id: Number(e.target.value) }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value={0}>학생을 선택하세요</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({getGradeLabel(student.grade)})
                    </option>
                  ))}
                </select>
              </div>

              {/* 요일 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  요일 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {DAY_LABELS.map((label, index) => (
                    <button
                      key={index}
                      onClick={() => setFormData((prev) => ({ ...prev, day_of_week: index }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.day_of_week === index
                          ? 'bg-indigo-600 text-white'
                          : index === 0
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : index === 6
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 시간 설정 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작 시간 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, start_time: e.target.value }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    value={formData.end_time || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, end_time: e.target.value }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 활성화 상태 */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  활성화 (체크 해제 시 일시 중단)
                </label>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.student_id}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
