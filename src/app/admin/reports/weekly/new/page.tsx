'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import MultiFileUpload, { UploadedFile } from '@/components/common/MultiFileUpload';
import { registerReportFeedbackData } from '@/lib/feedback-loop';
import type { Student, User, WeeklyReportAnalysis, Schedule, AnalysisData } from '@/types';

interface WeeklyFormData {
  period: string;
  studentName: string;
  monthWeek: string; // "12월 4주차" 형식
  startDate: string;
  endDate: string;
  classDates: string[];
  classNotes: string;
}

// 월-주차 형식 계산 (e.g., "12월 4주차")
function getMonthWeekFormat(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekOfMonth = Math.ceil(day / 7);
  return `${month}월 ${weekOfMonth}주차`;
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

// 요일 변환 (0=일요일 -> 날짜)
function getDatesForDayOfWeek(
  dayOfWeek: number,
  startDate: string,
  endDate: string
): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const current = new Date(start);
  while (current <= end) {
    if (current.getDay() === dayOfWeek) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default function NewWeeklyReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [studentSchedules, setStudentSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // AI 분석 상태
  const [aiAnalysis, setAiAnalysis] = useState<WeeklyReportAnalysis | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // 파일 업로드 상태
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const currentDate = new Date();
  const thisWeek = getThisWeekRange();

  const [formData, setFormData] = useState<WeeklyFormData>({
    period: '',
    studentName: '',
    monthWeek: getMonthWeekFormat(currentDate),
    startDate: thisWeek.start,
    endDate: thisWeek.end,
    classDates: [],
    classNotes: '',
  });

  // 편집 가능한 AI 분석 결과
  const [editableAnalysis, setEditableAnalysis] = useState({
    weeklyAchievements: [''],
    areasForImprovement: [''],
    continuityScore: 0,
    momentumStatus: 'maintaining' as 'accelerating' | 'maintaining' | 'slowing' | 'recovering',
    nextWeekFocus: '',
    nextWeekGoals: [''],
    encouragement: '',
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  // 학생 선택 시 스케줄 자동 로드
  const loadStudentSchedules = useCallback(async (studentId: number) => {
    setLoadingSchedules(true);
    try {
      const supabase = createClient();
      const { data: schedules } = await supabase
        .from('schedules')
        .select('*')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('day_of_week');

      if (schedules && schedules.length > 0) {
        setStudentSchedules(schedules);

        // 해당 주의 수업 날짜 자동 계산
        const classDates: string[] = [];
        schedules.forEach((schedule) => {
          const dates = getDatesForDayOfWeek(
            schedule.day_of_week,
            formData.startDate,
            formData.endDate
          );
          classDates.push(...dates);
        });

        // 날짜 정렬
        classDates.sort();
        setFormData((prev) => ({
          ...prev,
          classDates: classDates.length > 0 ? classDates : [],
        }));
      } else {
        setStudentSchedules([]);
        setFormData((prev) => ({ ...prev, classDates: [] }));
      }
    } catch (err) {
      console.error('스케줄 로드 오류:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }, [formData.startDate, formData.endDate]);

  useEffect(() => {
    const student = students.find((s) => s.id === selectedStudentId);
    if (student) {
      setFormData((prev) => ({
        ...prev,
        studentName: student.name,
        period: `${prev.startDate} ~ ${prev.endDate}`,
      }));
      loadStudentSchedules(student.id);
    }
  }, [selectedStudentId, students, loadStudentSchedules]);

  // 날짜 변경 시 monthWeek 및 수업일정 업데이트
  useEffect(() => {
    const startDate = new Date(formData.startDate);
    setFormData((prev) => ({
      ...prev,
      monthWeek: getMonthWeekFormat(startDate),
      period: `${prev.startDate} ~ ${prev.endDate}`,
    }));

    // 학생이 선택되어 있으면 수업 일정 재계산
    if (selectedStudentId && studentSchedules.length > 0) {
      const classDates: string[] = [];
      studentSchedules.forEach((schedule) => {
        const dates = getDatesForDayOfWeek(
          schedule.day_of_week,
          formData.startDate,
          formData.endDate
        );
        classDates.push(...dates);
      });
      classDates.sort();
      setFormData((prev) => ({
        ...prev,
        classDates: classDates.length > 0 ? classDates : [],
      }));
    }
  }, [formData.startDate, formData.endDate, selectedStudentId, studentSchedules]);

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

  // AI 분석 생성 (필수)
  const handleGenerateAi = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('학생을 선택해주세요.');
      return;
    }

    if (!formData.classNotes.trim() && uploadedFiles.length === 0) {
      setError('수업 노트를 입력하거나 파일을 업로드해주세요.');
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

      const response = await fetch('/api/weekly-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          year: currentDate.getFullYear(),
          monthWeek: formData.monthWeek,
          startDate: formData.startDate,
          endDate: formData.endDate,
          classDates: formData.classDates,
          teacherNotes: formData.classNotes || '주간 종합 평가 요청',
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
          weeklyAchievements: result.analysis.weeklyAchievements || [''],
          areasForImprovement: result.analysis.areasForImprovement || [''],
          continuityScore: result.analysis.microLoopFeedback?.continuityScore || 0,
          momentumStatus: result.analysis.microLoopFeedback?.momentumStatus || 'maintaining',
          nextWeekFocus: result.analysis.nextWeekPlan?.focus || '',
          nextWeekGoals: result.analysis.nextWeekPlan?.goals || [''],
          encouragement: result.analysis.encouragement || '',
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
  const handleEditableArrayAdd = (field: 'weeklyAchievements' | 'areasForImprovement' | 'nextWeekGoals') => {
    setEditableAnalysis((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }));
  };

  const handleEditableArrayRemove = (field: 'weeklyAchievements' | 'areasForImprovement' | 'nextWeekGoals', index: number) => {
    setEditableAnalysis((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const handleEditableArrayChange = (field: 'weeklyAchievements' | 'areasForImprovement' | 'nextWeekGoals', index: number, value: string) => {
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
      setError('AI 분석을 먼저 생성해주세요. (AI 분석 필수)');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // 편집된 분석 결과로 최종 데이터 구성
      const finalAnalysis: WeeklyReportAnalysis = {
        ...aiAnalysis,
        weeklyAchievements: editableAnalysis.weeklyAchievements.filter((a) => a.trim()),
        areasForImprovement: editableAnalysis.areasForImprovement.filter((a) => a.trim()),
        microLoopFeedback: {
          continuityScore: editableAnalysis.continuityScore,
          momentumStatus: editableAnalysis.momentumStatus,
          lastWeekGoalAchievement: aiAnalysis.microLoopFeedback?.lastWeekGoalAchievement || [],
        },
        nextWeekPlan: {
          focus: editableAnalysis.nextWeekFocus,
          goals: editableAnalysis.nextWeekGoals.filter((g) => g.trim()),
          assignments: aiAnalysis.nextWeekPlan?.assignments || [],
        },
        encouragement: editableAnalysis.encouragement,
      };

      const analysisData = {
        period: formData.period,
        studentName: formData.studentName,
        monthWeek: formData.monthWeek,
        startDate: formData.startDate,
        endDate: formData.endDate,
        classDates: formData.classDates,
        classNotes: formData.classNotes,
        aiAnalysis: finalAnalysis,
      };

      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'weekly',
          test_name: `${currentDate.getFullYear()}년 ${formData.monthWeek} 주간 리포트`,
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
              analysisData: finalAnalysis,
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

        // [Feedback Loop] 전략 추적 및 예측 데이터 등록
        try {
          const feedbackResult = await registerReportFeedbackData(
            insertedReport.id,
            selectedStudentId as number,
            finalAnalysis as unknown as AnalysisData
          );
          console.log('[Feedback Loop] 등록 결과:', feedbackResult);
        } catch (feedbackError) {
          console.warn('[Feedback Loop] 등록 실패:', feedbackError);
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

  const getDayLabel = (day: number): string => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[day];
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
              한 주간의 학습을 AI가 분석합니다. 수업 노트와 파일을 첨부하면 더 정확한 분석이 가능합니다.
              AI 분석은 <strong>필수</strong>입니다.
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
                  type="text"
                  value={formData.monthWeek}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                />
                <p className="text-xs text-gray-500 mt-1">시작일 기준 자동 계산</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* 자동 로드된 수업 일정 표시 */}
            {selectedStudentId && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">수업 일정 (자동 로드)</label>
                  {loadingSchedules && <span className="text-xs text-gray-500">로딩 중...</span>}
                </div>

                {studentSchedules.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {studentSchedules.map((schedule) => (
                        <span
                          key={schedule.id}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                        >
                          {getDayLabel(schedule.day_of_week)} {schedule.start_time}-{schedule.end_time}
                        </span>
                      ))}
                    </div>

                    {formData.classDates.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-600 mb-1">이번 주 수업일:</p>
                        <div className="flex flex-wrap gap-2">
                          {formData.classDates.map((date, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                            >
                              {date}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    등록된 수업 일정이 없습니다.{' '}
                    <a href="/admin/schedules" className="text-green-600 hover:underline">
                      일정 등록하기
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 2. 수업 노트 및 파일 업로드 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">2. 수업 데이터</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                수업 노트 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.classNotes}
                onChange={(e) => setFormData((prev) => ({ ...prev, classNotes: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                rows={4}
                placeholder="이번 주 수업 전반에 대한 노트... (학습 내용, 학생 태도, 특이사항 등)"
              />
            </div>

            <MultiFileUpload
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              acceptedTypes={['image', 'pdf', 'csv']}
              maxFiles={10}
              maxSizeMB={10}
              label="참고 파일 (선택)"
              helpText="수업 자료, 학습지 사진, 성적표 등을 업로드하면 더 정확한 분석이 가능합니다."
            />
          </div>

          {/* 3. AI 분석 (필수) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              3. AI 분석 <span className="text-red-500">*</span>
            </h2>

            <p className="text-gray-600 text-sm mb-4">
              수업 노트와 첨부 파일, DB에 저장된 수업 기록/숙제 데이터를 기반으로 AI가 Micro Loop 분석을 생성합니다.
            </p>

            {!aiAnalysis ? (
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
                    AI 분석 생성 (필수)
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-green-700">✅ AI 분석 완료 - 내용을 편집할 수 있습니다</h3>
                  <button
                    onClick={() => {
                      setAiAnalysis(null);
                      setEditableAnalysis({
                        weeklyAchievements: [''],
                        areasForImprovement: [''],
                        continuityScore: 0,
                        momentumStatus: 'maintaining',
                        nextWeekFocus: '',
                        nextWeekGoals: [''],
                        encouragement: '',
                      });
                    }}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    다시 생성
                  </button>
                </div>

                {/* 주간 성취 (편집 가능) */}
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-3">🏆 주간 성취</h4>
                  {editableAnalysis.weeklyAchievements.map((achievement, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={achievement}
                        onChange={(e) =>
                          handleEditableArrayChange('weeklyAchievements', idx, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                        placeholder="성취 내용..."
                      />
                      {editableAnalysis.weeklyAchievements.length > 1 && (
                        <button
                          onClick={() => handleEditableArrayRemove('weeklyAchievements', idx)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => handleEditableArrayAdd('weeklyAchievements')}
                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    + 추가
                  </button>
                </div>

                {/* 개선 필요 영역 (편집 가능) */}
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-3">⚠️ 개선 필요 영역</h4>
                  {editableAnalysis.areasForImprovement.map((area, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={area}
                        onChange={(e) =>
                          handleEditableArrayChange('areasForImprovement', idx, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white"
                        placeholder="개선 필요 내용..."
                      />
                      {editableAnalysis.areasForImprovement.length > 1 && (
                        <button
                          onClick={() => handleEditableArrayRemove('areasForImprovement', idx)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => handleEditableArrayAdd('areasForImprovement')}
                    className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                  >
                    + 추가
                  </button>
                </div>

                {/* Micro Loop 피드백 (편집 가능) */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-3">🔄 Micro Loop 피드백</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-blue-700 mb-1">연속성 점수 (0-100)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={editableAnalysis.continuityScore}
                        onChange={(e) =>
                          setEditableAnalysis((prev) => ({
                            ...prev,
                            continuityScore: Number(e.target.value),
                          }))
                        }
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-blue-700 mb-1">모멘텀 상태</label>
                      <select
                        value={editableAnalysis.momentumStatus}
                        onChange={(e) =>
                          setEditableAnalysis((prev) => ({
                            ...prev,
                            momentumStatus: e.target.value as typeof editableAnalysis.momentumStatus,
                          }))
                        }
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="accelerating">🚀 가속 중</option>
                        <option value="maintaining">➡️ 유지</option>
                        <option value="slowing">⬇️ 둔화</option>
                        <option value="recovering">↩️ 회복 중</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 다음 주 계획 (편집 가능) */}
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <h4 className="font-medium text-indigo-800 mb-3">📅 다음 주 계획</h4>
                  <div className="mb-3">
                    <label className="block text-xs text-indigo-700 mb-1">집중 포커스</label>
                    <input
                      type="text"
                      value={editableAnalysis.nextWeekFocus}
                      onChange={(e) =>
                        setEditableAnalysis((prev) => ({
                          ...prev,
                          nextWeekFocus: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder="다음 주 집중할 내용..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-indigo-700 mb-1">목표</label>
                    {editableAnalysis.nextWeekGoals.map((goal, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={goal}
                          onChange={(e) =>
                            handleEditableArrayChange('nextWeekGoals', idx, e.target.value)
                          }
                          className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                          placeholder="목표..."
                        />
                        {editableAnalysis.nextWeekGoals.length > 1 && (
                          <button
                            onClick={() => handleEditableArrayRemove('nextWeekGoals', idx)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleEditableArrayAdd('nextWeekGoals')}
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      + 목표 추가
                    </button>
                  </div>
                </div>

                {/* 격려 메시지 (편집 가능) */}
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                  <h4 className="font-medium text-green-800 mb-3">💪 격려 메시지</h4>
                  <textarea
                    value={editableAnalysis.encouragement}
                    onChange={(e) =>
                      setEditableAnalysis((prev) => ({
                        ...prev,
                        encouragement: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                    rows={2}
                    placeholder="학생에게 전할 격려 메시지..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving || !selectedStudentId || !aiAnalysis}
            className="w-full py-4 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : '주간 리포트 저장'}
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
