'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Student, User, WeeklyReportAnalysis } from '@/types';

interface WeeklyFormData {
  period: string;
  studentName: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  classDates: string[];
  classNotes: string;
  learningContent: { topic: string; evaluation: string }[];
  whatWentWell: string[];
  needsImprovement: string[];
  reviewProblems: { source: string; page: string; number: string; concept: string }[];
  nextWeekGoals: string[];
  encouragement: string;
}

// 주차 계산 함수
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// 이번 주 시작/종료일 계산
function getThisWeekRange(): { start: string; end: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

export default function NewWeeklyReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [aiAnalysis, setAiAnalysis] = useState<WeeklyReportAnalysis | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const currentDate = new Date();
  const thisWeek = getThisWeekRange();

  const [formData, setFormData] = useState<WeeklyFormData>({
    period: '',
    studentName: '',
    weekNumber: getWeekNumber(currentDate),
    startDate: thisWeek.start,
    endDate: thisWeek.end,
    classDates: [''],
    classNotes: '',
    learningContent: [{ topic: '', evaluation: 'good' }],
    whatWentWell: [''],
    needsImprovement: [''],
    reviewProblems: [{ source: '', page: '', number: '', concept: '' }],
    nextWeekGoals: [''],
    encouragement: '',
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      setFormData(prev => ({
        ...prev,
        studentName: student.name,
        period: `${prev.startDate} ~ ${prev.endDate}`,
      }));
    }
  }, [selectedStudentId, formData.startDate, formData.endDate, students]);

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

    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);
    setLoading(false);
  };

  // 배열 필드 핸들러
  const handleArrayFieldAdd = (field: keyof Pick<WeeklyFormData, 'classDates' | 'whatWentWell' | 'needsImprovement' | 'nextWeekGoals'>) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const handleArrayFieldRemove = (field: keyof Pick<WeeklyFormData, 'classDates' | 'whatWentWell' | 'needsImprovement' | 'nextWeekGoals'>, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleArrayFieldChange = (field: keyof Pick<WeeklyFormData, 'classDates' | 'whatWentWell' | 'needsImprovement' | 'nextWeekGoals'>, index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item),
    }));
  };

  // 학습 내용 핸들러
  const handleLearningContentAdd = () => {
    setFormData(prev => ({
      ...prev,
      learningContent: [...prev.learningContent, { topic: '', evaluation: 'good' }],
    }));
  };

  const handleLearningContentRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      learningContent: prev.learningContent.filter((_, i) => i !== index),
    }));
  };

  const handleLearningContentChange = (index: number, field: 'topic' | 'evaluation', value: string) => {
    setFormData(prev => ({
      ...prev,
      learningContent: prev.learningContent.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  // 복습 문제 핸들러
  const handleReviewProblemAdd = () => {
    setFormData(prev => ({
      ...prev,
      reviewProblems: [...prev.reviewProblems, { source: '', page: '', number: '', concept: '' }],
    }));
  };

  const handleReviewProblemRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      reviewProblems: prev.reviewProblems.filter((_, i) => i !== index),
    }));
  };

  const handleReviewProblemChange = (index: number, field: 'source' | 'page' | 'number' | 'concept', value: string) => {
    setFormData(prev => ({
      ...prev,
      reviewProblems: prev.reviewProblems.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  // AI 분석 생성
  const handleGenerateAi = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('AI 분석을 위해 학생을 선택해주세요.');
      return;
    }

    setGeneratingAi(true);

    try {
      const response = await fetch('/api/weekly-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          year: currentDate.getFullYear(),
          weekNumber: formData.weekNumber,
          startDate: formData.startDate,
          endDate: formData.endDate,
          teacherNotes: formData.classNotes || '주간 종합 평가 요청',
        }),
      });

      const result = await response.json();

      if (result.success && result.analysis) {
        setAiAnalysis(result.analysis);
        alert('AI 분석이 생성되었습니다. 저장 시 함께 저장됩니다.');
      } else {
        setError(result.error || 'AI 분석 생성에 실패했습니다.');
      }
    } catch (err: unknown) {
      console.error('AI 분석 오류:', err);
      setError('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setGeneratingAi(false);
    }
  };

  // 저장
  const handleSave = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const filteredData = {
        ...formData,
        classDates: formData.classDates.filter(d => d.trim()),
        whatWentWell: formData.whatWentWell.filter(w => w.trim()),
        needsImprovement: formData.needsImprovement.filter(n => n.trim()),
        nextWeekGoals: formData.nextWeekGoals.filter(g => g.trim()),
        learningContent: formData.learningContent.filter(l => l.topic.trim()),
        reviewProblems: formData.reviewProblems.filter(r => r.source.trim() || r.concept.trim()),
      };

      // AI 분석이 있으면 병합
      const analysisData = aiAnalysis
        ? { ...filteredData, aiAnalysis }
        : filteredData;

      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'weekly',
          test_name: `${currentDate.getFullYear()}년 ${formData.weekNumber}주차 주간 리포트`,
          test_date: formData.startDate,
          analysis_data: analysisData,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // [Anchor Loop] 메타프로필 업데이트
      if (insertedReport?.id) {
        try {
          const metaResponse = await fetch('/api/meta-profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: selectedStudentId,
              reportId: insertedReport.id,
              analysisData: aiAnalysis || filteredData,
              reportType: 'weekly',
            }),
          });

          const metaResult = await metaResponse.json();
          if (metaResult.success) {
            console.log('[Anchor Loop] 메타프로필 업데이트 완료');
          }
        } catch (metaError) {
          console.warn('[Anchor Loop] 메타프로필 API 호출 실패:', metaError);
        }
      }

      alert('주간 리포트가 저장되었습니다.');
      router.push('/admin/reports');
    } catch (err: unknown) {
      console.error('저장 오류:', err);
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
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
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/admin/reports/create" className="text-gray-500 hover:text-gray-700">
              ← 리포트 선택
            </a>
            <h1 className="text-xl font-bold text-gray-900">주간 리포트 작성</h1>
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

        <div className="space-y-6">
          {/* 안내 메시지 */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="font-semibold text-green-800 mb-2">📅 주간 리포트 (Micro Loop)</h3>
            <p className="text-green-700 text-sm">
              한 주간의 학습을 빠르게 정리하고 피드백합니다. 지난주 목표 달성 여부를 점검하고 다음 주 계획을 세웁니다.
            </p>
          </div>

          {/* 학생 및 기간 선택 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 기본 정보</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  학생 선택 <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    setSelectedStudentId(Number(e.target.value) || '');
                    setAiAnalysis(null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">학생을 선택하세요</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({getGradeLabel(student.grade)}) - {student.student_id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">주차</label>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={formData.weekNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, weekNumber: Number(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* 수업 정보 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 수업 정보</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">수업 날짜</label>
              {formData.classDates.map((date, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => handleArrayFieldChange('classDates', index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  {formData.classDates.length > 1 && (
                    <button
                      onClick={() => handleArrayFieldRemove('classDates', index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => handleArrayFieldAdd('classDates')}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                + 날짜 추가
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수업 노트</label>
              <textarea
                value={formData.classNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, classNotes: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                rows={3}
                placeholder="이번 주 수업 전반에 대한 노트..."
              />
            </div>
          </div>

          {/* 학습 내용 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 학습 내용</h2>

            {formData.learningContent.map((content, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={content.topic}
                  onChange={(e) => handleLearningContentChange(index, 'topic', e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="학습 주제"
                />
                <select
                  value={content.evaluation}
                  onChange={(e) => handleLearningContentChange(index, 'evaluation', e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="excellent">우수</option>
                  <option value="good">양호</option>
                  <option value="not_good">미흡</option>
                </select>
                {formData.learningContent.length > 1 && (
                  <button
                    onClick={() => handleLearningContentRemove(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleLearningContentAdd}
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              + 학습 내용 추가
            </button>
          </div>

          {/* 주간 평가 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">4. 이번 주 평가</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">잘한 점</label>
                {formData.whatWentWell.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayFieldChange('whatWentWell', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="잘한 점..."
                    />
                    {formData.whatWentWell.length > 1 && (
                      <button
                        onClick={() => handleArrayFieldRemove('whatWentWell', index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => handleArrayFieldAdd('whatWentWell')}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  + 추가
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">개선 필요 사항</label>
                {formData.needsImprovement.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayFieldChange('needsImprovement', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="개선 필요 사항..."
                    />
                    {formData.needsImprovement.length > 1 && (
                      <button
                        onClick={() => handleArrayFieldRemove('needsImprovement', index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => handleArrayFieldAdd('needsImprovement')}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  + 추가
                </button>
              </div>
            </div>
          </div>

          {/* 복습 문제 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">5. 복습 문제</h2>

            {formData.reviewProblems.map((problem, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                <input
                  type="text"
                  value={problem.source}
                  onChange={(e) => handleReviewProblemChange(index, 'source', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="출처"
                />
                <input
                  type="text"
                  value={problem.page}
                  onChange={(e) => handleReviewProblemChange(index, 'page', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="페이지"
                />
                <input
                  type="text"
                  value={problem.number}
                  onChange={(e) => handleReviewProblemChange(index, 'number', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="문제 번호"
                />
                <input
                  type="text"
                  value={problem.concept}
                  onChange={(e) => handleReviewProblemChange(index, 'concept', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="관련 개념"
                />
                {formData.reviewProblems.length > 1 && (
                  <button
                    onClick={() => handleReviewProblemRemove(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleReviewProblemAdd}
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              + 복습 문제 추가
            </button>
          </div>

          {/* 다음 주 계획 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">6. 다음 주 목표</h2>

            {formData.nextWeekGoals.map((goal, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => handleArrayFieldChange('nextWeekGoals', index, e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="다음 주 목표..."
                />
                {formData.nextWeekGoals.length > 1 && (
                  <button
                    onClick={() => handleArrayFieldRemove('nextWeekGoals', index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => handleArrayFieldAdd('nextWeekGoals')}
              className="text-green-600 hover:text-green-700 text-sm font-medium"
            >
              + 목표 추가
            </button>
          </div>

          {/* 격려 메시지 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">7. 격려 메시지</h2>
            <textarea
              value={formData.encouragement}
              onChange={(e) => setFormData(prev => ({ ...prev, encouragement: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="학생에게 전할 격려 메시지..."
            />
          </div>

          {/* AI 분석 섹션 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">8. AI 분석 (선택)</h2>

            <p className="text-gray-600 text-sm mb-4">
              DB에 저장된 수업 기록과 숙제 데이터를 기반으로 AI가 Micro Loop 분석을 생성합니다.
            </p>

            <button
              onClick={handleGenerateAi}
              disabled={generatingAi || !selectedStudentId}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {generatingAi ? (
                <>
                  <span className="animate-spin">⏳</span>
                  AI 분석 생성 중...
                </>
              ) : (
                <>
                  <span>🤖</span>
                  AI 분석 생성
                </>
              )}
            </button>

            {/* AI 분석 결과 미리보기 */}
            {aiAnalysis && (
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-green-700">✅ AI 분석 생성 완료</h3>
                  <button
                    onClick={() => setAiAnalysis(null)}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    분석 삭제
                  </button>
                </div>

                <div className="space-y-4 text-sm">
                  {/* 주간 성취 */}
                  {aiAnalysis.weeklyAchievements && aiAnalysis.weeklyAchievements.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">🏆 주간 성취</h4>
                      <ul className="list-disc list-inside text-green-700">
                        {aiAnalysis.weeklyAchievements.map((achievement, idx) => (
                          <li key={idx}>{achievement}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 개선 필요 영역 */}
                  {aiAnalysis.areasForImprovement && aiAnalysis.areasForImprovement.length > 0 && (
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">⚠️ 개선 필요 영역</h4>
                      <ul className="list-disc list-inside text-yellow-700">
                        {aiAnalysis.areasForImprovement.map((area, idx) => (
                          <li key={idx}>{area}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Micro Loop 피드백 */}
                  {aiAnalysis.microLoopFeedback && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">🔄 Micro Loop 피드백</h4>
                      <p className="text-blue-700">
                        연속성 점수: <strong>{aiAnalysis.microLoopFeedback.continuityScore}/100</strong>
                        {' '}- 모멘텀: {
                          aiAnalysis.microLoopFeedback.momentumStatus === 'accelerating' ? '🚀 가속 중' :
                          aiAnalysis.microLoopFeedback.momentumStatus === 'maintaining' ? '➡️ 유지' :
                          aiAnalysis.microLoopFeedback.momentumStatus === 'slowing' ? '⬇️ 둔화' : '↩️ 회복 중'
                        }
                      </p>
                    </div>
                  )}

                  {/* 다음 주 계획 */}
                  {aiAnalysis.nextWeekPlan && (
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <h4 className="font-medium text-indigo-800 mb-2">📅 다음 주 AI 추천</h4>
                      <p className="text-indigo-700 font-medium">{aiAnalysis.nextWeekPlan.focus}</p>
                      {aiAnalysis.nextWeekPlan.goals && aiAnalysis.nextWeekPlan.goals.length > 0 && (
                        <ul className="list-disc list-inside text-indigo-600 mt-1">
                          {aiAnalysis.nextWeekPlan.goals.map((goal, idx) => (
                            <li key={idx}>{goal}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* 격려 메시지 */}
                  {aiAnalysis.encouragement && (
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">💪 격려 메시지</h4>
                      <p className="text-green-700">{aiAnalysis.encouragement}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving || !selectedStudentId}
            className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : aiAnalysis ? '주간 리포트 저장 (AI 분석 포함)' : '주간 리포트 저장'}
          </button>
        </div>
      </main>
    </div>
  );
}
