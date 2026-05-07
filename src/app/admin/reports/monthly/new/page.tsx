'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { registerReportFeedbackData } from '@/lib/feedback-loop';
import MultiFileUpload, { UploadedFile } from '@/components/common/MultiFileUpload';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import type { Student, User, MonthlyReportAnalysis, Report, AnalysisData } from '@/types';

interface MonthlyFormData {
  period: string;
  studentName: string;
  announcements: string;
  cost: string;
  schedule: { year: number; month: number };
  classNotes: string;
  textbookCompletion: { percentage: number; description: string };
  teacherComments?: {
    attitudeAndFocus?: string;         // 한 달간의 학습 태도 변화
    monthlyGoalAchievement?: string;   // 월간 장기 목표 달성 관찰
    specialNote?: string;              // 기타 특이사항 (학부모 상담 내용 등)
  };
}

interface WeeklyReportSummary {
  id: number;
  monthWeek: string;
  startDate: string;
  achievements: string[];
  improvements: string[];
  continuityScore: number;
}

export default function NewMonthlyReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');

  // 주간 리포트 목록 (Micro Loop 분석용)
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportSummary[]>([]);
  const [loadingWeeklyReports, setLoadingWeeklyReports] = useState(false);

  // AI 분석 상태
  const [aiAnalysis, setAiAnalysis] = useState<MonthlyReportAnalysis | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // 파일 업로드 상태
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const currentDate = new Date();
  const [formData, setFormData] = useState<MonthlyFormData>({
    period: '',
    studentName: '',
    announcements: '',
    cost: '',
    schedule: { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 },
    classNotes: '',
    textbookCompletion: { percentage: 0, description: '' },
  });

  // 편집 가능한 AI 분석 결과
  const [editableAnalysis, setEditableAnalysis] = useState({
    monthlyAchievements: [''],
    newChallenges: [''],
    curriculumProgress: { completionRate: 0, paceAssessment: 'on_track' as 'ahead' | 'on_track' | 'behind' },
    parentHighlights: [''],
    parentRecommendations: [''],
    nextMonthGoals: [''],
    nextMonthFocusAreas: [''],
    teacherMessage: '',
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  // 학생 선택 시 주간 리포트 로드
  const loadWeeklyReports = useCallback(async (studentId: number) => {
    setLoadingWeeklyReports(true);
    try {
      const supabase = createClient();

      // 해당 월의 시작/끝 날짜 계산
      const startOfMonth = `${formData.schedule.year}-${String(formData.schedule.month).padStart(2, '0')}-01`;
      const endOfMonth = new Date(formData.schedule.year, formData.schedule.month, 0);
      const endDate = `${formData.schedule.year}-${String(formData.schedule.month).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('student_id', studentId)
        .eq('report_type', 'weekly')
        .gte('test_date', startOfMonth)
        .lte('test_date', endDate)
        .order('test_date');

      if (reports && reports.length > 0) {
        const summaries: WeeklyReportSummary[] = reports.map((report: Report) => {
          const analysisData = report.analysis_data as unknown as Record<string, unknown>;
          const aiAnalysis = analysisData?.aiAnalysis as Record<string, unknown> | undefined;

          return {
            id: report.id,
            monthWeek: (analysisData?.monthWeek as string) || report.test_name || '',
            startDate: report.test_date || '',
            achievements: (aiAnalysis?.weeklyAchievements as string[]) || [],
            improvements: (aiAnalysis?.areasForImprovement as string[]) || [],
            continuityScore: (aiAnalysis?.microLoopFeedback as Record<string, unknown>)?.continuityScore as number || 0,
          };
        });
        setWeeklyReports(summaries);
      } else {
        setWeeklyReports([]);
      }
    } catch (err) {
      console.error('주간 리포트 로드 오류:', err);
    } finally {
      setLoadingWeeklyReports(false);
    }
  }, [formData.schedule.year, formData.schedule.month]);

  useEffect(() => {
    const student = students.find((s) => s.id === selectedStudentId);
    if (student) {
      const { year, month } = formData.schedule;
      setFormData((prev) => ({
        ...prev,
        studentName: student.name,
        period: `${year}년 ${month}월`,
      }));
      loadWeeklyReports(student.id);
    }
  }, [selectedStudentId, formData.schedule.year, formData.schedule.month, students, loadWeeklyReports]);

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

  // AI 분석 생성
  const handleGenerateAi = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    if (!formData.classNotes.trim() && weeklyReports.length === 0 && uploadedFiles.length === 0) {
      setError('수업 노트를 입력하거나, 주간 리포트가 있거나, 파일을 업로드해주세요.');
      return;
    }

    setGeneratingAi(true);

    try {
      // 이미지 파일 추출
      const imageFiles = uploadedFiles
        .filter((f) => f.type === 'image')
        .map((f) => f.data.split(',')[1]);

      // PDF와 CSV 파일 데이터 추출
      const pdfFiles = uploadedFiles.filter((f) => f.type === 'pdf').map((f) => f.data);
      const csvFiles = uploadedFiles.filter((f) => f.type === 'csv').map((f) => f.data);

      const response = await fetch('/api/monthly-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          year: formData.schedule.year,
          month: formData.schedule.month,
          teacherNotes: formData.classNotes || '월간 종합 평가 요청',
          textbookProgress: formData.textbookCompletion,
          weeklyReportIds: weeklyReports.map((r) => r.id),
          // 파일 데이터
          imageFiles,
          pdfFiles,
          csvFiles,
        }),
      });

      const result = await response.json();

      if (result.success && result.analysis) {
        setAiAnalysis(result.analysis);

        // 편집 가능한 필드로 복사
        setEditableAnalysis({
          monthlyAchievements: result.analysis.monthlyAchievements || [''],
          newChallenges: result.analysis.newChallenges || [''],
          curriculumProgress: {
            completionRate: result.analysis.curriculumProgress?.completionRate || 0,
            paceAssessment: result.analysis.curriculumProgress?.paceAssessment || 'on_track',
          },
          parentHighlights: result.analysis.parentReport?.highlights || [''],
          parentRecommendations: result.analysis.parentReport?.recommendations || [''],
          nextMonthGoals: result.analysis.nextMonthPlan?.mainGoals || [''],
          nextMonthFocusAreas: result.analysis.nextMonthPlan?.focusAreas || [''],
          teacherMessage: result.analysis.teacherMessage || '',
        });
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

  // 편집 가능한 배열 필드 핸들러
  const handleEditableArrayAdd = (field: 'monthlyAchievements' | 'newChallenges' | 'parentHighlights' | 'parentRecommendations' | 'nextMonthGoals' | 'nextMonthFocusAreas') => {
    setEditableAnalysis((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const handleEditableArrayRemove = (field: 'monthlyAchievements' | 'newChallenges' | 'parentHighlights' | 'parentRecommendations' | 'nextMonthGoals' | 'nextMonthFocusAreas', index: number) => {
    setEditableAnalysis((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleEditableArrayChange = (field: 'monthlyAchievements' | 'newChallenges' | 'parentHighlights' | 'parentRecommendations' | 'nextMonthGoals' | 'nextMonthFocusAreas', index: number, value: string) => {
    setEditableAnalysis((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }));
  };

  // 저장
  const handleSave = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    if (!aiAnalysis) {
      setError('AI 분석을 먼저 생성해주세요.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // 편집된 분석 결과로 최종 데이터 구성
      const finalAnalysis: MonthlyReportAnalysis = {
        ...aiAnalysis,
        monthlyAchievements: editableAnalysis.monthlyAchievements.filter((a) => a.trim()),
        newChallenges: editableAnalysis.newChallenges.filter((c) => c.trim()),
        curriculumProgress: {
          ...aiAnalysis.curriculumProgress,
          completionRate: editableAnalysis.curriculumProgress.completionRate,
          paceAssessment: editableAnalysis.curriculumProgress.paceAssessment,
        },
        parentReport: {
          ...aiAnalysis.parentReport,
          highlights: editableAnalysis.parentHighlights.filter((h) => h.trim()),
          recommendations: editableAnalysis.parentRecommendations.filter((r) => r.trim()),
        },
        nextMonthPlan: {
          ...aiAnalysis.nextMonthPlan,
          mainGoals: editableAnalysis.nextMonthGoals.filter((g) => g.trim()),
          focusAreas: editableAnalysis.nextMonthFocusAreas.filter((f) => f.trim()),
        },
        teacherMessage: editableAnalysis.teacherMessage,
      };

      const analysisData = {
        period: formData.period,
        studentName: formData.studentName,
        schedule: formData.schedule,
        announcements: formData.announcements,
        cost: formData.cost,
        classNotes: formData.classNotes,
        textbookCompletion: formData.textbookCompletion,
        weeklyReportIds: weeklyReports.map((r) => r.id),
        aiAnalysis: finalAnalysis,
      };

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

      // [Anchor Loop] 메타프로필 업데이트
      if (insertedReport?.id) {
        try {
          const metaResponse = await fetch('/api/meta-profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: selectedStudentId,
              reportId: insertedReport.id,
              analysisData: finalAnalysis,
              reportType: 'monthly',
            }),
          });

          const metaResult = await metaResponse.json();
          if (metaResult.success) {
            console.log('[Anchor Loop] 메타프로필 업데이트 완료');
          }
        } catch (metaError) {
          console.warn('[Anchor Loop] 메타프로필 API 호출 실패:', metaError);
        }

        // [Feedback Loop] 전략 추적 및 예측 데이터 등록
        try {
          const feedbackResult = await registerReportFeedbackData(
            insertedReport.id,
            selectedStudentId,
            finalAnalysis as unknown as AnalysisData
          );
          console.log('[Feedback Loop] 등록 결과:', feedbackResult);
        } catch (feedbackError) {
          console.warn('[Feedback Loop] 등록 실패:', feedbackError);
        }
      }

      addToast('월간 리포트가 저장되었습니다.', 'success');
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
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toasts={toasts} onRemove={removeToast} />
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/admin/reports/create" className="text-gray-500 hover:text-gray-700">
              ← 리포트 선택
            </Link>
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
          {/* 안내 메시지 */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <h3 className="font-semibold text-purple-800 mb-2">📊 월간 리포트 (Micro Loop 통합)</h3>
            <p className="text-purple-700 text-sm">
              이번 달 주간 리포트를 종합하여 Micro Loop 분석을 수행합니다.
              주간 리포트가 없어도 수업 노트와 파일을 기반으로 분석이 가능합니다.
            </p>
          </div>

          {/* 1. 기본 정보 */}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
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
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      schedule: { ...prev.schedule, year: Number(e.target.value) },
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {[2024, 2025, 2026].map((year) => (
                      <option key={year} value={year}>{year}년</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">월</label>
                  <select
                    value={formData.schedule.month}
                    onChange={(e) => setFormData((prev) => ({
                      ...prev,
                      schedule: { ...prev.schedule, month: Number(e.target.value) },
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, announcements: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="이번 달 공지사항..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">수업료</label>
                <input
                  type="text"
                  value={formData.cost}
                  onChange={(e) => setFormData((prev) => ({ ...prev, cost: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 300,000원"
                />
              </div>
            </div>

            {/* 주간 리포트 연동 현황 */}
            {selectedStudentId && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    🔗 이번 달 주간 리포트 (Micro Loop 데이터)
                  </label>
                  {loadingWeeklyReports && <span className="text-xs text-gray-500">로딩 중...</span>}
                </div>

                {weeklyReports.length > 0 ? (
                  <div className="space-y-2">
                    {weeklyReports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                      >
                        <div>
                          <span className="font-medium text-gray-800">{report.monthWeek}</span>
                          <span className="text-xs text-gray-500 ml-2">({report.startDate})</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-green-600">
                            성취 {report.achievements.length}개
                          </span>
                          <span className="text-yellow-600">
                            개선 {report.improvements.length}개
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            report.continuityScore >= 70 ? 'bg-green-100 text-green-700' :
                            report.continuityScore >= 50 ? 'bg-blue-100 text-blue-700' :
                            report.continuityScore > 0 ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            학습 습관 {report.continuityScore > 0 ? `${report.continuityScore}점` : '미집계'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    이번 달 주간 리포트가 없습니다. 수업 노트와 파일을 기반으로 분석합니다.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 2. 교재 진도 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 교재 진도</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">진도율 (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.textbookCompletion.percentage}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    textbookCompletion: { ...prev.textbookCompletion, percentage: Number(e.target.value) },
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">진도 설명</label>
                <input
                  type="text"
                  value={formData.textbookCompletion.description}
                  onChange={(e) => setFormData((prev) => ({
                    ...prev,
                    textbookCompletion: { ...prev.textbookCompletion, description: e.target.value },
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 개념원리 1단원 ~ 3단원 완료"
                />
              </div>
            </div>
          </div>

          {/* 3. 수업 노트 및 파일 업로드 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. 수업 데이터</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">수업 노트</label>
              <textarea
                value={formData.classNotes}
                onChange={(e) => setFormData((prev) => ({ ...prev, classNotes: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                rows={4}
                placeholder="이번 달 수업 전반에 대한 노트... (주간 리포트에 포함되지 않은 내용)"
              />
            </div>

            <MultiFileUpload
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              acceptedTypes={['image', 'pdf', 'csv']}
              maxFiles={10}
              maxSizeMB={10}
              label="참고 파일 (선택)"
              helpText="추가 참고 자료가 있으면 업로드하세요. 주간 리포트 데이터와 함께 분석됩니다."
            />
          </div>

          {/* 교사 관찰 코멘트 (선택) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. 교사 관찰 코멘트 (선택)</h2>
            <p className="text-sm text-gray-500 mb-4">
              AI가 월간 리포트를 분석할 때 참고할 장기적 관찰 항목을 입력합니다. (비워두어도 무방합니다)
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">한 달간의 학습 태도 변화</label>
                <textarea
                  value={formData.teacherComments?.attitudeAndFocus || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), attitudeAndFocus: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 초반에는 산만했으나 점차 학습 리듬을 찾아감 등"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">월간 장기 목표 달성 관찰</label>
                <textarea
                  value={formData.teacherComments?.monthlyGoalAchievement || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), monthlyGoalAchievement: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 이번 달 목표였던 '함수 그래프 완벽 이해'에 대한 교사의 주관적 평가 등"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기타 특이사항</label>
                <textarea
                  value={formData.teacherComments?.specialNote || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), specialNote: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 학부모 상담 주요 내용, 방학 기간 특이사항 등"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* 5. AI 분석 (필수) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              5. AI 분석 <span className="text-red-500">*</span>
            </h2>

            <p className="text-gray-600 text-sm mb-4">
              주간 리포트, 수업 노트, 첨부 파일을 종합하여 AI가 Micro Loop 통합 분석을 생성합니다.
            </p>

            {!aiAnalysis ? (
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
                    AI 분석 생성 (필수)
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-purple-700">✅ AI 분석 완료 - 내용을 편집할 수 있습니다</h3>
                  <button
                    onClick={() => {
                      setAiAnalysis(null);
                      setEditableAnalysis({
                        monthlyAchievements: [''],
                        newChallenges: [''],
                        curriculumProgress: { completionRate: 0, paceAssessment: 'on_track' },
                        parentHighlights: [''],
                        parentRecommendations: [''],
                        nextMonthGoals: [''],
                        nextMonthFocusAreas: [''],
                        teacherMessage: '',
                      });
                    }}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    다시 생성
                  </button>
                </div>

                {/* 커리큘럼 진도 */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">📚 커리큘럼 진도</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-blue-700 mb-1">진도율 (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editableAnalysis.curriculumProgress.completionRate}
                        onChange={(e) =>
                          setEditableAnalysis((prev) => ({
                            ...prev,
                            curriculumProgress: {
                              ...prev.curriculumProgress,
                              completionRate: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-blue-700 mb-1">진도 평가</label>
                      <select
                        value={editableAnalysis.curriculumProgress.paceAssessment}
                        onChange={(e) =>
                          setEditableAnalysis((prev) => ({
                            ...prev,
                            curriculumProgress: {
                              ...prev.curriculumProgress,
                              paceAssessment: e.target.value as 'ahead' | 'on_track' | 'behind',
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="ahead">🚀 앞서감</option>
                        <option value="on_track">✅ 정상</option>
                        <option value="behind">⚠️ 뒤처짐</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 월간 성취 */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-3">🏆 월간 성취</h4>
                  {editableAnalysis.monthlyAchievements.map((achievement, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={achievement}
                        onChange={(e) =>
                          handleEditableArrayChange('monthlyAchievements', idx, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                        placeholder="성취 내용..."
                      />
                      {editableAnalysis.monthlyAchievements.length > 1 && (
                        <button
                          onClick={() => handleEditableArrayRemove('monthlyAchievements', idx)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => handleEditableArrayAdd('monthlyAchievements')}
                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    + 추가
                  </button>
                </div>

                {/* 새로운 도전 */}
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-3">⚠️ 새로운 도전 (개선 필요)</h4>
                  {editableAnalysis.newChallenges.map((challenge, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={challenge}
                        onChange={(e) =>
                          handleEditableArrayChange('newChallenges', idx, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white"
                        placeholder="도전 과제..."
                      />
                      {editableAnalysis.newChallenges.length > 1 && (
                        <button
                          onClick={() => handleEditableArrayRemove('newChallenges', idx)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => handleEditableArrayAdd('newChallenges')}
                    className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                  >
                    + 추가
                  </button>
                </div>

                {/* 부모님 보고 */}
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-medium text-purple-800 mb-3">👨‍👩‍👧 부모님 보고</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-purple-700 mb-2">하이라이트</label>
                      {editableAnalysis.parentHighlights.map((highlight, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={highlight}
                            onChange={(e) =>
                              handleEditableArrayChange('parentHighlights', idx, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                            placeholder="하이라이트..."
                          />
                          {editableAnalysis.parentHighlights.length > 1 && (
                            <button
                              onClick={() => handleEditableArrayRemove('parentHighlights', idx)}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => handleEditableArrayAdd('parentHighlights')}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        + 추가
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-purple-700 mb-2">권장사항</label>
                      {editableAnalysis.parentRecommendations.map((rec, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={rec}
                            onChange={(e) =>
                              handleEditableArrayChange('parentRecommendations', idx, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                            placeholder="권장사항..."
                          />
                          {editableAnalysis.parentRecommendations.length > 1 && (
                            <button
                              onClick={() => handleEditableArrayRemove('parentRecommendations', idx)}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => handleEditableArrayAdd('parentRecommendations')}
                        className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        + 추가
                      </button>
                    </div>
                  </div>
                </div>

                {/* 다음 달 계획 */}
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <h4 className="font-medium text-indigo-800 mb-3">📅 다음 달 계획</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-indigo-700 mb-2">주요 목표</label>
                      {editableAnalysis.nextMonthGoals.map((goal, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={goal}
                            onChange={(e) =>
                              handleEditableArrayChange('nextMonthGoals', idx, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                            placeholder="목표..."
                          />
                          {editableAnalysis.nextMonthGoals.length > 1 && (
                            <button
                              onClick={() => handleEditableArrayRemove('nextMonthGoals', idx)}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => handleEditableArrayAdd('nextMonthGoals')}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                      >
                        + 추가
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-indigo-700 mb-2">집중 영역</label>
                      {editableAnalysis.nextMonthFocusAreas.map((area, idx) => (
                        <div key={idx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={area}
                            onChange={(e) =>
                              handleEditableArrayChange('nextMonthFocusAreas', idx, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                            placeholder="집중 영역..."
                          />
                          {editableAnalysis.nextMonthFocusAreas.length > 1 && (
                            <button
                              onClick={() => handleEditableArrayRemove('nextMonthFocusAreas', idx)}
                              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => handleEditableArrayAdd('nextMonthFocusAreas')}
                        className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                      >
                        + 추가
                      </button>
                    </div>
                  </div>
                </div>

                {/* 선생님 메시지 */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-3">💬 학부모님께 드리는 말씀</h4>
                  <textarea
                    value={editableAnalysis.teacherMessage}
                    onChange={(e) =>
                      setEditableAnalysis((prev) => ({
                        ...prev,
                        teacherMessage: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 bg-white"
                    rows={3}
                    placeholder="학부모님께 전달할 메시지..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving || !selectedStudentId || !aiAnalysis}
            className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : '월간 리포트 저장'}
          </button>

          {!aiAnalysis && selectedStudentId && (
            <p className="text-center text-sm text-gray-500">
              저장하려면 먼저 AI 분석을 생성해주세요.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
