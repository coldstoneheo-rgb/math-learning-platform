'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  MetaHeader,
  VisionFooter,
  GrowthTrajectoryChart,
  ErrorPatternTrend,
  GrowthLoopIndicator,
  BaselineReferenceCard,
  VisionDistanceFooter,
  MomentumGauge,
  HabitTrendChart,
  ReportComments,
} from '@/components/report';
import {
  ReportGrowthHero,
  FivePerspectiveAnalysis,
  HomeActionCard,
  WeaknessJourneyMap,
  GrowthProjectionChart,
  ConfidenceBadge,
  getConfidenceLevel,
  EvidenceBadge,
  ErrorSignatureTracker,
  ReportPDFExporter,
} from '@/components/report/premium';
import {
  calculateHabitScore,
  convertMomentumStatus,
  generateWeeklyComparison,
} from '@/lib/report-utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Toast from '@/components/common/Toast';
import { useToast } from '@/hooks/useToast';
import { FEATURE_FLAGS, isFeatureEnabledForUser } from '@/lib/feature-flags';
import type { User, Report, Student, AnalysisData, LevelTestAnalysis, WeeklyReportAnalysis, MonthlyReportAnalysis, SemiAnnualReportAnalysis, AnnualReportAnalysis, SelfAnalysisReport } from '@/types';

interface ReportWithStudent extends Report {
  students: Student;
}

type VerifiedGuidanceStatus = NonNullable<AnalysisData['teacherVerified']>['derivedGuidanceStatus'];

function getTeacherVerificationStatusInfo(status?: VerifiedGuidanceStatus) {
  switch (status) {
    case 'regenerated_from_teacher_verified':
      return {
        label: '교사 확정값 기반 분석',
        description: '교사가 확인한 채점과 문항 판정을 기준으로 약점, 처방, 성장 비전을 다시 생성했습니다.',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      };
    case 'excluded_after_teacher_adjustment':
      return {
        label: '교사 확정 완료, 파생 처방 제외',
        description: '점수와 문항 판정은 교사가 확정한 값으로 저장되었습니다. 확정값 기반 처방 재생성은 실패하여 AI 초안 처방을 성장 데이터에서 제외했습니다.',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
      };
    case 'ai_draft_retained':
      return {
        label: 'AI 초안 기반, 교사 확인 완료',
        description: '교사 보정이 없어 AI 분석 초안을 교사가 확인한 최종 리포트로 저장했습니다.',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-800',
      };
    default:
      return null;
  }
}

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const reportId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [report, setReport] = useState<ReportWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingNotification, setSendingNotification] = useState(false);
  const reportContentRef = useRef<HTMLDivElement>(null);
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

    if (!userData || userData.role !== 'teacher') {
      router.push('/');
      return;
    }

    setUser(userData);

    // 리포트 로드
    const { data: reportData, error } = await supabase
      .from('reports')
      .select(`*, students (*)`)
      .eq('id', reportId)
      .single();

    if (error || !reportData) {
      addToast('리포트를 찾을 수 없습니다.', 'error');
      router.push('/teacher/reports');
      return;
    }

    setReport(reportData);
    setLoading(false);
  };

  const getGradeLabel = (grade: number): string => {
    if (grade <= 6) return `초${grade}`;
    if (grade <= 9) return `중${grade - 6}`;
    return `고${grade - 9}`;
  };

  // Phase 5: 학부모 알림 발송
  const handleSendNotification = async () => {
    if (!report || !report.students || sendingNotification) return;

    const supabase = createClient();
    const parentId = report.students.parent_id;
    if (!parentId) {
      addToast('이 학생에 연결된 학부모 정보가 없습니다.', 'error');
      return;
    }

    const { data: parentData } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', parentId)
      .single();

    if (!parentData?.email) {
      addToast('학부모 이메일 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    setSendingNotification(true);
    try {
      const studentName = report.students.name;
      const title = `📊 ${studentName} 학생의 새 리포트가 도착했습니다`;
      const message = `${studentName} 학생의 "${report.test_name || '리포트'}" 분석이 완료되었습니다. 리포트를 확인하세요.`;

      const responses = await Promise.all([
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientUserId: parentId,
            title,
            message,
            channel: 'in_app',
            relatedResourceType: 'report',
            relatedResourceId: reportId,
          }),
        }),
        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientUserId: parentId,
            title,
            message,
            channel: 'email',
            relatedResourceType: 'report',
            relatedResourceId: reportId,
            emailData: {
              recipientEmail: parentData.email,
              recipientName: parentData.name || '학부모',
              studentName,
              reportId: parseInt(reportId, 10),
            },
          }),
        }),
      ]);

      const results = await Promise.all(
        responses.map(async (response) => ({
          ok: response.ok,
          body: await response.json().catch(() => ({} as { error?: string })),
        }))
      );
      const failed = results.filter(result => !result.ok || result.body?.error);

      if (failed.length > 0) {
        addToast(`알림 ${results.length - failed.length}건 성공, ${failed.length}건 실패했습니다.`, 'error');
        return;
      }

      addToast(`${parentData.name || '학부모'}님께 인앱/이메일 알림을 발송했습니다.`, 'success');
    } catch (error) {
      console.error('알림 발송 오류:', error);
      addToast('알림 발송 중 오류가 발생했습니다.', 'error');
    } finally {
      setSendingNotification(false);
    }
  };

  // report.analysis_data는 다양한 리포트 타입을 지원
  const analysis = (report?.analysis_data as AnalysisData) || null;
  const levelTestAnalysis = report?.report_type === 'level_test'
    ? (report?.analysis_data as LevelTestAnalysis)
    : null;
  const weeklyAnalysis = (() => {
    if (report?.report_type !== 'weekly') return null;
    const raw = report?.analysis_data as unknown as Record<string, unknown>;
    return (raw?.aiAnalysis as WeeklyReportAnalysis) ?? (raw as unknown as WeeklyReportAnalysis);
  })();
  const monthlyAnalysis = report?.report_type === 'monthly'
    ? (report?.analysis_data as MonthlyReportAnalysis)
    : null;
  const semiAnnualAnalysis = report?.report_type === 'semi_annual'
    ? (report?.analysis_data as SemiAnnualReportAnalysis)
    : null;
  const annualAnalysis = report?.report_type === 'annual'
    ? (report?.analysis_data as AnnualReportAnalysis)
    : null;
  const notificationsEnabled = user
    ? isFeatureEnabledForUser(FEATURE_FLAGS.PARENT_NOTIFICATIONS, user.id, 'teacher')
    : false;
  const verificationStatusInfo = getTeacherVerificationStatusInfo(
    analysis?.teacherVerified?.derivedGuidanceStatus
  );

  const selfAnalysis = report?.report_type === 'self_analysis'
    ? (report?.analysis_data as SelfAnalysisReport)
    : null;

  const confidenceDataCount = [
    report?.students?.meta_profile?.baseline?.assessmentDate,
    ...(report?.students?.meta_profile?.errorSignature?.signaturePatterns || []),
    ...(report?.students?.meta_profile?.legacySignals || []),
    ...(analysis?.detailedAnalysis || []),
    ...(analysis?.growthPredictions || []),
  ].filter(Boolean).length;

  const evidenceSources = [
    {
      type: 'ai_analysis' as const,
      label: 'AI 분석 결과',
      date: report?.test_date || report?.created_at,
      description: report?.test_name || '리포트 분석 데이터',
    },
    ...(analysis?.detailedAnalysis?.length
      ? [{
          type: 'test_paper' as const,
          label: '문항별 분석',
          date: report?.test_date || undefined,
          description: `${analysis.detailedAnalysis.length}개 문항 근거`,
        }]
      : []),
    ...(report?.students?.meta_profile?.legacySignals?.length
      ? [{
          type: 'teacher_observation' as const,
          label: '레거시 시그널',
          date: report.students.meta_profile.legacySignals.at(-1)?.date,
          description: `${report.students.meta_profile.legacySignals.length}건 누적`,
        }]
      : []),
  ];

  const errorSignatures = (report?.students?.meta_profile?.errorSignature?.signaturePatterns || []).map((signature, index) => ({
    id: `meta-signature-${index}`,
    signature,
    category: 'concept' as const,
    status: index === 0 ? 'recurring' as const : 'active' as const,
    occurrenceCount: Math.max(1, report?.students?.meta_profile?.legacySignals?.filter(signal => signal.insight.includes(signature)).length || 1),
    lastOccurrence: report?.students?.meta_profile?.lastUpdated,
    firstDetected: report?.students?.meta_profile?.baseline?.assessmentDate,
    frequency: Math.max(20, Math.min(90, 70 - index * 10)),
    trend: 'stable' as const,
    details: '학생 메타프로필에 누적된 오류 서명입니다.',
    resolution: analysis?.actionablePrescription?.[index]?.howTo,
  }));

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!report || (!analysis && !levelTestAnalysis)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">리포트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
    <Toast toasts={toasts} onRemove={removeToast} />
    {/* 헤더 */}
    <header className="bg-white shadow-sm print:hidden">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/teacher" className="text-indigo-600 hover:text-indigo-700 font-medium">🏠 대시보드</Link>
          <span className="text-gray-300">|</span>
          <Link href="/teacher/reports" className="text-gray-500 hover:text-gray-700">← 목록</Link>
          <h1 className="text-xl font-bold text-gray-900">리포트 상세</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Phase 5: 학부모 알림 발송 버튼 */}
          {notificationsEnabled && report?.students?.parent_id && (
            <button
              onClick={handleSendNotification}
              disabled={sendingNotification}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {sendingNotification ? (
                <><span className="animate-spin text-sm">⏳</span> 전송 중...</>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  학부모 알림 발송
                </>
              )}
            </button>
          )}
          <ReportPDFExporter
            targetRef={reportContentRef}
            studentName={report.students?.name || '학생'}
            reportType={report.test_name || '리포트'}
            reportDate={report.test_date || report.created_at}
            compact
            onExportComplete={(success) => addToast(success ? 'PDF가 저장되었습니다.' : 'PDF 내보내기에 실패했습니다.', success ? 'success' : 'error')}
          />
          <button
            onClick={() => window.print()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            🖨️ 인쇄
          </button>
        </div>
      </div>
    </header>


      <main id="report-content" ref={reportContentRef} data-pdf-target className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 학생 메타프로필 헤더 */}
        {report.students && (
          <MetaHeader
            metaProfile={report.students.meta_profile}
            studentName={report.students.name}
            studentGrade={report.students.grade}
          />
        )}

        {/* 🌟 프리미엄: 성장 한 줄 요약 Hero */}
        <div className="mb-6">
          <ReportGrowthHero
            reportType={report.report_type as 'level_test' | 'test' | 'weekly' | 'monthly' | 'semi_annual' | 'annual' | 'consolidated'}
            studentName={report.students?.name || '학생'}
            reportDate={report.test_date || report.created_at}
            headline={
              analysis?.macroAnalysis?.oneLineSummary ||
              levelTestAnalysis?.initialBaseline?.overallLevel ||
              monthlyAnalysis?.monthlyGrowthSummary?.headline ||
              semiAnnualAnalysis?.growthSummaryBanner?.headline ||
              annualAnalysis?.growthNarrativeFinal?.headline ||
              '이번 리포트의 핵심 분석 결과입니다.'
            }
            subheadline={
              analysis?.macroAnalysis?.analysisMessage ||
              levelTestAnalysis?.parentBriefing ||
              monthlyAnalysis?.monthlyGrowthSummary?.keyAchievement ||
              undefined
            }
            currentScore={report.total_score ?? undefined}
            previousScore={undefined}
            targetScore={report.max_score ?? undefined}
            percentile={
              report.rank && report.total_students
                ? Math.round((1 - report.rank / report.total_students) * 100)
                : undefined
            }
            emotionType={
              (report.total_score ?? 0) >= (report.max_score ?? 100) * 0.9 ? 'celebrate' :
              (report.total_score ?? 0) >= (report.max_score ?? 100) * 0.7 ? 'encourage' :
              (report.total_score ?? 0) >= (report.max_score ?? 100) * 0.5 ? 'neutral' : 'alert'
            }
          />
        </div>

        {analysis?.teacherVerified && verificationStatusInfo && (
          <div className={`mb-6 rounded-xl border p-4 ${verificationStatusInfo.className}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold">{verificationStatusInfo.label}</p>
                <p className="mt-1 text-sm leading-relaxed">{verificationStatusInfo.description}</p>
                {analysis.teacherVerified.derivedGuidanceRegeneratedAt && (
                  <p className="mt-2 text-xs opacity-75">
                    재생성 시각: {new Date(analysis.teacherVerified.derivedGuidanceRegeneratedAt).toLocaleString('ko-KR')}
                  </p>
                )}
                {analysis.teacherVerified.derivedGuidanceError && (
                  <p className="mt-2 text-xs opacity-75">
                    재생성 실패 사유: {analysis.teacherVerified.derivedGuidanceError}
                  </p>
                )}
              </div>
              <div className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold">
                교사 확인 {analysis.teacherVerified.adjustedFields.length}개 항목
              </div>
            </div>
          </div>
        )}

        {/* Growth Loop 위치 표시 */}
        <GrowthLoopIndicator
          reportType={report.report_type as 'level_test' | 'test' | 'weekly' | 'monthly' | 'semi_annual' | 'annual' | 'consolidated'}
          baselineDate={report.students?.meta_profile?.baseline?.assessmentDate}
          hasBaseline={!!report.students?.meta_profile?.baseline?.assessmentDate || report.report_type === 'level_test'}
        />

        {/* Baseline 대비 현재 위치 (레벨 테스트 제외) */}
        {report.report_type !== 'level_test' && report.students && (
          <BaselineReferenceCard
            baselineScore={report.students?.meta_profile?.baseline?.initialLevel?.percentile
              ? Math.round(report.students.meta_profile.baseline.initialLevel.percentile)
              : undefined}
            currentScore={report.total_score ?? undefined}
            baselineDate={report.students?.meta_profile?.baseline?.assessmentDate}
            studentName={report.students.name}
          />
        )}

        {/* 헤더 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{report.test_name}</h2>
              <div className="mt-2 flex items-center gap-3 text-gray-600">
                <span className="font-medium">{report.students?.name}</span>
                <span>·</span>
                <span>{report.students && getGradeLabel(report.students.grade)}</span>
                <span>·</span>
                <span>{report.test_date}</span>
              </div>
            </div>
            <div className="text-right">
              {report.report_type === 'level_test' ? (
                <>
                  <div className="text-sm text-gray-500 mb-1">진단 점수</div>
                  <div className="text-4xl font-bold text-indigo-600">
                    {report.total_score ?? 0}
                    <span className="text-lg text-gray-400">/{report.max_score ?? 100}점</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    ({Math.round(((report.total_score ?? 0) / (report.max_score || 100)) * 100)}% 정답률)
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl font-bold text-indigo-600">
                    {report.total_score ?? '-'}
                    <span className="text-lg text-gray-400">/{report.max_score ?? '-'}</span>
                  </div>
                  {report.rank && report.total_students && (
                    <div className="text-sm text-gray-500 mt-1">
                      {report.total_students}명 중 {report.rank}등
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <ConfidenceBadge
            level={getConfidenceLevel(confidenceDataCount)}
            dataCount={confidenceDataCount}
            dataPeriod={report.test_date || report.created_at?.slice(0, 10)}
            description="리포트, 메타프로필, 누적 시그널을 함께 반영한 분석 신뢰도입니다."
          />
          <EvidenceBadge sources={evidenceSources} />
        </div>

        {errorSignatures.length > 0 && (
          <div className="mb-6">
            <ErrorSignatureTracker
              signatures={errorSignatures}
              studentName={report.students?.name}
              testName={report.test_name || undefined}
            />
          </div>
        )}

        {/* ===== 레벨 테스트 전용 뷰 ===== */}
        {report.report_type === 'level_test' && levelTestAnalysis && (
          <>
            {/* 학년 수준 평가 */}
            {levelTestAnalysis.gradeLevelAssessment && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 학년 수준 평가</h3>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">현재 학년</div>
                    <div className="text-2xl font-bold text-gray-700">
                      {getGradeLabel(levelTestAnalysis.gradeLevelAssessment.currentGrade)}
                    </div>
                  </div>
                  <div className="text-3xl">→</div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">평가된 수준</div>
                    <div className={`text-2xl font-bold ${
                      levelTestAnalysis.gradeLevelAssessment.gap >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {getGradeLabel(levelTestAnalysis.gradeLevelAssessment.assessedLevel)}
                      {levelTestAnalysis.gradeLevelAssessment.gap !== 0 && (
                        <span className="text-sm ml-1">
                          ({levelTestAnalysis.gradeLevelAssessment.gap > 0 ? '+' : ''}
                          {levelTestAnalysis.gradeLevelAssessment.gap}학년)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-gray-600">{levelTestAnalysis.gradeLevelAssessment.explanation}</p>
              </div>
            )}

            {/* 영역별 진단 */}
            {levelTestAnalysis.domainDiagnosis && levelTestAnalysis.domainDiagnosis.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 영역별 진단</h3>
                <div className="space-y-3">
                  {levelTestAnalysis.domainDiagnosis.map((domain, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{domain.domain}</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-indigo-600">
                            {domain.score}/{domain.maxScore}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            ({domain.gradeEquivalent})
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${domain.percentile}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-gray-600">{domain.diagnosis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 선수학습 결손 */}
            {levelTestAnalysis.prerequisiteGaps && levelTestAnalysis.prerequisiteGaps.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 선수학습 결손</h3>
                <div className="space-y-3">
                  {levelTestAnalysis.prerequisiteGaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg ${
                        gap.priority === 'critical' ? 'bg-red-50 border border-red-200' :
                        gap.priority === 'important' ? 'bg-yellow-50 border border-yellow-200' :
                        'bg-blue-50 border border-blue-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded font-medium ${
                          gap.priority === 'critical' ? 'bg-red-100 text-red-700' :
                          gap.priority === 'important' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {gap.priority === 'critical' ? '긴급' : gap.priority === 'important' ? '중요' : '보완'}
                        </span>
                        <span className="font-medium">{gap.concept}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        기대 수준: {gap.expectedLevel} → 실제 수준: {gap.actualLevel}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">💡 {gap.remedyPlan}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 학습 성향 */}
            {levelTestAnalysis.learningStyleDiagnosis && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 학습 성향</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`px-4 py-2 rounded-lg font-medium ${
                    levelTestAnalysis.learningStyleDiagnosis.style === 'visual' ? 'bg-purple-100 text-purple-700' :
                    levelTestAnalysis.learningStyleDiagnosis.style === 'verbal' ? 'bg-blue-100 text-blue-700' :
                    levelTestAnalysis.learningStyleDiagnosis.style === 'logical' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {levelTestAnalysis.learningStyleDiagnosis.style === 'visual' ? '👁️ 시각형' :
                     levelTestAnalysis.learningStyleDiagnosis.style === 'verbal' ? '💬 언어형' :
                     levelTestAnalysis.learningStyleDiagnosis.style === 'logical' ? '🧮 논리형' : '🔀 복합형'}
                  </div>
                  <span className="text-gray-500">
                    신뢰도: {levelTestAnalysis.learningStyleDiagnosis.confidence}%
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-700 mb-2">특성</h4>
                    <ul className="text-sm text-gray-600 list-disc list-inside">
                      {levelTestAnalysis.learningStyleDiagnosis.characteristics?.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <h4 className="font-medium text-indigo-700 mb-2">권장 학습법</h4>
                    <ul className="text-sm text-indigo-600 list-disc list-inside">
                      {levelTestAnalysis.learningStyleDiagnosis.recommendations?.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 초기 Baseline */}
            {levelTestAnalysis.initialBaseline && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Baseline 설정</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">💪 강점</h4>
                    <p className="text-green-700 text-sm">{levelTestAnalysis.initialBaseline.strengths}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">⚠️ 약점</h4>
                    <p className="text-red-700 text-sm">{levelTestAnalysis.initialBaseline.weaknesses}</p>
                  </div>
                </div>
                {levelTestAnalysis.initialBaseline.errorPatterns && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">🔍 오류 패턴</h4>
                    <p className="text-yellow-700 text-sm">{levelTestAnalysis.initialBaseline.errorPatterns}</p>
                  </div>
                )}
                {levelTestAnalysis.initialBaseline.learningPotential && (
                  <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                    <h4 className="font-medium text-indigo-800 mb-2">✨ 학습 잠재력</h4>
                    <p className="text-indigo-700 text-sm">{levelTestAnalysis.initialBaseline.learningPotential}</p>
                  </div>
                )}
              </div>
            )}

            {/* 커리큘럼 제안 */}
            {levelTestAnalysis.suggestedCurriculum && levelTestAnalysis.suggestedCurriculum.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 맞춤 커리큘럼</h3>
                <div className="space-y-4">
                  {levelTestAnalysis.suggestedCurriculum.map((phase, idx) => (
                    <div key={idx} className="border-l-4 border-indigo-500 pl-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-indigo-600">{phase.phase}</span>
                        <span className="text-sm text-gray-500">({phase.duration})</span>
                      </div>
                      <p className="text-gray-700 font-medium">{phase.focus}</p>
                      <ul className="mt-1 text-sm text-gray-600">
                        {phase.goals?.map((goal, i) => (
                          <li key={i}>• {goal}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 부모님 브리핑 */}
            {levelTestAnalysis.parentBriefing && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">👨‍👩‍👧 학부모님께 전달할 내용</h3>
                <p className="leading-relaxed">{levelTestAnalysis.parentBriefing}</p>
              </div>
            )}

            {/* 목표까지의 거리 (Vision Distance) */}
            {report.students && (
              <VisionDistanceFooter
                currentScore={report.total_score ?? undefined}
                targetScore={90}
                studentName={report.students.name}
                reportType="level_test"
              />
            )}
          </>
        )}

        {/* ===== 일반 시험 분석 뷰 (test 타입만) ===== */}
        {report.report_type === 'test' && analysis && (
        <>
        {/* 종합 분석 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 종합 분석</h3>

          {analysis.macroAnalysis?.oneLineSummary && (
            <div className="mb-4 p-4 bg-indigo-50 rounded-lg">
              <p className="text-indigo-800 font-medium">{analysis.macroAnalysis.oneLineSummary}</p>
            </div>
          )}

          <p className="text-gray-700 leading-relaxed mb-4">
            {analysis.macroAnalysis?.summary}
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {analysis.macroAnalysis?.strengths && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">💪 강점</h4>
                <p className="text-green-700 text-sm">{analysis.macroAnalysis.strengths}</p>
              </div>
            )}
            {analysis.macroAnalysis?.weaknesses && (
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">⚠️ 약점</h4>
                <p className="text-red-700 text-sm">{analysis.macroAnalysis.weaknesses}</p>
              </div>
            )}
          </div>

          {analysis.macroAnalysis?.errorPattern && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">🔍 오류 패턴</h4>
              <p className="text-yellow-700 text-sm">{analysis.macroAnalysis.errorPattern}</p>
            </div>
          )}
        </div>

        {/* 수학 역량 (5축) */}
        {analysis.macroAnalysis?.mathCapability && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 수학 역량</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
              {[
                { key: 'calculationSpeed', label: '계산 속도' },
                { key: 'calculationAccuracy', label: '계산 정확도' },
                { key: 'applicationAbility', label: '응용력' },
                { key: 'logic', label: '논리력' },
                { key: 'anxietyControl', label: '불안 통제' },
              ].map(({ key, label }) => {
                const value = analysis.macroAnalysis?.mathCapability?.[key as keyof typeof analysis.macroAnalysis.mathCapability] || 0;
                return (
                  <div key={key} className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 오류 패턴 추이 - 학생 메타 프로필에서 가져옴 */}
        {report.students?.meta_profile?.errorSignature && (
          <ErrorPatternTrend
            primaryErrorTypes={report.students.meta_profile.errorSignature.primaryErrorTypes}
            signaturePatterns={report.students.meta_profile.errorSignature.signaturePatterns}
            domainVulnerability={report.students.meta_profile.errorSignature.domainVulnerability}
            lastUpdated={report.students.meta_profile.errorSignature.lastUpdated}
          />
        )}

        {/* 메타인지 분석 */}
        {analysis.metaCognitionAnalysis && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 메타인지 분석</h3>

            {/* 전체 점수 및 발달 단계 */}
            <div className="flex items-center justify-between mb-6 p-4 bg-purple-50 rounded-lg">
              <div>
                <div className="text-sm text-purple-600 mb-1">전체 메타인지 점수</div>
                <div className="text-3xl font-bold text-purple-700">
                  {analysis.metaCognitionAnalysis.overallScore}
                  <span className="text-lg font-normal text-purple-400">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">발달 단계</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.metaCognitionAnalysis.developmentStage === 'expert' ? 'bg-green-100 text-green-700' :
                  analysis.metaCognitionAnalysis.developmentStage === 'proficient' ? 'bg-blue-100 text-blue-700' :
                  analysis.metaCognitionAnalysis.developmentStage === 'competent' ? 'bg-indigo-100 text-indigo-700' :
                  analysis.metaCognitionAnalysis.developmentStage === 'developing' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {analysis.metaCognitionAnalysis.developmentStage === 'expert' ? '전문가 수준' :
                   analysis.metaCognitionAnalysis.developmentStage === 'proficient' ? '숙달 단계' :
                   analysis.metaCognitionAnalysis.developmentStage === 'competent' ? '유능 단계' :
                   analysis.metaCognitionAnalysis.developmentStage === 'developing' ? '발달 중' :
                   '초기 단계'}
                </span>
              </div>
            </div>

            {/* 4가지 세부 영역 */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* 오답 인식 능력 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">🔍 오답 인식 능력</span>
                  <span className="text-lg font-bold text-indigo-600">
                    {analysis.metaCognitionAnalysis.errorRecognition?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.errorRecognition?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.errorRecognition?.analysis}</p>
                {analysis.metaCognitionAnalysis.errorRecognition?.evidence &&
                 analysis.metaCognitionAnalysis.errorRecognition.evidence.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">관찰된 증거:</div>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {analysis.metaCognitionAnalysis.errorRecognition.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 전략 선택 능력 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">🎯 전략 선택 능력</span>
                  <span className="text-lg font-bold text-green-600">
                    {analysis.metaCognitionAnalysis.strategySelection?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.strategySelection?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.strategySelection?.analysis}</p>
                <div className="mt-2 flex gap-4 text-xs">
                  <span className="text-green-600">
                    최적 풀이: {analysis.metaCognitionAnalysis.strategySelection?.optimalCount ?? 0}개
                  </span>
                  <span className="text-yellow-600">
                    차선 풀이: {analysis.metaCognitionAnalysis.strategySelection?.suboptimalCount ?? 0}개
                  </span>
                </div>
              </div>

              {/* 시간 관리 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">⏱️ 시간 관리</span>
                  <span className="text-lg font-bold text-orange-600">
                    {analysis.metaCognitionAnalysis.timeManagement?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-orange-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.timeManagement?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.timeManagement?.analysis}</p>
                <div className="mt-2 text-xs text-gray-500">
                  완료: {analysis.metaCognitionAnalysis.timeManagement?.completedProblems ?? 0}/{analysis.metaCognitionAnalysis.timeManagement?.totalProblems ?? 0}문제
                </div>
              </div>

              {/* 자기 점검 습관 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">✅ 자기 점검 습관</span>
                  <span className="text-lg font-bold text-purple-600">
                    {analysis.metaCognitionAnalysis.selfChecking?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${analysis.metaCognitionAnalysis.selfChecking?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.metaCognitionAnalysis.selfChecking?.analysis}</p>
                {analysis.metaCognitionAnalysis.selfChecking?.evidence &&
                 analysis.metaCognitionAnalysis.selfChecking.evidence.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">관찰된 증거:</div>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {analysis.metaCognitionAnalysis.selfChecking.evidence.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 개선 권장사항 */}
            {analysis.metaCognitionAnalysis.recommendations &&
             analysis.metaCognitionAnalysis.recommendations.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="font-medium text-blue-800 mb-2">💡 메타인지 향상 권장사항</div>
                <ul className="text-sm text-blue-700 space-y-1">
                  {analysis.metaCognitionAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 지구력 분석 */}
        {analysis.staminaAnalysis && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">💪 지구력 분석</h3>

            {/* 전체 점수 및 피로도 패턴 */}
            <div className="flex items-center justify-between mb-6 p-4 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm text-green-600 mb-1">전체 지구력 점수</div>
                <div className="text-3xl font-bold text-green-700">
                  {analysis.staminaAnalysis.overallScore}
                  <span className="text-lg font-normal text-green-400">/100</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">피로도 패턴</div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  analysis.staminaAnalysis.fatiguePattern?.type === 'consistent' ? 'bg-green-100 text-green-700' :
                  analysis.staminaAnalysis.fatiguePattern?.type === 'improving' ? 'bg-blue-100 text-blue-700' :
                  analysis.staminaAnalysis.fatiguePattern?.type === 'mid-dip' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {analysis.staminaAnalysis.fatiguePattern?.type === 'consistent' ? '일관 유지' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'improving' ? '후반 향상' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'early-fatigue' ? '초반 집중형' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'mid-dip' ? '중반 슬럼프' :
                   analysis.staminaAnalysis.fatiguePattern?.type === 'late-fatigue' ? '후반 피로' :
                   '분석 중'}
                </span>
              </div>
            </div>

            {/* 피로도 패턴 설명 */}
            {analysis.staminaAnalysis.fatiguePattern?.description && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">{analysis.staminaAnalysis.fatiguePattern.description}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  {analysis.staminaAnalysis.fatiguePattern.peakPerformanceRange && (
                    <span className="text-green-600">
                      🔥 최고 구간: {analysis.staminaAnalysis.fatiguePattern.peakPerformanceRange}
                    </span>
                  )}
                  {analysis.staminaAnalysis.fatiguePattern.lowPerformanceRange && (
                    <span className="text-orange-600">
                      📉 저조 구간: {analysis.staminaAnalysis.fatiguePattern.lowPerformanceRange}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 구간별 정확도 그래프 */}
            {analysis.staminaAnalysis.accuracyBySequence &&
             analysis.staminaAnalysis.accuracyBySequence.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">📊 구간별 정확도</h4>
                <div className="space-y-2">
                  {analysis.staminaAnalysis.accuracyBySequence.map((seq, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 w-20">{seq.range}번</span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            seq.accuracy >= 80 ? 'bg-green-500' :
                            seq.accuracy >= 60 ? 'bg-yellow-500' :
                            seq.accuracy >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${seq.accuracy}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-16 text-right">
                        {seq.correctCount}/{seq.totalCount} ({seq.accuracy}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 시간 배분 & 집중력 */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* 시간 배분 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 mb-2">⏱️ 시간 배분 분석</h4>
                <p className="text-sm text-gray-600 mb-3">{analysis.staminaAnalysis.timeDistribution?.analysis}</p>
                {(analysis.staminaAnalysis.timeDistribution?.rushedProblems?.length ?? 0) > 0 && (
                  <div className="text-xs text-orange-600 mb-1">
                    ⚡ 급하게 푼 문제: {analysis.staminaAnalysis.timeDistribution?.rushedProblems?.join(', ')}
                  </div>
                )}
                {(analysis.staminaAnalysis.timeDistribution?.overthoughtProblems?.length ?? 0) > 0 && (
                  <div className="text-xs text-blue-600">
                    🤔 오래 고민한 문제: {analysis.staminaAnalysis.timeDistribution?.overthoughtProblems?.join(', ')}
                  </div>
                )}
              </div>

              {/* 집중력 */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-700">🎯 집중력 유지</h4>
                  <span className="text-lg font-bold text-indigo-600">
                    {analysis.staminaAnalysis.focusAnalysis?.score ?? 0}점
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${analysis.staminaAnalysis.focusAnalysis?.score ?? 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">{analysis.staminaAnalysis.focusAnalysis?.analysis}</p>
                {analysis.staminaAnalysis.focusAnalysis?.signs &&
                 analysis.staminaAnalysis.focusAnalysis.signs.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">관찰된 징후:</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.staminaAnalysis.focusAnalysis.signs.map((sign, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {sign}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 권장사항 */}
            {analysis.staminaAnalysis.recommendations &&
             analysis.staminaAnalysis.recommendations.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="font-medium text-green-800 mb-2">💡 지구력 향상 권장사항</div>
                <ul className="text-sm text-green-700 space-y-1">
                  {analysis.staminaAnalysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 개선 전략 */}
        {analysis.actionablePrescription && analysis.actionablePrescription.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 개선 전략</h3>
            <div className="space-y-4">
              {analysis.actionablePrescription.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      item.priority === 1 ? 'bg-red-100 text-red-700' :
                      item.priority === 2 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.priority}순위
                    </span>
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      {item.type}
                    </span>
                    <span className="font-semibold text-gray-900">{item.title}</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{item.description}</p>
                  
                  <div className="grid md:grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3">
                    <div><span className="text-gray-500">📚 무엇을:</span> {item.whatToDo}</div>
                    <div><span className="text-gray-500">📍 어디서:</span> {item.where}</div>
                    <div><span className="text-gray-500">⏱️ 얼마나:</span> {item.howMuch}</div>
                    <div><span className="text-gray-500">💡 어떻게:</span> {item.howTo}</div>
                    {item.measurementMethod && (
                      <div className="md:col-span-2">
                        <span className="text-gray-500">📏 측정 방법:</span> {item.measurementMethod}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 성장 궤적 그래프 */}
        {(analysis.resultAnalysis?.gradeTrend || analysis.growthPredictions) && (
          <GrowthTrajectoryChart
            scoreHistory={analysis.resultAnalysis?.gradeTrend}
            predictions={analysis.growthPredictions}
            currentScore={report.total_score ?? undefined}
            targetScore={analysis.resultAnalysis?.gradeTrend && analysis.resultAnalysis.gradeTrend.length > 0
              ? Math.round(analysis.resultAnalysis.gradeTrend[analysis.resultAnalysis.gradeTrend.length - 1].score * 1.1)
              : undefined
            }
            title="성장 궤적"
          />
        )}

        {/* 미래 비전 - VisionFooter 컴포넌트 사용 */}
        {report.students && (analysis.macroAnalysis?.futureVision || analysis.growthPredictions) && (
          <VisionFooter
            legacyVision={analysis.macroAnalysis?.futureVision}
            growthPredictions={analysis.growthPredictions}
            studentName={report.students.name}
          />
        )}

        {/* 문항별 분석 */}
        {analysis.detailedAnalysis && analysis.detailedAnalysis.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 문항별 분석</h3>

            {/* Mobile: card view */}
            <div className="md:hidden space-y-3">
              {analysis.detailedAnalysis.map((item, index) => (
                <div key={index} className={`rounded-lg border p-4 text-sm ${
                  item.isCorrect === 'X' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-gray-800">문제 {item.problemNumber}</span>
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white font-bold text-xs ${
                      item.isCorrect === 'O' ? 'bg-green-500' :
                      item.isCorrect === 'X' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}>
                      {item.isCorrect}
                    </span>
                  </div>
                  <p className="font-medium text-gray-800 mb-1">{item.keyConcept}</p>
                  {item.errorType && (
                    <p className="text-xs text-red-600 mb-1">오류: {item.errorType}</p>
                  )}
                  {item.analysis && (
                    <p className="text-xs text-gray-600 leading-relaxed">{item.analysis}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">번호</th>
                    <th className="px-3 py-2 text-center">정오</th>
                    <th className="px-3 py-2 text-left">핵심 개념</th>
                    <th className="px-3 py-2 text-left">오류 유형</th>
                    <th className="px-3 py-2 text-left">분석</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analysis.detailedAnalysis.map((item, index) => (
                    <tr key={index} className={item.isCorrect === 'X' ? 'bg-red-50' : ''}>
                      <td className="px-3 py-2 font-medium">{item.problemNumber}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block w-6 h-6 rounded-full text-white font-bold leading-6 ${
                          item.isCorrect === 'O' ? 'bg-green-500' :
                          item.isCorrect === 'X' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}>
                          {item.isCorrect}
                        </span>
                      </td>
                      <td className="px-3 py-2">{item.keyConcept}</td>
                      <td className="px-3 py-2 text-gray-600">{item.errorType || '-'}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs max-w-xs" title={item.analysis}>
                        {item.analysis || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 학습 습관 & 위험 요인 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {analysis.learningHabits && analysis.learningHabits.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 학습 습관</h3>
              <div className="space-y-2">
                {analysis.learningHabits.map((habit, index) => (
                  <div key={index} className={`p-3 rounded-lg text-sm ${
                    habit.type === 'good' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <span className="mr-2">{habit.type === 'good' ? '✅' : '❌'}</span>
                    {habit.description}
                    <span className="text-xs text-gray-500 ml-2">({habit.frequency})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.riskFactors && analysis.riskFactors.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 위험 요인</h3>
              <div className="space-y-2">
                {analysis.riskFactors.map((risk, index) => (
                  <div key={index} className={`p-3 rounded-lg text-sm ${
                    risk.severity === 'high' ? 'bg-red-50' :
                    risk.severity === 'medium' ? 'bg-yellow-50' : 'bg-blue-50'
                  }`}>
                    <div className="font-medium">{risk.factor}</div>
                    <div className="text-xs text-gray-600 mt-1">💡 {risk.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 🌟 프리미엄: 5관점 심층 분석 */}
        {analysis.macroAnalysis && (
          <FivePerspectiveAnalysis
            perspectives={[
              {
                type: 'thinking_start',
                title: '사고의 출발점',
                summary: analysis.macroAnalysis.strengths || '문제 접근 방식을 분석 중입니다.',
                status: 'good',
              },
              {
                type: 'solving_process',
                title: '풀이 진행 과정',
                summary: analysis.macroAnalysis.summary || '풀이 과정을 분석 중입니다.',
                status: analysis.macroAnalysis.errorPattern ? 'warning' : 'good',
              },
              {
                type: 'calculation_pattern',
                title: '계산 및 실수 패턴',
                summary: analysis.macroAnalysis.errorPattern || '계산 패턴을 분석 중입니다.',
                status: analysis.riskFactors?.some(r => r.severity === 'high') ? 'critical' : 'warning',
              },
              {
                type: 'problem_interpretation',
                title: '문제 해석 능력',
                summary: analysis.macroAnalysis.weaknesses || '문제 해석 능력을 분석 중입니다.',
                status: analysis.macroAnalysis.weaknesses ? 'warning' : 'good',
              },
              {
                type: 'solving_habit',
                title: '풀이 습관 관찰',
                summary: analysis.learningHabits?.map(h => h.description).join(', ') || '풀이 습관을 분석 중입니다.',
                status: analysis.learningHabits?.some(h => h.type === 'bad') ? 'warning' : 'good',
              },
            ]}
            studentName={report.students?.name}
            testName={report.test_name || undefined}
          />
        )}

        {/* 🌟 프리미엄: 학부모 행동 가이드 */}
        {report.students && (
          <HomeActionCard
            studentName={report.students.name}
            praisePoint={
              analysis.macroAnalysis?.strengths?.split('.')[0] ||
              '꾸준히 노력하고 있는 점'
            }
            praiseExample={`"${report.students.name}아, 이번 시험에서 ${analysis.macroAnalysis?.strengths?.split('.')[0] || '열심히 푼 점'}이 정말 대단해!"`}
            observePoint={
              analysis.riskFactors?.[0]?.factor ||
              analysis.macroAnalysis?.weaknesses?.split('.')[0] ||
              '집중력 유지'
            }
            questionToAsk={`"오늘 수학 공부하면서 가장 어려웠던 건 뭐야?"`}
            weekendActivity={
              analysis.actionablePrescription?.[0]?.howTo ||
              '틀린 문제 함께 다시 풀어보기'
            }
          />
        )}

        {/* 🌟 프리미엄: 성장 예측 차트 */}
        {analysis.growthPredictions && analysis.growthPredictions.length > 0 && (
          <GrowthProjectionChart
            historicalData={[
              { date: report.test_date || '현재', score: report.total_score ?? 0 },
            ]}
            projectedData={analysis.growthPredictions.map(p => ({
              date: p.timeframe,
              score: p.predictedScore,
              label: `${p.timeframe} 예상`,
              isProjection: true,
            }))}
            targetScore={analysis.growthPredictions[analysis.growthPredictions.length - 1]?.predictedScore || 90}
            studentName={report.students?.name}
          />
        )}

        {/* 🌟 프리미엄: 취약점 극복 여정 맵 */}
        {analysis.macroAnalysis?.weaknessFlow && (
          <WeaknessJourneyMap
            journeyItems={[
              {
                id: 'weakness-1',
                concept: analysis.macroAnalysis.weaknessFlow.step1?.title || '취약 개념 발견',
                status: 'discovered',
                details: analysis.macroAnalysis.weaknessFlow.step1?.description,
                discoveredDate: report.test_date || report.created_at,
              },
              {
                id: 'weakness-2',
                concept: analysis.macroAnalysis.weaknessFlow.step2?.title || '훈련 진행 중',
                status: 'training',
                details: analysis.macroAnalysis.weaknessFlow.step2?.description,
                progress: 40,
              },
              {
                id: 'weakness-3',
                concept: analysis.macroAnalysis.weaknessFlow.step3?.title || '극복 목표',
                status: 'improving',
                details: analysis.macroAnalysis.weaknessFlow.step3?.description,
                progress: 0,
              },
            ]}
            studentName={report.students?.name}
            reportPeriod={report.test_date}
          />
        )}

        {/* 목표까지의 거리 (Vision Distance) */}
        {report.students && (
          <VisionDistanceFooter
            currentScore={report.total_score ?? undefined}
            targetScore={analysis.growthPredictions?.[0]?.predictedScore || 90}
            studentName={report.students.name}
            reportType="test"
          />
        )}
        </>
        )}

        {/* ===== 주간 리포트 뷰 ===== */}
        {report.report_type === 'weekly' && weeklyAnalysis && (
          <>
            {/* 주간 요약 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 주간 요약</h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-indigo-600">수업 횟수</div>
                  <div className="text-2xl font-bold text-indigo-700">{weeklyAnalysis.classSessions?.length || 0}회</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-green-600">숙제 완료율</div>
                  <div className="text-2xl font-bold text-green-700">{weeklyAnalysis.assignmentCompletion?.rate || 0}%</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-purple-600">학습 습관 점수</div>
                  <div className="text-2xl font-bold text-purple-700">
                    {weeklyAnalysis.habitScore?.score || weeklyAnalysis.microLoopFeedback?.continuityScore || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* 수업 세션 */}
            {weeklyAnalysis.classSessions && weeklyAnalysis.classSessions.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 수업 세션</h3>
                <div className="space-y-3">
                  {weeklyAnalysis.classSessions.map((session, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{session.date}</span>
                        <span className="text-sm text-gray-500">{session.duration}분</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {session.keywords?.map((kw, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">{kw}</span>
                        ))}
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span>이해도: {'⭐'.repeat(session.understandingLevel || 0)}</span>
                        <span>집중도: {'⭐'.repeat(session.attentionLevel || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 학습 내용 평가 */}
            {weeklyAnalysis.learningContent && weeklyAnalysis.learningContent.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 학습 내용 평가</h3>
                <div className="space-y-2">
                  {weeklyAnalysis.learningContent.map((item, idx) => (
                    <div key={idx} className={`p-3 rounded-lg ${
                      item.evaluation === 'excellent' ? 'bg-green-50' :
                      item.evaluation === 'good' ? 'bg-blue-50' : 'bg-orange-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          item.evaluation === 'excellent' ? 'bg-green-200 text-green-700' :
                          item.evaluation === 'good' ? 'bg-blue-200 text-blue-700' : 'bg-orange-200 text-orange-700'
                        }`}>
                          {item.evaluation === 'excellent' ? '우수' : item.evaluation === 'good' ? '양호' : '보완필요'}
                        </span>
                        <span className="font-medium">{item.topic}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{item.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 마이크로 루프 피드백 — MomentumGauge */}
            {(() => {
              const sessions = weeklyAnalysis.classSessions || [];
              const avgUnderstanding = sessions.length > 0
                ? sessions.reduce((sum, s) => sum + (s.understandingLevel || 3), 0) / sessions.length
                : 3;
              const avgFocus = sessions.length > 0
                ? sessions.reduce((sum, s) => sum + (s.attentionLevel || 3), 0) / sessions.length
                : 3;
              const habitScoreResult = weeklyAnalysis.habitScore || calculateHabitScore({
                assignmentTotal: weeklyAnalysis.assignmentCompletion?.total || 0,
                assignmentCompleted: weeklyAnalysis.assignmentCompletion?.completed || 0,
                averageUnderstanding: avgUnderstanding,
                averageFocus: avgFocus,
                classSessionCount: sessions.length,
              });
              const momentum = weeklyAnalysis.growthMomentum || convertMomentumStatus(
                weeklyAnalysis.microLoopFeedback?.momentumStatus || '',
                habitScoreResult.score
              );

              return (
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🔄 마이크로 루프 피드백</h3>
                  <MomentumGauge
                    status={momentum.status}
                    habitScore={habitScoreResult.score}
                    statusLabel={momentum.statusLabel}
                    weeklyComparison={weeklyAnalysis.growthMomentum?.weeklyComparison || generateWeeklyComparison(habitScoreResult.score)}
                  />

                  {/* 습관 점수 breakdown */}
                  {habitScoreResult.breakdown && (
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div className="bg-blue-50 rounded-lg p-3">
                        <div className="text-xs text-blue-600">숙제 완료</div>
                        <div className="text-lg font-bold text-blue-700">{habitScoreResult.breakdown.assignmentCompletion}</div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <div className="text-xs text-purple-600">집중도</div>
                        <div className="text-lg font-bold text-purple-700">{habitScoreResult.breakdown.focusLevel}</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="text-xs text-green-600">이해도</div>
                        <div className="text-lg font-bold text-green-700">{habitScoreResult.breakdown.understandingLevel}</div>
                      </div>
                    </div>
                  )}

                  {/* 지난주 목표 달성 */}
                  {weeklyAnalysis.microLoopFeedback?.lastWeekGoalAchievement && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="text-sm font-medium text-gray-700 mb-2">지난주 목표 달성</div>
                      <div className="space-y-2">
                        {weeklyAnalysis.microLoopFeedback.lastWeekGoalAchievement.map((goal, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <span>{goal.achieved ? '✅' : '❌'}</span>
                            <span>{goal.goal}</span>
                            {goal.notes && <span className="text-gray-500">- {goal.notes}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 다음 주 계획 */}
            {weeklyAnalysis.nextWeekPlan && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-3">📌 다음 주 계획</h3>
                <div className="mb-3">
                  <span className="text-indigo-200">핵심 목표:</span>
                  <span className="ml-2 font-medium">{weeklyAnalysis.nextWeekPlan.focus}</span>
                </div>
                {weeklyAnalysis.nextWeekPlan.goals && (
                  <ul className="space-y-1">
                    {weeklyAnalysis.nextWeekPlan.goals.map((g, i) => (
                      <li key={i} className="text-sm">• {g}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 격려 메시지 */}
            {weeklyAnalysis.encouragement && (
              <div className="bg-yellow-50 rounded-xl p-6 mb-6 border border-yellow-200">
                <p className="text-yellow-800">💪 {weeklyAnalysis.encouragement}</p>
              </div>
            )}

            {/* 목표까지의 거리 (Vision Distance) */}
            {report.students && (
              <VisionDistanceFooter
                currentScore={report.total_score ?? undefined}
                targetScore={90}
                studentName={report.students.name}
                reportType="weekly"
              />
            )}
          </>
        )}

        {/* ===== 월간 리포트 뷰 ===== */}
        {report.report_type === 'monthly' && monthlyAnalysis && (
          <>
            {/* 월간 요약 통계 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 월간 요약</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-indigo-600">총 수업</div>
                  <div className="text-2xl font-bold text-indigo-700">{monthlyAnalysis.classSessionsSummary?.totalClasses || 0}회</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-blue-600">총 시간</div>
                  <div className="text-2xl font-bold text-blue-700">{monthlyAnalysis.classSessionsSummary?.totalHours || 0}시간</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-green-600">출석률</div>
                  <div className="text-2xl font-bold text-green-700">{monthlyAnalysis.classSessionsSummary?.attendanceRate || 0}%</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-purple-600">평균 이해도</div>
                  <div className="text-2xl font-bold text-purple-700">{monthlyAnalysis.classSessionsSummary?.averageUnderstanding || 0}</div>
                </div>
              </div>
            </div>

            {/* 커리큘럼 진도 */}
            {monthlyAnalysis.curriculumProgress && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 커리큘럼 진도</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-gray-600">{monthlyAnalysis.curriculumProgress.startUnit}</div>
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${monthlyAnalysis.curriculumProgress.completionRate}%` }}
                    />
                  </div>
                  <div className="text-gray-600">{monthlyAnalysis.curriculumProgress.endUnit}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">진도율: {monthlyAnalysis.curriculumProgress.completionRate}%</span>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    monthlyAnalysis.curriculumProgress.paceAssessment === 'ahead' ? 'bg-green-100 text-green-700' :
                    monthlyAnalysis.curriculumProgress.paceAssessment === 'on_track' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {monthlyAnalysis.curriculumProgress.paceAssessment === 'ahead' ? '선행 중' :
                     monthlyAnalysis.curriculumProgress.paceAssessment === 'on_track' ? '정상 진행' : '후행'}
                  </span>
                </div>
              </div>
            )}

            {/* 학습 내용 종합 */}
            {monthlyAnalysis.learningContentSummary && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 학습 내용 종합</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-700 mb-2">✨ 우수 영역</h4>
                    <ul className="text-sm text-green-600 space-y-1">
                      {monthlyAnalysis.learningContentSummary.excellentTopics?.map((t, i) => (
                        <li key={i}>• {t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-700 mb-2">👍 양호 영역</h4>
                    <ul className="text-sm text-blue-600 space-y-1">
                      {monthlyAnalysis.learningContentSummary.goodTopics?.map((t, i) => (
                        <li key={i}>• {t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h4 className="font-medium text-orange-700 mb-2">⚠️ 도전 영역</h4>
                    <ul className="text-sm text-orange-600 space-y-1">
                      {monthlyAnalysis.learningContentSummary.challengingTopics?.map((t, i) => (
                        <li key={i}>• {t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 마이크로 루프 월간 점검 */}
            {monthlyAnalysis.microLoopMonthlyReview && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔄 마이크로 루프 월간 점검</h3>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">월간 목표 달성도</div>
                    <div className="text-3xl font-bold text-indigo-600">{monthlyAnalysis.microLoopMonthlyReview.monthlyGoalAchievement}%</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">주간 연속성 평균</div>
                    <div className="text-3xl font-bold text-blue-600">{monthlyAnalysis.microLoopMonthlyReview.weeklyConsistency}</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">성장 모멘텀</div>
                    <div className={`text-lg font-bold ${
                      monthlyAnalysis.microLoopMonthlyReview.growthMomentum === 'accelerating' ? 'text-green-600' :
                      monthlyAnalysis.microLoopMonthlyReview.growthMomentum === 'maintaining' ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {monthlyAnalysis.microLoopMonthlyReview.growthMomentum === 'accelerating' ? '🚀 가속' :
                       monthlyAnalysis.microLoopMonthlyReview.growthMomentum === 'maintaining' ? '✅ 유지' : '⚠️ 감속'}
                    </div>
                  </div>
                </div>
                {monthlyAnalysis.microLoopMonthlyReview.adjustmentNeeded && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">📌 조정 권장사항</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {monthlyAnalysis.microLoopMonthlyReview.adjustmentRecommendations?.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 부모님 보고 */}
            {monthlyAnalysis.parentReport && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-4">👨‍👩‍👧 학부모님께</h3>
                {monthlyAnalysis.parentReport.highlights && (
                  <div className="mb-4">
                    <h4 className="font-medium text-indigo-200 mb-2">이달의 하이라이트</h4>
                    <ul className="space-y-1">
                      {monthlyAnalysis.parentReport.highlights.map((h, i) => (
                        <li key={i} className="text-sm">✨ {h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {monthlyAnalysis.parentReport.concerns && monthlyAnalysis.parentReport.concerns.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-indigo-200 mb-2">관심 필요 사항</h4>
                    <ul className="space-y-1">
                      {monthlyAnalysis.parentReport.concerns.map((c, i) => (
                        <li key={i} className="text-sm">⚠️ {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {monthlyAnalysis.parentReport.recommendations && (
                  <div>
                    <h4 className="font-medium text-indigo-200 mb-2">권장사항</h4>
                    <ul className="space-y-1">
                      {monthlyAnalysis.parentReport.recommendations.map((r, i) => (
                        <li key={i} className="text-sm">💡 {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 목표까지의 거리 (Vision Distance) */}
            {report.students && (
              <VisionDistanceFooter
                currentScore={report.total_score ?? undefined}
                targetScore={90}
                studentName={report.students.name}
                reportType="monthly"
              />
            )}
          </>
        )}

        {/* ===== 6개월 리포트 뷰 ===== */}
        {report.report_type === 'semi_annual' && semiAnnualAnalysis && (
          <>
            {/* 반기 요약 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 {semiAnnualAnalysis.halfYear} 요약</h3>
              <div className="grid md:grid-cols-5 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-indigo-600">총 수업</div>
                  <div className="text-xl font-bold text-indigo-700">{semiAnnualAnalysis.periodSummary?.totalClasses || 0}회</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-blue-600">총 시간</div>
                  <div className="text-xl font-bold text-blue-700">{semiAnnualAnalysis.periodSummary?.totalHours || 0}h</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-green-600">총 시험</div>
                  <div className="text-xl font-bold text-green-700">{semiAnnualAnalysis.periodSummary?.totalTests || 0}회</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-purple-600">평균 점수</div>
                  <div className="text-xl font-bold text-purple-700">{semiAnnualAnalysis.periodSummary?.averageScore || 0}점</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-orange-600">점수 향상</div>
                  <div className="text-xl font-bold text-orange-700">+{semiAnnualAnalysis.periodSummary?.scoreImprovement || 0}</div>
                </div>
              </div>
            </div>

            {/* 성장 궤적 */}
            {semiAnnualAnalysis.growthTrajectory && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 성장 궤적</h3>
                <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">시작점</div>
                    <div className="text-2xl font-bold text-indigo-600">{semiAnnualAnalysis.growthTrajectory.startingPoint?.score}점</div>
                    <div className="text-xs text-gray-400">{semiAnnualAnalysis.growthTrajectory.startingPoint?.level}</div>
                  </div>
                  <div className="flex-1 mx-4 text-center">
                    <div className="text-3xl">→</div>
                    <div className={`text-lg font-bold ${
                      semiAnnualAnalysis.growthTrajectory.growthRate >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {semiAnnualAnalysis.growthTrajectory.growthRate >= 0 ? '+' : ''}{semiAnnualAnalysis.growthTrajectory.growthRate}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">현재</div>
                    <div className="text-2xl font-bold text-purple-600">{semiAnnualAnalysis.growthTrajectory.currentPoint?.score}점</div>
                    <div className="text-xs text-gray-400">{semiAnnualAnalysis.growthTrajectory.currentPoint?.level}</div>
                  </div>
                </div>
                <div className="text-center">
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                    semiAnnualAnalysis.growthTrajectory.growthType === 'exponential' ? 'bg-green-100 text-green-700' :
                    semiAnnualAnalysis.growthTrajectory.growthType === 'linear' ? 'bg-blue-100 text-blue-700' :
                    semiAnnualAnalysis.growthTrajectory.growthType === 'plateau' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    성장 유형: {
                      semiAnnualAnalysis.growthTrajectory.growthType === 'exponential' ? '급성장' :
                      semiAnnualAnalysis.growthTrajectory.growthType === 'linear' ? '꾸준한 성장' :
                      semiAnnualAnalysis.growthTrajectory.growthType === 'plateau' ? '정체기' : '변동 있음'
                    }
                  </span>
                </div>
              </div>
            )}

            {/* 메타프로필 변화 */}
            {semiAnnualAnalysis.metaProfileEvolution && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🧠 메타프로필 변화</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">흡수율</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{semiAnnualAnalysis.metaProfileEvolution.absorptionRateChange?.previous}</span>
                      <span>→</span>
                      <span className="font-bold text-indigo-600">{semiAnnualAnalysis.metaProfileEvolution.absorptionRateChange?.current}</span>
                      <span className={`text-sm ${
                        semiAnnualAnalysis.metaProfileEvolution.absorptionRateChange?.trend === 'improving' ? 'text-green-500' :
                        semiAnnualAnalysis.metaProfileEvolution.absorptionRateChange?.trend === 'stable' ? 'text-blue-500' : 'text-red-500'
                      }`}>
                        ({semiAnnualAnalysis.metaProfileEvolution.absorptionRateChange?.trend === 'improving' ? '↑' :
                          semiAnnualAnalysis.metaProfileEvolution.absorptionRateChange?.trend === 'stable' ? '→' : '↓'})
                      </span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">지구력</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{semiAnnualAnalysis.metaProfileEvolution.staminaChange?.previous}</span>
                      <span>→</span>
                      <span className="font-bold text-green-600">{semiAnnualAnalysis.metaProfileEvolution.staminaChange?.current}</span>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-2">메타인지</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{semiAnnualAnalysis.metaProfileEvolution.metaCognitionChange?.previous}</span>
                      <span>→</span>
                      <span className="font-bold text-purple-600">{semiAnnualAnalysis.metaProfileEvolution.metaCognitionChange?.current}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 취약점 종합 점검 */}
            {semiAnnualAnalysis.weaknessReview && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 취약점 종합 점검</h3>
                <div className="mb-4 p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-green-600 mb-1">해결률</div>
                  <div className="text-3xl font-bold text-green-700">{semiAnnualAnalysis.weaknessReview.resolutionRate}%</div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-700 mb-2">✅ 해결된 취약점</h4>
                    <ul className="text-sm text-green-600 space-y-1">
                      {semiAnnualAnalysis.weaknessReview.resolved?.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h4 className="font-medium text-orange-700 mb-2">⚠️ 지속 관찰 필요</h4>
                    <ul className="text-sm text-orange-600 space-y-1">
                      {semiAnnualAnalysis.weaknessReview.persistent?.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 매크로 루프 분석 */}
            {semiAnnualAnalysis.macroLoopAnalysis && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔄 매크로 루프 분석</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">반기 목표 달성률</div>
                    <div className="text-3xl font-bold text-indigo-600">{semiAnnualAnalysis.macroLoopAnalysis.goalAchievementRate}%</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">학습 효율성</div>
                    <div className="text-3xl font-bold text-green-600">{semiAnnualAnalysis.macroLoopAnalysis.learningEfficiency}%</div>
                  </div>
                </div>
                {semiAnnualAnalysis.macroLoopAnalysis.strategicAdjustments && semiAnnualAnalysis.macroLoopAnalysis.strategicAdjustments.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">📌 전략적 조정 제안</h4>
                    <div className="space-y-2">
                      {semiAnnualAnalysis.macroLoopAnalysis.strategicAdjustments.map((adj, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium text-yellow-700">{adj.area}:</span>
                          <span className="text-yellow-600 ml-1">{adj.suggestedChange}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 부모님 종합 보고 */}
            {semiAnnualAnalysis.parentComprehensiveReport && (
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-4">👨‍👩‍👧 학부모님께 드리는 반기 종합 보고</h3>
                <div className="mb-4">
                  <h4 className="font-medium text-indigo-200 mb-2">요약</h4>
                  <p className="text-sm">{semiAnnualAnalysis.parentComprehensiveReport.executiveSummary}</p>
                </div>
                {semiAnnualAnalysis.parentComprehensiveReport.recommendations && (
                  <div>
                    <h4 className="font-medium text-indigo-200 mb-2">권장사항</h4>
                    <ul className="space-y-1">
                      {semiAnnualAnalysis.parentComprehensiveReport.recommendations.map((r, i) => (
                        <li key={i} className="text-sm">💡 {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 목표까지의 거리 (Vision Distance) */}
            {report.students && (
              <VisionDistanceFooter
                currentScore={semiAnnualAnalysis.periodSummary?.averageScore ?? undefined}
                targetScore={90}
                studentName={report.students.name}
                reportType="semi_annual"
              />
            )}
          </>
        )}

        {/* ===== 연간 리포트 뷰 ===== */}
        {report.report_type === 'annual' && annualAnalysis && (
          <>
            {/* 연간 통계 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 {annualAnalysis.year}년 연간 통계</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-indigo-600">총 수업</div>
                  <div className="text-xl font-bold text-indigo-700">{annualAnalysis.annualStatistics?.totalClasses || 0}회</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-blue-600">총 학습시간</div>
                  <div className="text-xl font-bold text-blue-700">{annualAnalysis.annualStatistics?.totalHours || 0}시간</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-green-600">평균 점수</div>
                  <div className="text-xl font-bold text-green-700">{annualAnalysis.annualStatistics?.averageScore || 0}점</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-xs text-purple-600">점수 향상</div>
                  <div className="text-xl font-bold text-purple-700">+{annualAnalysis.annualStatistics?.scoreImprovement || 0}</div>
                </div>
              </div>
            </div>

            {/* 성장 스토리 */}
            {annualAnalysis.growthStory && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📖 연간 성장 스토리</h3>

                {/* 시작과 끝 */}
                <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-lg">
                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-500">학년 초</div>
                    <div className="text-lg font-bold text-gray-700">{annualAnalysis.growthStory.beginningState?.description}</div>
                  </div>
                  <div className="mx-4 text-3xl">🚀</div>
                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-500">학년 말</div>
                    <div className="text-lg font-bold text-indigo-700">{annualAnalysis.growthStory.endingState?.description}</div>
                  </div>
                </div>

                {/* 주요 마일스톤 */}
                {annualAnalysis.growthStory.majorMilestones && annualAnalysis.growthStory.majorMilestones.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">🏆 주요 마일스톤</h4>
                    <div className="space-y-2">
                      {annualAnalysis.growthStory.majorMilestones.map((m, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                          <span className="text-sm text-gray-500">{m.date}</span>
                          <span className="font-medium text-green-700">{m.milestone}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 서사 요약 */}
                {annualAnalysis.growthStory.narrativeSummary && (
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-indigo-800 italic">&ldquo;{annualAnalysis.growthStory.narrativeSummary}&rdquo;</p>
                  </div>
                )}
              </div>
            )}

            {/* Baseline 대비 성장 */}
            {annualAnalysis.baselineComparison && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Baseline 대비 성장</h3>
                <div className="text-center mb-4">
                  <div className="text-sm text-gray-500">전체 성장률</div>
                  <div className={`text-4xl font-bold ${
                    annualAnalysis.baselineComparison.overallGrowthRate >= 20 ? 'text-green-600' :
                    annualAnalysis.baselineComparison.overallGrowthRate >= 10 ? 'text-blue-600' : 'text-orange-600'
                  }`}>
                    +{annualAnalysis.baselineComparison.overallGrowthRate}%
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    annualAnalysis.baselineComparison.growthCategory === 'exceptional' ? 'bg-green-100 text-green-700' :
                    annualAnalysis.baselineComparison.growthCategory === 'excellent' ? 'bg-blue-100 text-blue-700' :
                    annualAnalysis.baselineComparison.growthCategory === 'good' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {annualAnalysis.baselineComparison.growthCategory === 'exceptional' ? '탁월함' :
                     annualAnalysis.baselineComparison.growthCategory === 'excellent' ? '우수' :
                     annualAnalysis.baselineComparison.growthCategory === 'good' ? '양호' :
                     annualAnalysis.baselineComparison.growthCategory === 'steady' ? '꾸준함' : '관심 필요'}
                  </span>
                </div>
                {annualAnalysis.baselineComparison.currentMetrics && (
                  <div className="space-y-2">
                    {annualAnalysis.baselineComparison.currentMetrics.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="font-medium">{m.domain}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{m.initial}</span>
                          <span>→</span>
                          <span className="font-bold text-indigo-600">{m.current}</span>
                          <span className="text-green-500 text-sm">(+{m.growthRate}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 연간 매크로 루프 종합 */}
            {annualAnalysis.annualMacroLoopSummary && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🔄 연간 매크로 루프 종합</h3>
                {annualAnalysis.annualMacroLoopSummary.halfYearComparison && (
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-sm text-gray-500">상반기</div>
                      <div className="text-2xl font-bold text-indigo-600">
                        {annualAnalysis.annualMacroLoopSummary.halfYearComparison.firstHalf?.averageScore}점
                      </div>
                      <div className="text-sm text-gray-400">
                        성장률 {annualAnalysis.annualMacroLoopSummary.halfYearComparison.firstHalf?.growthRate}%
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <div className="text-sm text-gray-500">하반기</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {annualAnalysis.annualMacroLoopSummary.halfYearComparison.secondHalf?.averageScore}점
                      </div>
                      <div className="text-sm text-gray-400">
                        성장률 {annualAnalysis.annualMacroLoopSummary.halfYearComparison.secondHalf?.growthRate}%
                      </div>
                    </div>
                  </div>
                )}
                {annualAnalysis.annualMacroLoopSummary.learningROI && (
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-sm text-green-600">학습 ROI</div>
                    <div className="text-lg font-bold text-green-700">
                      {annualAnalysis.annualMacroLoopSummary.learningROI.efficiencyRating}
                    </div>
                    <div className="text-xs text-green-500">
                      {annualAnalysis.annualMacroLoopSummary.learningROI.timeInvested}시간 투자 →
                      {annualAnalysis.annualMacroLoopSummary.learningROI.improvementAchieved}점 향상
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 다음 학년 준비 */}
            {annualAnalysis.nextYearPreparation && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 다음 학년 준비</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">준비도 점수</div>
                    <div className="text-3xl font-bold text-indigo-600">{annualAnalysis.nextYearPreparation.readinessScore}%</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-sm text-gray-500">권장 학습 속도</div>
                    <div className={`text-lg font-bold ${
                      annualAnalysis.nextYearPreparation.recommendedPace === 'accelerated' ? 'text-green-600' :
                      annualAnalysis.nextYearPreparation.recommendedPace === 'normal' ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {annualAnalysis.nextYearPreparation.recommendedPace === 'accelerated' ? '🚀 가속' :
                       annualAnalysis.nextYearPreparation.recommendedPace === 'normal' ? '✅ 정상' : '🔧 보완 필요'}
                    </div>
                  </div>
                </div>
                {annualAnalysis.nextYearPreparation.focusAreas && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800 mb-2">📌 집중 영역</h4>
                    <div className="flex flex-wrap gap-2">
                      {annualAnalysis.nextYearPreparation.focusAreas.map((a, i) => (
                        <span key={i} className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 연간 종합 메시지 */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-sm p-6 mb-6 text-white">
              <h3 className="text-lg font-semibold mb-4">🌟 {annualAnalysis.year}년을 마치며</h3>
              <p className="text-indigo-100 leading-relaxed">
                {report.students?.name} 학생은 한 해 동안 놀라운 성장을 보여주었습니다.
                시작점에서 {annualAnalysis.baselineComparison?.overallGrowthRate || 0}%의 성장을 이루었으며,
                다음 학년에도 이 모멘텀을 유지할 것으로 기대됩니다.
              </p>
            </div>

            {/* 목표까지의 거리 (Vision Distance) */}
            {report.students && (
              <VisionDistanceFooter
                currentScore={annualAnalysis.annualStatistics?.averageScore ?? undefined}
                targetScore={95}
                studentName={report.students.name}
                reportType="annual"
              />
            )}
          </>
        )}

        {/* ===== 내 풀이 분석 (학생/학부모 업로드) ===== */}
        {selfAnalysis && (
          <>
            {/* 업로드 정보 배너 */}
            <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-medium text-emerald-800">
                  {selfAnalysis.uploadedBy === 'parent' ? '학부모' : '학생'}이 직접 업로드한 풀이 분석입니다.
                </p>
                <p className="text-sm text-emerald-600">
                  유형: {selfAnalysis.problemType} · 주제: {selfAnalysis.topicTags?.join(', ')}
                </p>
              </div>
            </div>

            {/* 전체 평가 요약 */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">분석 결과 요약</h3>
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
                  <span>🏅</span>
                  <p className="text-yellow-800 font-medium text-sm">{selfAnalysis.milestone}</p>
                </div>
              )}
              <div className="p-4 bg-emerald-50 rounded-lg mb-3">
                <p className="text-emerald-800 font-medium">{selfAnalysis.oneLineSummary}</p>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">{selfAnalysis.overallAssessment}</p>
              {selfAnalysis.studentNote && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">학생 메모</p>
                  <p className="text-sm text-gray-700">{selfAnalysis.studentNote}</p>
                </div>
              )}
            </div>

            {/* 잘한 점 & 개선할 점 */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {selfAnalysis.strengthsObserved && selfAnalysis.strengthsObserved.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">💪 잘한 점</h3>
                  <ul className="space-y-2">
                    {selfAnalysis.strengthsObserved.map((s, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-green-500 shrink-0">✓</span><span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selfAnalysis.areasToImprove && selfAnalysis.areasToImprove.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 개선할 점</h3>
                  <ul className="space-y-2">
                    {selfAnalysis.areasToImprove.map((a, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-orange-500 shrink-0">→</span><span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 이전 데이터와 비교 */}
            {selfAnalysis.comparisonWithHistory && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 이전 데이터와 비교</h3>
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-700 text-sm">{selfAnalysis.comparisonWithHistory.trendSummary}</p>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {selfAnalysis.comparisonWithHistory.improvements && selfAnalysis.comparisonWithHistory.improvements.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-700 mb-2">✅ 나아진 점</h4>
                      <ul className="space-y-1">{selfAnalysis.comparisonWithHistory.improvements.map((item, i) => <li key={i} className="text-xs text-gray-600">• {item}</li>)}</ul>
                    </div>
                  )}
                  {selfAnalysis.comparisonWithHistory.newObservations && selfAnalysis.comparisonWithHistory.newObservations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-blue-700 mb-2">🔍 새로 발견된 점</h4>
                      <ul className="space-y-1">{selfAnalysis.comparisonWithHistory.newObservations.map((item, i) => <li key={i} className="text-xs text-gray-600">• {item}</li>)}</ul>
                    </div>
                  )}
                  {selfAnalysis.comparisonWithHistory.persistentIssues && selfAnalysis.comparisonWithHistory.persistentIssues.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-orange-700 mb-2">⚠️ 지속 주의</h4>
                      <ul className="space-y-1">{selfAnalysis.comparisonWithHistory.persistentIssues.map((item, i) => <li key={i} className="text-xs text-gray-600">• {item}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 문항별 피드백 */}
            {selfAnalysis.problemFeedback && selfAnalysis.problemFeedback.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 문항별 피드백</h3>
                <div className="space-y-3">
                  {selfAnalysis.problemFeedback.map((pf, i) => (
                    <div key={i} className="p-4 rounded-lg border bg-gray-50 border-gray-200">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500 text-white text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="font-medium text-sm text-gray-800">{pf.problemIdentifier || `문항 ${i + 1}`}</span>
                        {pf.errorType && <span className="ml-auto text-xs bg-red-100 px-2 py-0.5 rounded-full text-red-600 border border-red-200">{pf.errorType}</span>}
                      </div>
                      <p className="text-sm text-gray-700 ml-9 mb-2">{pf.observation}</p>
                      {pf.whatWentWell && <p className="text-xs text-green-700 ml-9">✓ {pf.whatWentWell}</p>}
                      {pf.suggestion && <p className="text-xs text-orange-700 ml-9 mt-1">→ {pf.suggestion}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 다음 단계 */}
            {selfAnalysis.nextSteps && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-6 mb-6 text-white">
                <h3 className="text-lg font-semibold mb-4">📌 다음 학습 계획</h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  {selfAnalysis.nextSteps.immediate && selfAnalysis.nextSteps.immediate.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-emerald-100 mb-2">즉시 실행</h4>
                      <ul className="space-y-1">{selfAnalysis.nextSteps.immediate.map((s, i) => <li key={i} className="text-sm text-emerald-50">• {s}</li>)}</ul>
                    </div>
                  )}
                  {selfAnalysis.nextSteps.thisWeek && selfAnalysis.nextSteps.thisWeek.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-emerald-100 mb-2">이번 주</h4>
                      <ul className="space-y-1">{selfAnalysis.nextSteps.thisWeek.map((s, i) => <li key={i} className="text-sm text-emerald-50">• {s}</li>)}</ul>
                    </div>
                  )}
                </div>
                {selfAnalysis.nextSteps.studyTip && (
                  <div className="p-3 bg-white/20 rounded-lg">
                    <p className="text-sm text-emerald-50">💡 {selfAnalysis.nextSteps.studyTip}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {/* Phase 5: 교사-학부모 코멘트 스레드 */}
        {user && (
          <ReportComments
            reportId={parseInt(reportId, 10)}
            currentUser={user}
          />
        )}
      </main>
    </div>
  );
}
