'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { registerReportFeedbackData } from '@/lib/feedback-loop';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import type { Student, User, SemiAnnualReportAnalysis, AnalysisData } from '@/types';

interface SemiAnnualFormData {
  year: number;
  halfYear: '상반기' | '하반기';
  teacherAssessment: string;
  additionalNotes: string;
  teacherComments?: {
    attitudeAndFocus?: string;         // 반기 동안의 학습 태도 변화
    semiAnnualGoalAchievement?: string; // 반기 장기 목표 달성 관찰
    specialNote?: string;              // 기타 특이사항
  };
}

export default function NewSemiAnnualReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { toasts, addToast, removeToast } = useToast();

  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [aiAnalysis, setAiAnalysis] = useState<SemiAnnualReportAnalysis | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const [formData, setFormData] = useState<SemiAnnualFormData>({
    year: currentYear,
    halfYear: currentMonth <= 6 ? '상반기' : '하반기',
    teacherAssessment: '',
    additionalNotes: '',
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

  // AI 분석 생성
  const handleGenerateAi = async () => {
    setError('');

    if (!selectedStudentId) {
      setError('AI 분석을 위해 학생을 선택해주세요.');
      return;
    }

    setGeneratingAi(true);

    try {
      const response = await fetch('/api/semi-annual-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          year: formData.year,
          halfYear: formData.halfYear,
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
      setError('AI 분석을 먼저 생성해주세요. 반기 리포트는 AI 분석이 필수입니다.');
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // 반기 시작일 계산
      const startMonth = formData.halfYear === '상반기' ? 1 : 7;
      const startDate = `${formData.year}-${String(startMonth).padStart(2, '0')}-01`;

      const analysisData = {
        ...aiAnalysis,
        teacherAssessment: formData.teacherAssessment || aiAnalysis.teacherAssessment,
        additionalNotes: formData.additionalNotes,
      };

      const { data: insertedReport, error: insertError } = await supabase
        .from('reports')
        .insert({
          student_id: selectedStudentId,
          report_type: 'semi_annual',
          test_name: `${formData.year}년 ${formData.halfYear} 종합 리포트`,
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
              reportType: 'semi_annual',
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
      }

      addToast('반기 리포트가 저장되었습니다.', 'success');
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

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining' | 'concerning') => {
    switch (trend) {
      case 'improving': return '📈';
      case 'stable': return '➡️';
      case 'declining': return '📉';
      case 'concerning': return '⚠️';
    }
  };

  const getTrendLabel = (trend: 'improving' | 'stable' | 'declining' | 'concerning') => {
    switch (trend) {
      case 'improving': return '개선 중';
      case 'stable': return '유지';
      case 'declining': return '하락';
      case 'concerning': return '주의 필요';
    }
  };

  const getGrowthTypeLabel = (type: 'exponential' | 'linear' | 'plateau' | 'fluctuating') => {
    switch (type) {
      case 'exponential': return '🚀 급성장';
      case 'linear': return '📊 꾸준한 성장';
      case 'plateau': return '⏸️ 정체기';
      case 'fluctuating': return '📈📉 변동성';
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
            <h1 className="text-xl font-bold text-gray-900">반기 종합 리포트 작성</h1>
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
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <h3 className="font-semibold text-purple-800 mb-2">📊 반기 종합 리포트 (Macro Loop)</h3>
            <p className="text-purple-700 text-sm">
              6개월간의 학습 데이터를 종합 분석합니다. 성장 궤적, 메타프로필 변화, 취약점 해결 현황을 검토하고 다음 반기 전략을 수립합니다.
            </p>
          </div>

          {/* 기본 정보 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">1. 기본 정보</h2>

            <div className="grid md:grid-cols-3 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연도</label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData(prev => ({ ...prev, year: Number(e.target.value) }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value={currentYear - 1}>{currentYear - 1}년</option>
                  <option value={currentYear}>{currentYear}년</option>
                  <option value={currentYear + 1}>{currentYear + 1}년</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">반기</label>
                <select
                  value={formData.halfYear}
                  onChange={(e) => setFormData(prev => ({ ...prev, halfYear: e.target.value as '상반기' | '하반기' }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="상반기">상반기 (1~6월)</option>
                  <option value="하반기">하반기 (7~12월)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 교사 관찰 코멘트 (선택) */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. 교사 관찰 코멘트 (선택)</h2>
            <p className="text-sm text-gray-500 mb-4">
              AI가 반기 리포트를 분석할 때 참고할 장기적 관찰 항목을 입력합니다. (비워두어도 무방합니다)
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">반기 종합 평가 (기존)</label>
                <textarea
                  value={formData.teacherAssessment}
                  onChange={(e) => setFormData(prev => ({ ...prev, teacherAssessment: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="6개월간의 학습 과정에 대한 종합 평가..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">반기 동안의 학습 태도 변화</label>
                <textarea
                  value={formData.teacherComments?.attitudeAndFocus || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), attitudeAndFocus: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 학기 초반 대비 후반부의 집중력 변화, 자기주도적 학습 태도 형성 등"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">반기 장기 목표 달성 관찰</label>
                <textarea
                  value={formData.teacherComments?.semiAnnualGoalAchievement || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    teacherComments: { ...(prev.teacherComments || {}), semiAnnualGoalAchievement: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 이번 반기 핵심 목표였던 '중학 수학 기초 확립'에 대한 교사의 평가 등"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">추가 메모 (기타 특이사항)</label>
                <textarea
                  value={formData.teacherComments?.specialNote || formData.additionalNotes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    additionalNotes: e.target.value,
                    teacherComments: { ...(prev.teacherComments || {}), specialNote: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                  placeholder="예: 학부모 상담 주요 내용, 다음 학기 대비 특이사항 등"
                />
              </div>
            </div>
          </div>

          {/* AI 분석 섹션 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. AI 분석 (필수)</h2>

            <p className="text-gray-600 text-sm mb-4">
              6개월간의 수업 기록, 시험 결과, 월간 리포트를 종합하여 AI가 Macro Loop 분석을 생성합니다.
            </p>

            <button
              onClick={handleGenerateAi}
              disabled={generatingAi || !selectedStudentId}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {generatingAi ? (
                <>
                  <span className="animate-spin">⏳</span>
                  AI 분석 생성 중... (데이터 수집 중)
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
                  <h3 className="font-semibold text-purple-700">✅ AI 분석 생성 완료</h3>
                  <button
                    onClick={() => setAiAnalysis(null)}
                    className="text-sm text-gray-500 hover:text-red-600"
                  >
                    분석 삭제
                  </button>
                </div>

                <div className="space-y-6 text-sm">
                  {/* 기간 요약 통계 */}
                  {aiAnalysis.periodSummary && (
                    <div className="grid grid-cols-5 gap-3">
                      <div className="bg-purple-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-700">{aiAnalysis.periodSummary.totalClasses}</p>
                        <p className="text-purple-600 text-xs">총 수업</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-700">{aiAnalysis.periodSummary.totalHours}h</p>
                        <p className="text-blue-600 text-xs">총 학습 시간</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-700">{aiAnalysis.periodSummary.totalTests}</p>
                        <p className="text-green-600 text-xs">총 시험</p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-yellow-700">{aiAnalysis.periodSummary.averageScore}점</p>
                        <p className="text-yellow-600 text-xs">평균 점수</p>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-emerald-700">
                          {aiAnalysis.periodSummary.scoreImprovement > 0 ? '+' : ''}{aiAnalysis.periodSummary.scoreImprovement}
                        </p>
                        <p className="text-emerald-600 text-xs">점수 변화</p>
                      </div>
                    </div>
                  )}

                  {/* 성장 궤적 */}
                  {aiAnalysis.growthTrajectory && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-3">📈 성장 궤적</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">시작점</p>
                          <p className="font-semibold text-gray-800">{aiAnalysis.growthTrajectory.startingPoint.score}점 ({aiAnalysis.growthTrajectory.startingPoint.level})</p>
                          <p className="text-xs text-gray-500">{aiAnalysis.growthTrajectory.startingPoint.date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">현재</p>
                          <p className="font-semibold text-gray-800">{aiAnalysis.growthTrajectory.currentPoint.score}점 ({aiAnalysis.growthTrajectory.currentPoint.level})</p>
                          <p className="text-xs text-gray-500">{aiAnalysis.growthTrajectory.currentPoint.date}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">성장률</p>
                          <p className="font-semibold text-purple-700">{aiAnalysis.growthTrajectory.growthRate}%</p>
                          <p className="text-xs text-gray-500">{getGrowthTypeLabel(aiAnalysis.growthTrajectory.growthType)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 메타프로필 변화 */}
                  {aiAnalysis.metaProfileEvolution && (
                    <div className="p-4 bg-indigo-50 rounded-lg">
                      <h4 className="font-medium text-indigo-800 mb-3">🧬 메타프로필 변화</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            흡수율 {getTrendIcon(aiAnalysis.metaProfileEvolution.absorptionRateChange.trend)}
                          </p>
                          <p className="font-medium">
                            {aiAnalysis.metaProfileEvolution.absorptionRateChange.previous} → {aiAnalysis.metaProfileEvolution.absorptionRateChange.current}
                          </p>
                          <p className="text-xs text-indigo-600">{getTrendLabel(aiAnalysis.metaProfileEvolution.absorptionRateChange.trend)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            지구력 {getTrendIcon(aiAnalysis.metaProfileEvolution.staminaChange.trend)}
                          </p>
                          <p className="font-medium">
                            {aiAnalysis.metaProfileEvolution.staminaChange.previous} → {aiAnalysis.metaProfileEvolution.staminaChange.current}
                          </p>
                          <p className="text-xs text-indigo-600">{getTrendLabel(aiAnalysis.metaProfileEvolution.staminaChange.trend)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            메타인지 {getTrendIcon(aiAnalysis.metaProfileEvolution.metaCognitionChange.trend)}
                          </p>
                          <p className="font-medium">
                            {aiAnalysis.metaProfileEvolution.metaCognitionChange.previous} → {aiAnalysis.metaProfileEvolution.metaCognitionChange.current}
                          </p>
                          <p className="text-xs text-indigo-600">{getTrendLabel(aiAnalysis.metaProfileEvolution.metaCognitionChange.trend)}</p>
                        </div>
                      </div>

                      {/* 오류 서명 변화 */}
                      {aiAnalysis.metaProfileEvolution.errorSignatureChange && (
                        <div className="mt-4 pt-4 border-t border-indigo-200">
                          <p className="text-xs text-gray-500 mb-2">
                            오류 패턴 변화 {getTrendIcon(aiAnalysis.metaProfileEvolution.errorSignatureChange.overallTrend)}
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-green-600 font-medium">해결됨</p>
                              {aiAnalysis.metaProfileEvolution.errorSignatureChange.resolvedPatterns.length > 0 ? (
                                <ul className="text-green-700">
                                  {aiAnalysis.metaProfileEvolution.errorSignatureChange.resolvedPatterns.map((p, i) => (
                                    <li key={i}>✓ {p}</li>
                                  ))}
                                </ul>
                              ) : <p className="text-gray-400">-</p>}
                            </div>
                            <div>
                              <p className="text-yellow-600 font-medium">지속 중</p>
                              {aiAnalysis.metaProfileEvolution.errorSignatureChange.persistentPatterns.length > 0 ? (
                                <ul className="text-yellow-700">
                                  {aiAnalysis.metaProfileEvolution.errorSignatureChange.persistentPatterns.map((p, i) => (
                                    <li key={i}>• {p}</li>
                                  ))}
                                </ul>
                              ) : <p className="text-gray-400">-</p>}
                            </div>
                            <div>
                              <p className="text-red-600 font-medium">새로 발견</p>
                              {aiAnalysis.metaProfileEvolution.errorSignatureChange.newPatterns.length > 0 ? (
                                <ul className="text-red-700">
                                  {aiAnalysis.metaProfileEvolution.errorSignatureChange.newPatterns.map((p, i) => (
                                    <li key={i}>! {p}</li>
                                  ))}
                                </ul>
                              ) : <p className="text-gray-400">-</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 취약점 종합 점검 */}
                  {aiAnalysis.weaknessReview && (
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-medium text-orange-800 mb-3">
                        🔍 취약점 종합 점검 (해결률: {aiAnalysis.weaknessReview.resolutionRate}%)
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-green-600 font-medium mb-1">✅ 해결된 취약점</p>
                          {aiAnalysis.weaknessReview.resolved.length > 0 ? (
                            <ul className="text-xs text-green-700 space-y-1">
                              {aiAnalysis.weaknessReview.resolved.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          ) : <p className="text-xs text-gray-400">없음</p>}
                        </div>
                        <div>
                          <p className="text-xs text-yellow-600 font-medium mb-1">📈 개선 중인 취약점</p>
                          {aiAnalysis.weaknessReview.improved.length > 0 ? (
                            <ul className="text-xs text-yellow-700 space-y-1">
                              {aiAnalysis.weaknessReview.improved.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          ) : <p className="text-xs text-gray-400">없음</p>}
                        </div>
                        <div>
                          <p className="text-xs text-red-600 font-medium mb-1">⚠️ 지속 중인 취약점</p>
                          {aiAnalysis.weaknessReview.persistent.length > 0 ? (
                            <ul className="text-xs text-red-700 space-y-1">
                              {aiAnalysis.weaknessReview.persistent.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          ) : <p className="text-xs text-gray-400">없음</p>}
                        </div>
                        <div>
                          <p className="text-xs text-purple-600 font-medium mb-1">🆕 새로 발견된 취약점</p>
                          {aiAnalysis.weaknessReview.new.length > 0 ? (
                            <ul className="text-xs text-purple-700 space-y-1">
                              {aiAnalysis.weaknessReview.new.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          ) : <p className="text-xs text-gray-400">없음</p>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 강점 발전 현황 */}
                  {aiAnalysis.strengthDevelopment && (
                    <div className="p-4 bg-emerald-50 rounded-lg">
                      <h4 className="font-medium text-emerald-800 mb-3">💪 강점 발전 현황</h4>
                      <div className="grid md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-emerald-600 font-medium mb-1">확립된 강점</p>
                          <ul className="text-emerald-700 space-y-1">
                            {aiAnalysis.strengthDevelopment.consolidatedStrengths.map((s, i) => <li key={i}>★ {s}</li>)}
                          </ul>
                        </div>
                        <div>
                          <p className="text-blue-600 font-medium mb-1">발현 중인 강점</p>
                          <ul className="text-blue-700 space-y-1">
                            {aiAnalysis.strengthDevelopment.emergingStrengths.map((s, i) => <li key={i}>⭐ {s}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 다음 반기 전략 */}
                  {aiAnalysis.nextHalfStrategy && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-3">🎯 다음 반기 전략</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-blue-600 font-medium">주요 목표</p>
                          <ul className="text-sm text-blue-800">
                            {aiAnalysis.nextHalfStrategy.primaryGoals.map((g, i) => <li key={i}>• {g}</li>)}
                          </ul>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-blue-600 font-medium">집중 영역</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {aiAnalysis.nextHalfStrategy.focusDomains.map((d, i) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{d}</span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-blue-600 font-medium">목표 점수</p>
                            <p className="text-lg font-bold text-blue-800">{aiAnalysis.nextHalfStrategy.targetScore}점</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 학년 수준 재평가 */}
                  {aiAnalysis.levelReassessment && (
                    <div className="p-4 bg-gray-100 rounded-lg">
                      <h4 className="font-medium text-gray-800 mb-3">📏 학년 수준 재평가</h4>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">이전</p>
                          <p className="font-semibold">{aiAnalysis.levelReassessment.previousLevel}</p>
                        </div>
                        <span className="text-xl">→</span>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">현재</p>
                          <p className="font-semibold text-purple-700">{aiAnalysis.levelReassessment.currentLevel}</p>
                        </div>
                        <div className="ml-4 text-center">
                          <p className="text-xs text-gray-500">성장</p>
                          <p className="font-semibold text-green-600">+{aiAnalysis.levelReassessment.gradeGrowth}학년</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">{aiAnalysis.levelReassessment.comparisonToStandard}</p>
                    </div>
                  )}

                  {/* 부모님 종합 보고 */}
                  {aiAnalysis.parentComprehensiveReport && (
                    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                      <h4 className="font-medium text-amber-800 mb-3">📋 부모님 종합 보고</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-amber-600 font-medium">핵심 요약</p>
                          <p className="text-sm text-amber-900">{aiAnalysis.parentComprehensiveReport.executiveSummary}</p>
                        </div>
                        <div>
                          <p className="text-xs text-amber-600 font-medium">투자 대비 성과</p>
                          <p className="text-sm text-amber-900">{aiAnalysis.parentComprehensiveReport.investmentReturn}</p>
                        </div>
                        <div>
                          <p className="text-xs text-amber-600 font-medium">권장 사항</p>
                          <ul className="text-sm text-amber-900">
                            {aiAnalysis.parentComprehensiveReport.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 장기 비전 업데이트 */}
                  {aiAnalysis.longTermVisionUpdate && (
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                      <h4 className="font-medium text-indigo-800 mb-3">🔮 장기 비전</h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium text-indigo-600">연말 전망:</span> {aiAnalysis.longTermVisionUpdate.yearEndProjection}</p>
                        <p><span className="font-medium text-indigo-600">내년 전망:</span> {aiAnalysis.longTermVisionUpdate.nextYearOutlook}</p>
                        <div>
                          <span className="font-medium text-indigo-600">성장 경로:</span>
                          <ul className="mt-1 text-indigo-700">
                            {aiAnalysis.longTermVisionUpdate.potentialPaths.map((p, i) => <li key={i}>→ {p}</li>)}
                          </ul>
                        </div>
                      </div>
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
            className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '저장 중...' : !aiAnalysis ? 'AI 분석을 먼저 생성해주세요' : '반기 종합 리포트 저장'}
          </button>
        </div>
      </main>
    </div>
  );
}
