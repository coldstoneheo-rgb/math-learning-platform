'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { registerReportFeedbackData } from '@/lib/feedback-loop';
import { sendReportCreatedNotification } from '@/lib/notification-helper';
import { indexReportEmbeddings } from '@/lib/embedding-helper';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import type { Student, User, AnnualReportAnalysis, AnalysisData } from '@/types';

interface AnnualFormData {
  year: number;
  teacherAssessment: string;
  proudMoments: string[];
  personalMessage: string;
  teacherComments?: {
    attitudeAndFocus?: string;       // 연간 학습 태도 변화 총평
    annualGoalAchievement?: string;  // 연간 장기 목표 달성 관찰
    specialNote?: string;            // 기타 특이사항 (학부모 상담 총평 등)
  };
}

export default function NewAnnualReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [aiAnalysis, setAiAnalysis] = useState<AnnualReportAnalysis | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState<AnnualFormData>({
    year: currentYear,
    teacherAssessment: '',
    proudMoments: [''],
    personalMessage: '',
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

    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .order('name');

    setStudents(studentsData || []);
    setLoading(false);
  };

  // 자랑스러운 순간 핸들러
  const handleProudMomentAdd = () => {
    setFormData(prev => ({
      ...prev,
      proudMoments: [...prev.proudMoments, ''],
    }));
  };

  const handleProudMomentRemove = (index: number) => {
    setFormData(prev => ({
      ...prev,
      proudMoments: prev.proudMoments.filter((_, i) => i !== index),
    }));
  };

  const handleProudMomentChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      proudMoments: prev.proudMoments.map((item, i) => i === index ? value : item),
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
      const response = await fetch('/api/annual-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          year: formData.year,
        }),
      });

      const result = await response.json();

      if (result.success && result.analysis) {
        setAiAnalysis(result.analysis);
        addToast('AI 분석이 생성되었습니다. 저장 시 함께 저장됩니다.', 'success');
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

    if (!aiAnalysis) {
      setError('AI 분석을 먼저 생성해주세요. 연간 리포트는 AI 분석이 필수입니다.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // 연도 시작일
      const startDate = `${formData.year}-01-01`;

      // 선생님 평가 병합
      const teacherAssessment = {
        ...aiAnalysis.teacherAnnualAssessment,
        assessment: formData.teacherAssessment || aiAnalysis.teacherAnnualAssessment?.assessment || '',
        proudMoments: formData.proudMoments.filter(m => m.trim()) || aiAnalysis.teacherAnnualAssessment?.proudMoments || [],
        personalMessage: formData.personalMessage || aiAnalysis.teacherAnnualAssessment?.personalMessage || '',
      };

      const analysisData = {
        ...aiAnalysis,
        teacherAnnualAssessment: teacherAssessment,
      };

      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'annual',
          test_name: `${formData.year}년 연간 종합 리포트`,
          test_date: startDate,
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
              analysisData,
              reportType: 'annual',
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
            analysisData as unknown as AnalysisData
          );
          console.log('[Feedback Loop] 등록 결과:', feedbackResult);
        } catch (feedbackError) {
          console.warn('[Feedback Loop] 등록 실패:', feedbackError);
        }

        // [Parent Notification] 학부모 알림 발송
        const notifResult = await sendReportCreatedNotification({
          reportId: insertedReport.id,
          studentId: selectedStudentId as number,
        });
        if (notifResult.success && !notifResult.skipped) {
          console.log('[Notification] 학부모 알림 발송 완료');
        }

        // [Embedding] RAG 기억 서랍 인덱싱 (fire-and-forget)
        indexReportEmbeddings(insertedReport.id, selectedStudentId as number);
      }

      addToast('연간 리포트가 저장되었습니다.', 'success');
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

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'exceptional': return 'text-purple-600 bg-purple-100';
      case 'excellent': return 'text-blue-600 bg-blue-100';
      case 'good': return 'text-green-600 bg-green-100';
      case 'satisfactory': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-orange-600 bg-orange-100';
    }
  };

  const getRatingLabel = (rating: string) => {
    switch (rating) {
      case 'exceptional': return '탁월';
      case 'excellent': return '우수';
      case 'good': return '양호';
      case 'satisfactory': return '보통';
      default: return '개선 필요';
    }
  };

  const getGrowthCategoryLabel = (category: string) => {
    switch (category) {
      case 'exceptional': return '탁월한 성장';
      case 'excellent': return '우수한 성장';
      case 'good': return '양호한 성장';
      case 'steady': return '꾸준한 성장';
      default: return '관심 필요';
    }
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
            <h1 className="text-xl font-bold text-gray-900">연간 종합 리포트 작성</h1>
          </div>
          <span className="text-gray-600">{user?.name} 선생님</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* 안내 메시지 */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-semibold text-amber-800 mb-2">📚 연간 종합 리포트 (Macro Loop 완성)</h3>
            <p className="text-amber-700 text-sm">
              1년간의 성장 여정을 종합 분석합니다. Baseline 대비 성장, 메타프로필 연간 진화, 취약점 최종 점검, 다음 학년 준비도를 평가합니다.
            </p>
          </div>

          {/* 기본 정보 */}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">연도</label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                >
                  <option value={currentYear - 2}>{currentYear - 2}년</option>
                  <option value={currentYear - 1}>{currentYear - 1}년</option>
                  <option value={currentYear}>{currentYear}년</option>
                </select>
              </div>
            </div>
          </div>

          {/* 선생님 연간 평가 및 관찰 (선택) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. 선생님 연간 평가 및 관찰 (선택)</h2>
            <p className="text-sm text-gray-500 mb-4">
              AI가 연간 리포트를 분석할 때 참고할 장기적 관찰 항목과 선생님의 평가를 입력합니다. (비워두어도 무방합니다)
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연간 종합 평가 (기존)</label>
                <textarea
                  value={formData.teacherAssessment}
                  onChange={(e) => setFormData(prev => ({ ...prev, teacherAssessment: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={2}
                  placeholder="1년간의 학습 여정에 대한 종합 평가..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연간 학습 태도 변화 총평</label>
                <textarea
                  value={formData.teacherComments?.attitudeAndFocus || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), attitudeAndFocus: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="예: 1년 동안 끈기 있게 문제를 해결하는 습관이 어떻게 형성되었는지 등"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연간 장기 목표 달성 관찰</label>
                <textarea
                  value={formData.teacherComments?.annualGoalAchievement || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), annualGoalAchievement: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  placeholder="예: 올해 초 계획했던 '선행 학습' 또는 '심화 문제 풀이 능력 향상'에 대한 최종 평가 등"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">기타 특이사항 (학부모 상담 총평 등)</label>
                <textarea
                  value={formData.teacherComments?.specialNote || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), specialNote: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={2}
                  placeholder="예: 학부모 상담 주요 내용 종합 등"
                />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">자랑스러운 순간들</label>
                {formData.proudMoments.map((moment, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={moment}
                      onChange={(e) => handleProudMomentChange(index, e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                      placeholder="이 학생과 함께한 자랑스러운 순간..."
                    />
                    {formData.proudMoments.length > 1 && (
                      <button
                        onClick={() => handleProudMomentRemove(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleProudMomentAdd}
                  className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                >
                  + 순간 추가
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">학생에게 전하는 메시지</label>
                <textarea
                  value={formData.personalMessage}
                  onChange={(e) => setFormData(prev => ({ ...prev, personalMessage: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={3}
                  placeholder="1년간 함께한 학생에게 전하고 싶은 메시지..."
                />
              </div>
            </div>
          </div>

          {/* AI 분석 섹션 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. AI 분석 (필수)</h2>

            <p className="text-gray-600 text-sm mb-4">
              1년간의 모든 학습 데이터를 종합하여 AI가 성장 스토리와 종합 분석을 생성합니다.
            </p>

            <button
              onClick={handleGenerateAi}
              disabled={generatingAi || !selectedStudentId}
              className="px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {generatingAi ? (
                <>
                  <span className="animate-spin">⏳</span>
                  AI 분석 생성 중... (1년 데이터 수집 중)
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
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-amber-700">✅ AI 분석 생성 완료</h3>
                  <button
                    onClick={() => setAiAnalysis(null)}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    분석 삭제
                  </button>
                </div>

                <div className="space-y-6 text-sm">
                  {/* 연간 통계 */}
                  {aiAnalysis.annualStatistics && (
                    <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                      <div className="bg-amber-50 p-3 rounded-lg text-center">
                        <p className="text-xl font-bold text-amber-700">{aiAnalysis.annualStatistics.totalClasses}</p>
                        <p className="text-amber-600 text-xs">총 수업</p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <p className="text-xl font-bold text-blue-700">{aiAnalysis.annualStatistics.totalHours}h</p>
                        <p className="text-blue-600 text-xs">총 시간</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg text-center">
                        <p className="text-xl font-bold text-green-700">{aiAnalysis.annualStatistics.totalTests}</p>
                        <p className="text-green-600 text-xs">총 시험</p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg text-center">
                        <p className="text-xl font-bold text-purple-700">{aiAnalysis.annualStatistics.totalReports}</p>
                        <p className="text-purple-600 text-xs">총 리포트</p>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg text-center">
                        <p className="text-xl font-bold text-yellow-700">{aiAnalysis.annualStatistics.averageScore}</p>
                        <p className="text-yellow-600 text-xs">평균 점수</p>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-lg text-center">
                        <p className="text-xl font-bold text-emerald-700">
                          {aiAnalysis.annualStatistics.scoreImprovement > 0 ? '+' : ''}{aiAnalysis.annualStatistics.scoreImprovement}
                        </p>
                        <p className="text-emerald-600 text-xs">점수 향상</p>
                      </div>
                      <div className="bg-indigo-50 p-3 rounded-lg text-center">
                        <p className="text-xl font-bold text-indigo-700">{aiAnalysis.annualStatistics.attendanceRate}%</p>
                        <p className="text-indigo-600 text-xs">출석률</p>
                      </div>
                    </div>
                  )}

                  {/* 성장 스토리 */}
                  {aiAnalysis.growthNarrativeFinal && (
                    <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <h4 className="font-bold text-amber-800 mb-3 text-lg">📖 {aiAnalysis.growthNarrativeFinal.headline}</h4>
                      <p className="text-amber-900 mb-4">{aiAnalysis.growthNarrativeFinal.journey}</p>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="font-medium text-green-700 mb-2">🏆 주요 성취</p>
                          <ul className="text-green-800 space-y-1">
                            {aiAnalysis.growthNarrativeFinal.achievements.map((a, i) => (
                              <li key={i}>• {a}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-orange-700 mb-2">💪 극복한 도전</p>
                          <ul className="text-orange-800 space-y-1">
                            {aiAnalysis.growthNarrativeFinal.challenges.map((c, i) => (
                              <li key={i}>• {c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-amber-200">
                        <p className="text-amber-800 font-medium">✨ {aiAnalysis.growthNarrativeFinal.transformationSummary}</p>
                        <p className="text-amber-700 mt-2">🔮 {aiAnalysis.growthNarrativeFinal.lookingAhead}</p>
                      </div>
                    </div>
                  )}

                  {/* Baseline 대비 성장 */}
                  {aiAnalysis.baselineComparison && (
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <h4 className="font-medium text-indigo-800 mb-3">
                        📊 Baseline 대비 성장
                        <span className="ml-2 px-2 py-0.5 bg-indigo-200 text-indigo-700 rounded text-xs">
                          전체 성장률: {aiAnalysis.baselineComparison.overallGrowthRate}%
                        </span>
                        <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded text-xs">
                          {getGrowthCategoryLabel(aiAnalysis.baselineComparison.growthCategory)}
                        </span>
                      </h4>
                      {aiAnalysis.baselineComparison.currentMetrics && aiAnalysis.baselineComparison.currentMetrics.length > 0 && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {aiAnalysis.baselineComparison.currentMetrics.map((m, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg">
                              <p className="text-xs text-gray-500">{m.domain}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600">{m.initial}</span>
                                <span>→</span>
                                <span className="font-bold text-indigo-700">{m.current}</span>
                                <span className={`text-xs ${m.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  ({m.growth > 0 ? '+' : ''}{m.growth}, {m.growthRate}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 취약점 최종 점검 */}
                  {aiAnalysis.weaknessFinalReview && (
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-medium text-orange-800 mb-3">
                        🔍 취약점 최종 점검 (해결률: {aiAnalysis.weaknessFinalReview.overallResolutionRate}%)
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-green-600 font-medium mb-1">✅ 올해 해결</p>
                          {aiAnalysis.weaknessFinalReview.resolvedThisYear.length > 0 ? (
                            <ul className="text-xs text-green-700 space-y-1">
                              {aiAnalysis.weaknessFinalReview.resolvedThisYear.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          ) : <p className="text-xs text-gray-400">없음</p>}
                        </div>
                        <div>
                          <p className="text-xs text-yellow-600 font-medium mb-1">⏳ 여전히 활성</p>
                          {aiAnalysis.weaknessFinalReview.stillActive.length > 0 ? (
                            <ul className="text-xs text-yellow-700 space-y-1">
                              {aiAnalysis.weaknessFinalReview.stillActive.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          ) : <p className="text-xs text-gray-400">없음</p>}
                        </div>
                      </div>
                      {aiAnalysis.weaknessFinalReview.priorityForNextYear.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-orange-200">
                          <p className="text-xs text-red-600 font-medium mb-1">🎯 내년 우선 과제</p>
                          <ul className="text-xs text-red-700 space-y-1">
                            {aiAnalysis.weaknessFinalReview.priorityForNextYear.map((w, i) => <li key={i}>• {w}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 학년 성취도 */}
                  {aiAnalysis.gradeAchievement && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-3">📏 학년 성취도</h4>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">이수율</p>
                          <p className="text-2xl font-bold text-blue-700">{aiAnalysis.gradeAchievement.completionRate}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">학년 수준</p>
                          <p className={`text-lg font-bold ${
                            aiAnalysis.gradeAchievement.gradeLevel === '학년 초과' ? 'text-green-600' :
                            aiAnalysis.gradeAchievement.gradeLevel === '학년 적정' ? 'text-blue-600' : 'text-orange-600'
                          }`}>{aiAnalysis.gradeAchievement.gradeLevel}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">다음 학년 준비도</p>
                          <p className="text-2xl font-bold text-purple-700">{aiAnalysis.gradeAchievement.nextGradeReadiness}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 다음 학년 준비 */}
                  {aiAnalysis.nextYearPreparation && (
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-3">
                        🎓 다음 학년 준비 (준비도: {aiAnalysis.nextYearPreparation.readinessScore}%)
                      </h4>
                      <div className="mb-3">
                        <span className="text-xs text-purple-600 font-medium">권장 학습 속도: </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          aiAnalysis.nextYearPreparation.recommendedPace === 'accelerated' ? 'bg-green-100 text-green-700' :
                          aiAnalysis.nextYearPreparation.recommendedPace === 'normal' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {aiAnalysis.nextYearPreparation.recommendedPace === 'accelerated' ? '가속' :
                           aiAnalysis.nextYearPreparation.recommendedPace === 'normal' ? '정상' : '지원 필요'}
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-purple-600 font-medium mb-1">집중 영역</p>
                          <ul className="text-purple-700 space-y-1">
                            {aiAnalysis.nextYearPreparation.focusAreas.map((f, i) => <li key={i}>• {f}</li>)}
                          </ul>
                        </div>
                        {aiAnalysis.nextYearPreparation.earlyWarnings.length > 0 && (
                          <div>
                            <p className="text-red-600 font-medium mb-1">조기 경고</p>
                            <ul className="text-red-700 space-y-1">
                              {aiAnalysis.nextYearPreparation.earlyWarnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 장기 학습 경로 */}
                  {aiAnalysis.longTermPath && (
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                      <h4 className="font-medium text-indigo-800 mb-3">🔮 장기 학습 경로</h4>
                      <p className="text-indigo-700 mb-3">{aiAnalysis.longTermPath.currentTrajectory}</p>
                      <div className="mb-3">
                        <p className="text-xs text-indigo-600 font-medium mb-1">예측 결과</p>
                        <div className="space-y-2">
                          {aiAnalysis.longTermPath.projectedOutcomes.map((o, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500 w-16">{o.timeframe}</span>
                              <span className="text-indigo-700">{o.projection}</span>
                              <span className="text-gray-400">(신뢰도: {o.confidence}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-indigo-800 font-medium">
                        📌 권장 경로: {aiAnalysis.longTermPath.recommendedPath}
                      </p>
                    </div>
                  )}

                  {/* 부모님 연간 보고 */}
                  {aiAnalysis.parentAnnualReport && (
                    <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                      <h4 className="font-bold text-emerald-800 mb-3">💌 부모님께 드리는 연간 보고서</h4>
                      <p className="text-emerald-900 whitespace-pre-line mb-4">{aiAnalysis.parentAnnualReport.letterToParents}</p>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-emerald-600 font-medium mb-1">✨ 올해의 하이라이트</p>
                          <ul className="text-sm text-emerald-800 space-y-1">
                            {aiAnalysis.parentAnnualReport.yearHighlights.map((h, i) => <li key={i}>• {h}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600 font-medium mb-1">💰 투자 대비 성과</p>
                          <p className="text-sm text-emerald-800">{aiAnalysis.parentAnnualReport.investmentSummary}</p>
                        </div>
                        <div>
                          <p className="text-xs text-emerald-600 font-medium mb-1">📋 내년 권장 사항</p>
                          <ul className="text-sm text-emerald-800 space-y-1">
                            {aiAnalysis.parentAnnualReport.nextYearRecommendations.map((r, i) => <li key={i}>• {r}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 선생님 평가 */}
                  {aiAnalysis.teacherAnnualAssessment && (
                    <div className="p-4 bg-gray-100 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                        👨‍🏫 선생님 연간 평가
                        <span className={`px-2 py-0.5 rounded text-xs ${getRatingColor(aiAnalysis.teacherAnnualAssessment.overallRating)}`}>
                          {getRatingLabel(aiAnalysis.teacherAnnualAssessment.overallRating)}
                        </span>
                      </h4>
                      <p className="text-gray-700 mb-3">{aiAnalysis.teacherAnnualAssessment.assessment}</p>
                      <div className="grid md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-green-600 font-medium mb-1">자랑스러운 순간</p>
                          <ul className="text-green-700 space-y-1">
                            {aiAnalysis.teacherAnnualAssessment.proudMoments.map((m, i) => <li key={i}>🌟 {m}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-blue-600 font-medium mb-1">성장 영역</p>
                          <ul className="text-blue-700 space-y-1">
                            {aiAnalysis.teacherAnnualAssessment.areasForGrowth.map((a, i) => <li key={i}>📈 {a}</li>)}
                          </ul>
                        </div>
                      </div>
                      {aiAnalysis.teacherAnnualAssessment.personalMessage && (
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <p className="text-gray-600 text-xs font-medium mb-1">💬 선생님의 메시지</p>
                          <p className="text-gray-800 italic">&quot;{aiAnalysis.teacherAnnualAssessment.personalMessage}&quot;</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving || !selectedStudentId || !aiAnalysis}
            className="w-full py-4 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : !aiAnalysis ? 'AI 분석을 먼저 생성해주세요' : '연간 종합 리포트 저장'}
          </button>
        </div>
      </main>
    </div>
  );
}
