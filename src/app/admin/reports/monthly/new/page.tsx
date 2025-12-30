'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { updateStudentProfileFromMonthly } from '@/lib/student-profile-extractor';
import type { Student, User, MonthlyReportData, MonthlyReportAnalysis } from '@/types';

export default function NewMonthlyReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [aiAnalysis, setAiAnalysis] = useState<MonthlyReportAnalysis | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const currentDate = new Date();
  const [formData, setFormData] = useState<MonthlyReportData>({
    period: '',
    studentName: '',
    announcements: '',
    cost: '',
    schedule: { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 },
    classDates: [''],
    classNotes: '',
    textbookCompletion: { percentage: 0, description: '' },
    learningContent: [{ topic: '', evaluation: 'good' }],
    whatWentWell: [''],
    needsImprovement: [''],
    reviewProblems: [{ source: '', page: '', number: '', concept: '' }],
    nextMonthGoals: [''],
    performanceSummary: '',
    improvementPlan: '',
    messageToParents: '',
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    const student = students.find(s => s.id === selectedStudentId);
    if (student) {
      const { year, month } = formData.schedule;
      setFormData(prev => ({
        ...prev,
        studentName: student.name,
        period: `${year}년 ${month}월`,
      }));
    }
  }, [selectedStudentId, formData.schedule.year, formData.schedule.month, students]);

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

  const handleArrayFieldAdd = (field: 'classDates' | 'whatWentWell' | 'needsImprovement' | 'nextMonthGoals') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const handleArrayFieldRemove = (field: 'classDates' | 'whatWentWell' | 'needsImprovement' | 'nextMonthGoals', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleArrayFieldChange = (field: 'classDates' | 'whatWentWell' | 'needsImprovement' | 'nextMonthGoals', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item),
    }));
  };

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

  const handleGenerateAi = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('AI 분석을 위해 학생을 선택해주세요.');
      return;
    }

    setGeneratingAi(true);

    try {
      const response = await fetch('/api/monthly-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          year: formData.schedule.year,
          month: formData.schedule.month,
          teacherNotes: formData.performanceSummary || formData.classNotes || '월간 종합 평가 요청',
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

  const handleSave = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      const filteredData: MonthlyReportData = {
        ...formData,
        classDates: formData.classDates.filter(d => d.trim()),
        whatWentWell: formData.whatWentWell.filter(w => w.trim()),
        needsImprovement: formData.needsImprovement.filter(n => n.trim()),
        nextMonthGoals: formData.nextMonthGoals.filter(g => g.trim()),
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
          report_type: 'monthly',
          test_name: `${formData.schedule.year}년 ${formData.schedule.month}월 월간 리포트`,
          test_date: `${formData.schedule.year}-${String(formData.schedule.month).padStart(2, '0')}-01`,
          analysis_data: analysisData,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 학생 프로필 자동 추출 (취약점, 강점)
      if (insertedReport?.id) {
        const profileResult = await updateStudentProfileFromMonthly(
          selectedStudentId,
          insertedReport.id,
          filteredData
        );
        if (!profileResult.success) {
          console.warn('학생 프로필 업데이트 실패:', profileResult.error);
        }

        // [Anchor Loop] 메타프로필(5대 핵심 지표) 업데이트
        try {
          const metaResponse = await fetch('/api/meta-profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: selectedStudentId,
              reportId: insertedReport.id,
              analysisData: filteredData,
              reportType: 'monthly',
            }),
          });

          const metaResult = await metaResponse.json();
          if (metaResult.success) {
            console.log('[Anchor Loop] 메타프로필 업데이트 완료:', metaResult.message);
          } else {
            console.warn('[Anchor Loop] 메타프로필 업데이트 실패:', metaResult.error);
          }
        } catch (metaError) {
          console.warn('[Anchor Loop] 메타프로필 API 호출 실패:', metaError);
        }
      }

      alert('월간 리포트가 저장되었습니다.');
      router.push('/admin/reports');
    } catch (err: any) {
      console.error('저장 오류:', err);
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  const getEvaluationLabel = (evaluation: string): string => {
    const labels: Record<string, string> = {
      excellent: '우수',
      good: '양호',
      not_good: '미흡',
    };
    return labels[evaluation] || evaluation;
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
            <h1 className="text-xl font-bold text-gray-900">월간 리포트 작성</h1>
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
                  onChange={(e) => setSelectedStudentId(Number(e.target.value) || '')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">학생을 선택하세요</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({getGradeLabel(student.grade)}) - {student.student_id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">연도</label>
                  <select
                    value={formData.schedule.year}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, year: Number(e.target.value) }
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {[2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">월</label>
                  <select
                    value={formData.schedule.month}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, month: Number(e.target.value) }
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>{month}월</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">공지사항</label>
                <textarea
                  value={formData.announcements}
                  onChange={(e) => setFormData(prev => ({ ...prev, announcements: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="이번 달 공지사항..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수업료</label>
                <input
                  type="text"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="예: 300,000원"
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
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                + 날짜 추가
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수업 노트</label>
              <textarea
                value={formData.classNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, classNotes: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                rows={3}
                placeholder="이번 달 수업 전반에 대한 노트..."
              />
            </div>
          </div>

          {/* 교재 진도 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 교재 진도</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">진도율 (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.textbookCompletion.percentage}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    textbookCompletion: { ...prev.textbookCompletion, percentage: Number(e.target.value) }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">진도 설명</label>
                <input
                  type="text"
                  value={formData.textbookCompletion.description}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    textbookCompletion: { ...prev.textbookCompletion, description: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="예: 개념원리 1단원 ~ 3단원 완료"
                />
              </div>
            </div>
          </div>

          {/* 학습 내용 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">4. 학습 내용</h2>

            {formData.learningContent.map((content, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={content.topic}
                  onChange={(e) => handleLearningContentChange(index, 'topic', e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="학습 주제"
                />
                <select
                  value={content.evaluation}
                  onChange={(e) => handleLearningContentChange(index, 'evaluation', e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
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
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              + 학습 내용 추가
            </button>
          </div>

          {/* 평가 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">5. 이번 달 평가</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">잘한 점</label>
                {formData.whatWentWell.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => handleArrayFieldChange('whatWentWell', index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
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
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  + 추가
                </button>
              </div>
            </div>
          </div>

          {/* 복습 문제 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">6. 복습 문제</h2>

            {formData.reviewProblems.map((problem, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                <input
                  type="text"
                  value={problem.source}
                  onChange={(e) => handleReviewProblemChange(index, 'source', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="출처"
                />
                <input
                  type="text"
                  value={problem.page}
                  onChange={(e) => handleReviewProblemChange(index, 'page', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="페이지"
                />
                <input
                  type="text"
                  value={problem.number}
                  onChange={(e) => handleReviewProblemChange(index, 'number', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="문제 번호"
                />
                <input
                  type="text"
                  value={problem.concept}
                  onChange={(e) => handleReviewProblemChange(index, 'concept', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
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
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
            >
              + 복습 문제 추가
            </button>
          </div>

          {/* 다음 달 계획 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">7. 다음 달 계획</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">목표</label>
              {formData.nextMonthGoals.map((goal, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => handleArrayFieldChange('nextMonthGoals', index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="다음 달 목표..."
                  />
                  {formData.nextMonthGoals.length > 1 && (
                    <button
                      onClick={() => handleArrayFieldRemove('nextMonthGoals', index)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => handleArrayFieldAdd('nextMonthGoals')}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                + 목표 추가
              </button>
            </div>
          </div>

          {/* 종합 평가 및 메시지 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">8. 종합 평가</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">성적 요약</label>
                <textarea
                  value={formData.performanceSummary}
                  onChange={(e) => setFormData(prev => ({ ...prev, performanceSummary: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="이번 달 학습 성과 요약..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">개선 계획</label>
                <textarea
                  value={formData.improvementPlan}
                  onChange={(e) => setFormData(prev => ({ ...prev, improvementPlan: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="향후 개선 계획..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학부모님께 드리는 말씀</label>
                <textarea
                  value={formData.messageToParents}
                  onChange={(e) => setFormData(prev => ({ ...prev, messageToParents: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={4}
                  placeholder="학부모님께 전달할 메시지..."
                />
              </div>
            </div>
          </div>

          {/* AI 분석 섹션 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">9. AI 분석 (선택)</h2>

            <p className="text-gray-600 text-sm mb-4">
              DB에 저장된 수업 기록, 시험 결과, 숙제 데이터를 기반으로 AI가 종합 분석을 생성합니다.
              AI 분석은 선택사항이며, 생성 후 저장하면 리포트에 포함됩니다.
            </p>

            <button
              onClick={handleGenerateAi}
              disabled={generatingAi || !selectedStudentId}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                  {/* 커리큘럼 진도 */}
                  {aiAnalysis.curriculumProgress && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">📚 커리큘럼 진도</h4>
                      <p className="text-blue-700">
                        진도율: {aiAnalysis.curriculumProgress.completionRate || 0}%
                        {aiAnalysis.curriculumProgress.paceAssessment && ` - ${
                          aiAnalysis.curriculumProgress.paceAssessment === 'ahead' ? '앞서감' :
                          aiAnalysis.curriculumProgress.paceAssessment === 'on_track' ? '정상' : '뒤처짐'
                        }`}
                      </p>
                      {aiAnalysis.curriculumProgress.startUnit && aiAnalysis.curriculumProgress.endUnit && (
                        <p className="text-blue-600 text-xs mt-1">
                          {aiAnalysis.curriculumProgress.startUnit} → {aiAnalysis.curriculumProgress.endUnit}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 월간 성취 */}
                  {aiAnalysis.monthlyAchievements && aiAnalysis.monthlyAchievements.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">🏆 월간 성취</h4>
                      <ul className="list-disc list-inside text-green-700">
                        {aiAnalysis.monthlyAchievements.map((achievement, idx) => (
                          <li key={idx}>{achievement}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 새로운 도전 */}
                  {aiAnalysis.newChallenges && aiAnalysis.newChallenges.length > 0 && (
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <h4 className="font-medium text-yellow-800 mb-2">⚠️ 새로운 도전</h4>
                      <ul className="list-disc list-inside text-yellow-700">
                        {aiAnalysis.newChallenges.map((challenge, idx) => (
                          <li key={idx}>{challenge}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 부모님 보고 */}
                  {aiAnalysis.parentReport && (
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-2">👨‍👩‍👧 부모님 보고</h4>
                      {aiAnalysis.parentReport.highlights && aiAnalysis.parentReport.highlights.length > 0 && (
                        <div className="text-purple-700 mb-2">
                          <strong>하이라이트:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1">
                            {aiAnalysis.parentReport.highlights.map((h, idx) => (
                              <li key={idx}>{h}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiAnalysis.parentReport.recommendations && aiAnalysis.parentReport.recommendations.length > 0 && (
                        <div className="text-purple-700">
                          <strong>권장사항:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1">
                            {aiAnalysis.parentReport.recommendations.map((r, idx) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 다음 달 계획 */}
                  {aiAnalysis.nextMonthPlan && (
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <h4 className="font-medium text-indigo-800 mb-2">📅 다음 달 AI 추천 계획</h4>
                      {aiAnalysis.nextMonthPlan.mainGoals && (
                        <p className="text-indigo-700 mb-1">
                          <strong>주요 목표:</strong>{' '}
                          {Array.isArray(aiAnalysis.nextMonthPlan.mainGoals)
                            ? aiAnalysis.nextMonthPlan.mainGoals.join(', ')
                            : aiAnalysis.nextMonthPlan.mainGoals}
                        </p>
                      )}
                      {aiAnalysis.nextMonthPlan.focusAreas && (
                        <p className="text-indigo-700">
                          <strong>집중 영역:</strong>{' '}
                          {Array.isArray(aiAnalysis.nextMonthPlan.focusAreas)
                            ? aiAnalysis.nextMonthPlan.focusAreas.join(', ')
                            : aiAnalysis.nextMonthPlan.focusAreas}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 선생님 메시지 */}
                  {aiAnalysis.teacherMessage && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-2">💬 AI 생성 메시지</h4>
                      <p className="text-gray-700">{aiAnalysis.teacherMessage}</p>
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
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : aiAnalysis ? '월간 리포트 저장 (AI 분석 포함)' : '월간 리포트 저장'}
          </button>
        </div>
      </main>
    </div>
  );
}
