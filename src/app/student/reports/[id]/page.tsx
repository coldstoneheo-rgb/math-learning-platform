'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MetaHeader, VisionFooter } from '@/components/report';
import {
  FivePerspectiveAnalysis,
  ConfidenceBadge,
  getConfidenceLevel,
  EvidenceBadge,
  ReportGrowthHero,
} from '@/components/report/premium';
import ProblemAnalysisSection from '@/components/report/ProblemAnalysisSection';
import dynamic from 'next/dynamic';
import ChartSkeleton from '@/components/common/ChartSkeleton';
const GrowthProjectionChart = dynamic(() => import('@/components/report/premium').then(mod => mod.GrowthProjectionChart), { ssr: false, loading: () => <ChartSkeleton height={300} /> });
import {
  canShowStudentDerivedNarrative,
  getDisplayableDerivedGuidance,
  getStudentGrowthTruthNotice,
} from '@/lib/teacher-verified-analysis';
import { exportReportToPdf } from '@/lib/pdf-export';
import { FormatAIText } from '@/lib/format-ai-text';
import { stripTeacherOnlyAnalysisFields } from '@/lib/report-utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import type { Report, Student, AnalysisData, ReportType, SelfAnalysisReport } from '@/types';

interface ReportWithStudent extends Report {
  students: Student;
}

// 리포트 타입별 설정
const REPORT_TYPE_CONFIG: Record<ReportType, { name: string; color: string; bgColor: string }> = {
  level_test: { name: '레벨 테스트', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  test: { name: '시험 분석', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  weekly: { name: '주간', color: 'text-green-600', bgColor: 'bg-green-100' },
  monthly: { name: '월간', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  semi_annual: { name: '반기', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  annual: { name: '연간', color: 'text-red-600', bgColor: 'bg-red-100' },
  consolidated: { name: '종합', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  self_analysis: { name: '내 풀이 분석', color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
};

const STUDENT_NOTICE_TONE_CLASS = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  neutral: 'border-slate-200 bg-slate-50 text-slate-900',
} as const;

const STUDENT_NOTICE_BADGE_CLASS = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  neutral: 'bg-slate-100 text-slate-700',
} as const;

export default function StudentReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    checkAuthAndLoadReport();
  }, [reportId]);

  const checkAuthAndLoadReport = async () => {
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

    if (!userData || userData.role !== 'student') {
      router.push('/');
      return;
    }

    // 학생 정보 조회
    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', authUser.id)
      .single();

    if (!studentData) {
      router.push('/student');
      return;
    }

    // 리포트 로드 (본인 리포트만)
    const { data: reportData, error } = await supabase
      .from('reports')
      .select(`*, students (*)`)
      .eq('id', reportId)
      .eq('student_id', studentData.id)
      .single();

    if (error || !reportData) {
      addToast('리포트를 찾을 수 없거나 접근 권한이 없습니다.', 'error');
      router.push('/student');
      return;
    }

    // 교사 전용 내부 필드(qaReport 등)를 제거한 뒤 상태에 저장(학생 노출 차단)
    setReport(stripTeacherOnlyAnalysisFields(reportData));
    setLoading(false);
  };

  const handleExportPdf = async () => {
    if (!report) return;

    setExporting(true);
    try {
      const success = await exportReportToPdf(
        'report-content',
        report.students?.name || '학생',
        report.test_name || '리포트',
        report.test_date || new Date().toISOString().split('T')[0]
      );

      if (!success) {
        addToast('PDF 내보내기에 실패했습니다. 인쇄 버튼 또는 브라우저 저장 기능을 다시 시도해주세요.', 'error');
      } else {
        addToast('PDF가 저장되었습니다.', 'success');
      }
    } catch (error) {
      console.error('PDF 내보내기 오류:', error);
      addToast('PDF 내보내기 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="리포트 로딩 중..." />;
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-bold text-gray-900">리포트를 찾을 수 없습니다</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            학생 계정 연결이 바뀌었거나 리포트 접근 권한이 달라졌을 수 있습니다. 학생 대시보드에서 내 리포트 목록을 다시 확인해주세요.
          </p>
          <Link href="/student" className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const reportType = report.report_type as ReportType;
  const isSelfAnalysis = reportType === 'self_analysis';
  const analysisData = isSelfAnalysis ? null : report.analysis_data as AnalysisData;
  const displayableGuidance = getDisplayableDerivedGuidance(analysisData);
  const canShowMacroNarrative = canShowStudentDerivedNarrative(analysisData);
  const growthTruthNotice = getStudentGrowthTruthNotice(analysisData, reportType);
  const selfAnalysis = isSelfAnalysis ? report.analysis_data as SelfAnalysisReport : null;
  const config = REPORT_TYPE_CONFIG[reportType];

  // 프리미엄 컴포넌트용 데이터
  const isTestAnalysis = reportType === 'test' || reportType === 'consolidated';
  const confidenceDataCount = [
    report.students?.meta_profile?.baseline?.assessmentDate,
    ...(report.students?.meta_profile?.errorSignature?.signaturePatterns || []),
    ...(report.students?.meta_profile?.legacySignals || []),
    ...(analysisData?.detailedAnalysis || []),
    ...displayableGuidance.growthPredictions,
  ].filter(Boolean).length;
  const evidenceSources = [
    {
      type: 'ai_analysis' as const,
      label: 'AI 분석 결과',
      date: report.test_date || report.created_at,
      description: report.test_name || config?.name || '리포트',
    },
    ...(analysisData?.detailedAnalysis?.length
      ? [{
          type: 'test_paper' as const,
          label: '문항별 분석',
          date: report.test_date || undefined,
          description: `${analysisData.detailedAnalysis.length}개 문항 근거`,
        }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast toasts={toasts} onRemove={removeToast} />
      {/* 헤더 */}
      <header className="bg-white shadow-sm print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/student"
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                대시보드
              </Link>
              <span className={`text-xs px-2 py-1 rounded-full ${config?.bgColor} ${config?.color}`}>
                {config?.name || report.report_type}
              </span>
            </div>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  내보내는 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  PDF 저장
                </>
              )}
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
          <p className="text-xs text-gray-500">
            PDF 저장이 되지 않으면 브라우저의 인쇄 또는 저장 기능을 이용하거나 선생님에게 리포트 확인을 요청해주세요.
          </p>
        </div>
      </header>

      {/* 리포트 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div id="report-content" className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* 리포트 제목 */}
          <div className="p-6 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{report.test_name || '리포트'}</h1>
                <p className="text-gray-600 mt-1">{report.test_date} · {report.students?.name}</p>
              </div>
              <span className={`text-sm px-3 py-1 rounded-full ${config?.bgColor} ${config?.color} font-medium`}>
                {config?.name || report.report_type}
              </span>
            </div>
          </div>

          {/* 메타 헤더 */}
          <MetaHeader
            metaProfile={report.students?.meta_profile}
            studentName={report.students?.name || '학생'}
            studentGrade={report.students?.grade || 1}
            compact
          />

          {growthTruthNotice && (
            <div className="px-6 pb-6 mt-4">
              <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all ${
                growthTruthNotice.tone === 'warning'
                  ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/30'
                  : growthTruthNotice.tone === 'success'
                  ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/30'
                  : 'border-slate-300 bg-gradient-to-br from-slate-50 to-gray-50/30'
              }`}>
                <div className={`absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full blur-2xl opacity-50 pointer-events-none mix-blend-multiply ${
                  growthTruthNotice.tone === 'warning' ? 'bg-amber-300' : growthTruthNotice.tone === 'success' ? 'bg-emerald-300' : 'bg-slate-300'
                }`} />
                <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 mt-1 flex items-center justify-center w-8 h-8 rounded-full shadow-sm ${
                      growthTruthNotice.tone === 'warning' ? 'bg-amber-200 text-amber-700' : growthTruthNotice.tone === 'success' ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {growthTruthNotice.tone === 'warning' ? '⚠️' : growthTruthNotice.tone === 'success' ? '✨' : 'ℹ️'}
                    </div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${STUDENT_NOTICE_BADGE_CLASS[growthTruthNotice.tone]}`}>
                        {growthTruthNotice.label}
                      </span>
                      <h2 className={`mt-3 text-base font-bold ${
                        growthTruthNotice.tone === 'warning' ? 'text-amber-900' : growthTruthNotice.tone === 'success' ? 'text-emerald-900' : 'text-slate-900'
                      }`}>{growthTruthNotice.headline}</h2>
                      <p className={`mt-2 text-sm leading-relaxed ${
                        growthTruthNotice.tone === 'warning' ? 'text-amber-800' : growthTruthNotice.tone === 'success' ? 'text-emerald-800' : 'text-slate-800'
                      }`}>{growthTruthNotice.description}</p>
                    </div>
                  </div>
                  {growthTruthNotice.guidanceState === 'withheld' && (
                    <span className="shrink-0 rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold shadow-sm text-slate-700 border border-slate-200 animate-pulse">
                      선생님 확인 중 ⏳
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 프리미엄: 분석 신뢰도 + 근거 배지 */}
          {isTestAnalysis && (
            <div className="px-6 pb-4">
              <div className="grid md:grid-cols-2 gap-4">
                <ConfidenceBadge
                  level={getConfidenceLevel(confidenceDataCount)}
                  dataCount={confidenceDataCount}
                  dataPeriod={report.test_date || report.created_at?.slice(0, 10)}
                  description="누적 데이터와 선생님 피드백을 반영한 분석 신뢰도예요."
                />
                <EvidenceBadge sources={evidenceSources} />
              </div>
            </div>
          )}

          {/* 분석 결과 요약 */}
          {analysisData?.macroAnalysis && canShowMacroNarrative && (
            <div className="p-6 border-b">
              {/* 핵심 메시지 */}
              {analysisData.macroAnalysis.analysisMessage && (
                <div className="mb-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div>
                      <h3 className="font-bold text-indigo-800 mb-1">핵심 메시지</h3>
                      <FormatAIText text={analysisData.macroAnalysis.analysisMessage} className="text-indigo-700 text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* 강점 / 약점 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisData.macroAnalysis.strengths && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                      <span>💪</span> 잘하는 점
                    </h4>
                    <FormatAIText text={analysisData.macroAnalysis.strengths} className="text-green-700 text-sm" />
                  </div>
                )}
                {analysisData.macroAnalysis.weaknesses && (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                      <span>🎯</span> 더 연습하면 좋을 점
                    </h4>
                    <FormatAIText text={analysisData.macroAnalysis.weaknesses} className="text-orange-700 text-sm" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 프리미엄: 5관점 분석 */}
          {analysisData?.macroAnalysis && canShowMacroNarrative && (
            <div className="px-6 pb-4">
              <FivePerspectiveAnalysis
                perspectives={[
                  {
                    type: 'thinking_start',
                    title: '사고의 출발점',
                    summary: analysisData.macroAnalysis.strengths || '문제 접근 방식을 분석 중입니다.',
                    status: 'good',
                  },
                  {
                    type: 'solving_process',
                    title: '풀이 진행 과정',
                    summary: analysisData.macroAnalysis.summary || '풀이 과정을 분석 중입니다.',
                    status: analysisData.macroAnalysis.errorPattern ? 'warning' : 'good',
                  },
                  {
                    type: 'calculation_pattern',
                    title: '계산 및 실수 패턴',
                    summary: analysisData.macroAnalysis.errorPattern || '계산 패턴을 분석 중입니다.',
                    status: 'warning',
                  },
                  {
                    type: 'problem_interpretation',
                    title: '문제 해석 능력',
                    summary: analysisData.macroAnalysis.weaknesses || '문제 해석 능력을 분석 중입니다.',
                    status: analysisData.macroAnalysis.weaknesses ? 'warning' : 'good',
                  },
                  {
                    type: 'solving_habit',
                    title: '풀이 습관 관찰',
                    summary: displayableGuidance.learningHabits.length > 0
                      ? displayableGuidance.learningHabits[0].description +
                        (displayableGuidance.learningHabits.length > 1 ? ` 외 ${displayableGuidance.learningHabits.length - 1}건` : '')
                      : '풀이 습관을 분석 중입니다.',
                    status: displayableGuidance.learningHabits.some(h => h.type === 'bad') ? 'warning' : 'good',
                  },
                ]}
                studentName={report.students?.name}
                testName={report.test_name || undefined}
              />
            </div>
          )}

          {/* 점수 정보 */}
          {report.total_score != null && (
            <div className="p-6 border-b">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="text-4xl font-bold text-indigo-600">{report.total_score}</div>
                  <div className="text-sm text-gray-500">점수</div>
                </div>
                {report.max_score && (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-400">{report.max_score}</div>
                    <div className="text-sm text-gray-500">만점</div>
                  </div>
                )}
                {report.rank && report.total_students && (
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600">{report.rank}/{report.total_students}</div>
                    <div className="text-sm text-gray-500">등수</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 개선 전략 */}
          {displayableGuidance.actionablePrescription.length > 0 && (
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📝</span> 이렇게 공부해보세요!
              </h3>
              <div className="space-y-4">
                {displayableGuidance.actionablePrescription.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        item.priority === 1 ? 'bg-red-500' : item.priority === 2 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-gray-800">{item.title}</h4>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2">
                      {item.whatToDo && (
                        <div className="flex gap-2">
                          <span className="text-indigo-600 font-medium whitespace-nowrap">무엇을:</span>
                          <span className="text-gray-700">{item.whatToDo}</span>
                        </div>
                      )}
                      {item.howMuch && (
                        <div className="flex gap-2">
                          <span className="text-indigo-600 font-medium whitespace-nowrap">얼마나:</span>
                          <span className="text-gray-700">{item.howMuch}</span>
                        </div>
                      )}
                      {item.howTo && (
                        <div className="flex gap-2">
                          <span className="text-indigo-600 font-medium whitespace-nowrap">어떻게:</span>
                          <span className="text-gray-700">{item.howTo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 프리미엄: 문항별 분석 아코디언 */}
          {analysisData?.detailedAnalysis && analysisData.detailedAnalysis.length > 0 && (
            <div className="px-6 pb-4">
              <ProblemAnalysisSection items={analysisData.detailedAnalysis} />
            </div>
          )}

          {/* 프리미엄: 성장 예측 차트 */}
          {displayableGuidance.growthPredictions.length > 0 && (
            <div className="px-6 pb-4">
              <GrowthProjectionChart
                historicalData={[
                  { date: report.test_date || '현재', score: report.total_score ?? 0 },
                ]}
                projectedData={displayableGuidance.growthPredictions.map(p => ({
                  date: p.timeframe,
                  score: p.predictedScore,
                  label: `${p.timeframe} 예상`,
                  isProjection: true,
                }))}
                targetScore={displayableGuidance.growthPredictions[displayableGuidance.growthPredictions.length - 1]?.predictedScore || 90}
                studentName={report.students?.name}
              />
            </div>
          )}

          {/* 미래 비전 */}
          {displayableGuidance.futureVision && (
            <VisionFooter
              legacyVision={displayableGuidance.futureVision}
              studentName={report.students?.name || '학생'}
            />
          )}

          {/* ===== 내 풀이 분석 결과 ===== */}
          {selfAnalysis && (
            <>
              {/* 전체 요약 */}
              <div className="p-6 border-b">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">✨ 분석 결과</h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selfAnalysis.comparisonWithHistory?.overallTrend === 'improving'
                      ? 'bg-green-100 text-green-700'
                      : selfAnalysis.comparisonWithHistory?.overallTrend === 'stable'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {selfAnalysis.comparisonWithHistory?.overallTrend === 'improving' ? '📈 향상 중' :
                     selfAnalysis.comparisonWithHistory?.overallTrend === 'stable' ? '➡️ 안정적' : '📌 집중 필요'}
                  </span>
                </div>
                {selfAnalysis.milestone && (
                  <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex items-center gap-2">
                    <span className="text-xl">🏅</span>
                    <p className="text-yellow-800 font-medium text-sm">{selfAnalysis.milestone}</p>
                  </div>
                )}
                <div className="p-4 bg-emerald-50 rounded-lg mb-3">
                  <p className="text-emerald-800 font-medium">{selfAnalysis.oneLineSummary}</p>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{selfAnalysis.overallAssessment}</p>
              </div>

              {/* 잘한 점 & 개선할 점 */}
              <div className="p-6 border-b grid md:grid-cols-2 gap-4">
                {selfAnalysis.strengthsObserved && selfAnalysis.strengthsObserved.length > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2"><span>💪</span> 잘한 점</h4>
                    <ul className="space-y-1">
                      {selfAnalysis.strengthsObserved.map((s, i) => (
                        <li key={i} className="text-sm text-green-700 flex items-start gap-1"><span>✓</span><span>{s}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {selfAnalysis.areasToImprove && selfAnalysis.areasToImprove.length > 0 && (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2"><span>🎯</span> 더 연습해요</h4>
                    <ul className="space-y-1">
                      {selfAnalysis.areasToImprove.map((a, i) => (
                        <li key={i} className="text-sm text-orange-700 flex items-start gap-1"><span>→</span><span>{a}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 이전과 비교 */}
              {selfAnalysis.comparisonWithHistory && (
                <div className="p-6 border-b">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">📊 이전과 비교해봐요</h3>
                  <p className="text-gray-600 text-sm mb-4">{selfAnalysis.comparisonWithHistory.trendSummary}</p>
                  <div className="grid md:grid-cols-3 gap-4">
                    {selfAnalysis.comparisonWithHistory.improvements && selfAnalysis.comparisonWithHistory.improvements.length > 0 && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <h4 className="text-sm font-bold text-green-700 mb-2">✅ 나아진 점</h4>
                        <ul className="space-y-1">{selfAnalysis.comparisonWithHistory.improvements.map((item, i) => <li key={i} className="text-xs text-gray-600">• {item}</li>)}</ul>
                      </div>
                    )}
                    {selfAnalysis.comparisonWithHistory.newObservations && selfAnalysis.comparisonWithHistory.newObservations.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-bold text-blue-700 mb-2">🔍 새로 발견</h4>
                        <ul className="space-y-1">{selfAnalysis.comparisonWithHistory.newObservations.map((item, i) => <li key={i} className="text-xs text-gray-600">• {item}</li>)}</ul>
                      </div>
                    )}
                    {selfAnalysis.comparisonWithHistory.persistentIssues && selfAnalysis.comparisonWithHistory.persistentIssues.length > 0 && (
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <h4 className="text-sm font-bold text-orange-700 mb-2">⚠️ 계속 주의</h4>
                        <ul className="space-y-1">{selfAnalysis.comparisonWithHistory.persistentIssues.map((item, i) => <li key={i} className="text-xs text-gray-600">• {item}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 다음 학습 계획 */}
              {selfAnalysis.nextSteps && (
                <div className="p-6 border-b">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">📝 이렇게 공부해봐요!</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {selfAnalysis.nextSteps.immediate && selfAnalysis.nextSteps.immediate.length > 0 && (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-bold text-gray-700 mb-2">오늘 / 내일</h4>
                        <ul className="space-y-1">{selfAnalysis.nextSteps.immediate.map((s, i) => <li key={i} className="text-sm text-gray-600">• {s}</li>)}</ul>
                      </div>
                    )}
                    {selfAnalysis.nextSteps.thisWeek && selfAnalysis.nextSteps.thisWeek.length > 0 && (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-bold text-gray-700 mb-2">이번 주</h4>
                        <ul className="space-y-1">{selfAnalysis.nextSteps.thisWeek.map((s, i) => <li key={i} className="text-sm text-gray-600">• {s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                  {selfAnalysis.nextSteps.studyTip && (
                    <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                      <p className="text-sm text-indigo-700">💡 <strong>공부 꿀팁:</strong> {selfAnalysis.nextSteps.studyTip}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 응원 메시지 */}
          <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-center">
            <div className="text-4xl mb-4">🌟</div>
            <h3 className="text-xl font-bold mb-2">화이팅!</h3>
            <p className="text-indigo-100">
              {selfAnalysis?.encouragement || displayableGuidance.futureVision?.encouragement || '꾸준히 노력하면 분명 좋은 결과가 있을 거예요!'}
            </p>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-500 text-sm print:hidden">
        <p>&copy; {new Date().getFullYear()} 수학 학습 플랫폼. All rights reserved.</p>
      </footer>
    </div>
  );
}
