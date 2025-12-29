'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Student, ClassSession, ClassSessionInput, AssignmentInput } from '@/types';

function ClassRecordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedStudentId = searchParams.get('student');

  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [recentSessions, setRecentSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 폼 상태
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>(
    preselectedStudentId ? Number(preselectedStudentId) : ''
  );
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [learningKeywords, setLearningKeywords] = useState<string[]>(['']);
  const [coveredConcepts, setCoveredConcepts] = useState<string[]>(['']);
  const [summary, setSummary] = useState('');
  const [understandingLevel, setUnderstandingLevel] = useState<number>(3);
  const [attentionLevel, setAttentionLevel] = useState<number>(3);
  const [notes, setNotes] = useState('');

  // 숙제 추가 옵션
  const [addAssignment, setAddAssignment] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentSource, setAssignmentSource] = useState('');
  const [assignmentPageRange, setAssignmentPageRange] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState('');

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      loadRecentSessions(selectedStudentId);
    }
  }, [selectedStudentId]);

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

    // 학생 목록 로드
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);
    setLoading(false);
  };

  const loadRecentSessions = async (studentId: number) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('student_id', studentId)
      .order('session_date', { ascending: false })
      .limit(5);

    setRecentSessions(data || []);
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const handleKeywordAdd = () => {
    setLearningKeywords([...learningKeywords, '']);
  };

  const handleKeywordRemove = (index: number) => {
    setLearningKeywords(learningKeywords.filter((_, i) => i !== index));
  };

  const handleKeywordChange = (index: number, value: string) => {
    const updated = [...learningKeywords];
    updated[index] = value;
    setLearningKeywords(updated);
  };

  const handleConceptAdd = () => {
    setCoveredConcepts([...coveredConcepts, '']);
  };

  const handleConceptRemove = (index: number) => {
    setCoveredConcepts(coveredConcepts.filter((_, i) => i !== index));
  };

  const handleConceptChange = (index: number, value: string) => {
    const updated = [...coveredConcepts];
    updated[index] = value;
    setCoveredConcepts(updated);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    if (!sessionDate) {
      setError('수업 날짜를 입력해주세요.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // 수업 기록 저장
      const sessionData: ClassSessionInput = {
        student_id: selectedStudentId,
        session_date: sessionDate,
        start_time: startTime || undefined,
        end_time: endTime || undefined,
        learning_keywords: learningKeywords.filter(k => k.trim()),
        covered_concepts: coveredConcepts.filter(c => c.trim()),
        summary: summary || undefined,
        understanding_level: understandingLevel,
        attention_level: attentionLevel,
        notes: notes || undefined,
      };

      const { data: sessionResult, error: sessionError } = await supabase
        .from('class_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 숙제 추가 (옵션)
      if (addAssignment && assignmentTitle.trim()) {
        const assignmentData: AssignmentInput = {
          student_id: selectedStudentId,
          class_session_id: sessionResult.id,
          assignment_type: 'workbook',
          title: assignmentTitle,
          source: assignmentSource || undefined,
          page_range: assignmentPageRange || undefined,
          due_date: assignmentDueDate || undefined,
          status: 'assigned',
        };

        const { error: assignmentError } = await supabase
          .from('assignments')
          .insert(assignmentData);

        if (assignmentError) throw assignmentError;
      }

      setSuccess('수업 기록이 저장되었습니다!');

      // 폼 초기화
      setLearningKeywords(['']);
      setCoveredConcepts(['']);
      setSummary('');
      setNotes('');
      setAddAssignment(false);
      setAssignmentTitle('');
      setAssignmentSource('');
      setAssignmentPageRange('');
      setAssignmentDueDate('');

      // 최근 기록 갱신
      loadRecentSessions(selectedStudentId);

    } catch (err: unknown) {
      console.error('저장 오류:', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/admin" className="text-gray-500 hover:text-gray-700">
              ← 대시보드
            </a>
            <h1 className="text-xl font-bold text-gray-900">수업 기록</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 메인 폼 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 기본 정보 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 기본 정보</h2>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    학생 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(Number(e.target.value) || '')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">학생 선택</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} ({getGradeLabel(student.grade)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    수업 날짜 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작 시간
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료 시간
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 학습 내용 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 학습 내용</h2>

              {/* 학습 키워드 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  학습 키워드 (태그)
                </label>
                <div className="space-y-2">
                  {learningKeywords.map((keyword, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => handleKeywordChange(index, e.target.value)}
                        placeholder="예: 일차방정식, 좌표평면"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                      {learningKeywords.length > 1 && (
                        <button
                          onClick={() => handleKeywordRemove(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleKeywordAdd}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  + 키워드 추가
                </button>
              </div>

              {/* 다룬 개념 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  다룬 개념
                </label>
                <div className="space-y-2">
                  {coveredConcepts.map((concept, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={concept}
                        onChange={(e) => handleConceptChange(index, e.target.value)}
                        placeholder="예: 이항, 등식의 성질"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                      {coveredConcepts.length > 1 && (
                        <button
                          onClick={() => handleConceptRemove(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleConceptAdd}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  + 개념 추가
                </button>
              </div>

              {/* 수업 요약 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  수업 요약
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="오늘 수업 내용 간략 요약..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>
            </div>

            {/* 학생 상태 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 학생 상태</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* 이해도 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이해도
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setUnderstandingLevel(level)}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                          understandingLevel === level
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>낮음</span>
                    <span>높음</span>
                  </div>
                </div>

                {/* 집중도 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    집중도
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setAttentionLevel(level)}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                          attentionLevel === level
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>낮음</span>
                    <span>높음</span>
                  </div>
                </div>
              </div>

              {/* 메모 */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  선생님 메모
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="특이사항, 다음 수업 참고 사항 등..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>
            </div>

            {/* 숙제 배정 */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">4. 숙제 배정 (선택)</h2>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={addAssignment}
                    onChange={(e) => setAddAssignment(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">숙제 추가</span>
                </label>
              </div>

              {addAssignment && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      숙제 제목 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={assignmentTitle}
                      onChange={(e) => setAssignmentTitle(e.target.value)}
                      placeholder="예: 체크체크 3단원 복습"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        교재
                      </label>
                      <input
                        type="text"
                        value={assignmentSource}
                        onChange={(e) => setAssignmentSource(e.target.value)}
                        placeholder="체크체크 중1-2"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        페이지
                      </label>
                      <input
                        type="text"
                        value={assignmentPageRange}
                        onChange={(e) => setAssignmentPageRange(e.target.value)}
                        placeholder="p.45-50"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        마감일
                      </label>
                      <input
                        type="date"
                        value={assignmentDueDate}
                        onChange={(e) => setAssignmentDueDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              disabled={saving || !selectedStudentId}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '저장 중...' : '수업 기록 저장'}
            </button>
          </div>

          {/* 사이드바 - 최근 수업 기록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                최근 수업 기록
                {selectedStudent && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({selectedStudent.name})
                  </span>
                )}
              </h3>

              {!selectedStudentId ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  학생을 선택하세요
                </p>
              ) : recentSessions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  수업 기록이 없습니다
                </p>
              ) : (
                <div className="space-y-3">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-gray-900">
                          {new Date(session.session_date).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                        </span>
                        <div className="flex gap-1 text-xs">
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            이해 {session.understanding_level}
                          </span>
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            집중 {session.attention_level}
                          </span>
                        </div>
                      </div>

                      {session.learning_keywords && session.learning_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {session.learning_keywords.slice(0, 3).map((k, i) => (
                            <span
                              key={i}
                              className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded"
                            >
                              #{k}
                            </span>
                          ))}
                        </div>
                      )}

                      {session.summary && (
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {session.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <a
                href="/admin/schedules"
                className="block mt-4 text-center text-sm text-indigo-600 hover:text-indigo-700"
              >
                수업 일정 관리 →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ClassRecordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    }>
      <ClassRecordContent />
    </Suspense>
  );
}
