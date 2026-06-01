/**
 * Context Builder Service
 *
 * 이전 리포트에서 컨텍스트 데이터를 수집하여
 * AI 분석에 주입하는 서비스
 */

import { createAdminClient, createClient } from '@/lib/supabase/server';
import {
  buildRagDiagnostics,
  getRagFailureReason,
  normalizeRagQueryText,
} from '@/lib/rag-diagnostics';
import type {
  AnalysisContextData,
  RagDiagnostics,
  RelevantMemory,
  StudentMetaProfile,
  MicroLoopData,
  MacroLoopData,
  ReportType,
  StrategyFeedbackContext,
} from '@/types';

// ============================================
// 메인 컨텍스트 빌더 함수
// ============================================

/**
 * 학생의 AI 분석용 컨텍스트 데이터 생성
 * @param studentId 학생 ID
 * @param reportType 생성할 리포트 타입
 * @returns AnalysisContextData
 */
export async function buildAnalysisContext(
  studentId: number,
  reportType: ReportType,
  options?: { queryText?: string; relevantMemories?: RelevantMemory[] }
): Promise<AnalysisContextData> {
  // 병렬로 데이터 수집
  const [
    metaProfile,
    recentReports,
    activeWeaknesses,
    activeStrengths,
    growthLoopStatus,
    strategyFeedback,
    failedMicroSkills,
    masteredSkills,
  ] = await Promise.all([
    getStudentMetaProfile(studentId),
    getRecentReports(studentId, reportType),
    getActiveWeaknesses(studentId),
    getActiveStrengths(studentId),
    getCurrentGrowthLoop(studentId, reportType),
    getStrategyFeedback(studentId),
    getFailedMicroSkills(studentId),
    getMasteredSkills(studentId),
  ]);

  // 이전 비전 검증 데이터 가져오기
  const previousVision = await getPreviousVisionData(studentId, recentReports);

  // RAG 기억 서랍: 의미적으로 유사한 과거 메모리 검색
  let relevantMemories: RelevantMemory[] | undefined;
  let ragDiagnostics: RagDiagnostics;
  const queryText = normalizeRagQueryText(options?.queryText);
  if (options?.relevantMemories) {
    relevantMemories = options.relevantMemories;
    ragDiagnostics = buildRagDiagnostics({
      queryText,
      relevantMemories,
      retrievalSource: 'provided',
      retrievalAttempted: false,
    });
  } else if (queryText) {
    try {
      relevantMemories = await retrieveRelevantMemories(studentId, queryText);
      ragDiagnostics = buildRagDiagnostics({
        queryText,
        relevantMemories,
        retrievalSource: 'retrieved',
        retrievalAttempted: true,
      });
    } catch (error) {
      const failureReason = getRagFailureReason(error);
      // RAG 실패해도 분석은 계속 진행
      console.warn('[AnalysisContext] RAG memory retrieval failed:', {
        studentId,
        reportType,
        error: failureReason,
      });
      ragDiagnostics = buildRagDiagnostics({
        queryText,
        retrievalSource: 'failed',
        retrievalAttempted: true,
        failureReason,
      });
    }
  } else {
    ragDiagnostics = buildRagDiagnostics({ queryText });
  }

  console.info('[AnalysisContext] built', {
    studentId,
    reportType,
    ragDiagnostics,
    failedSkillCount: failedMicroSkills.length,
    masteredSkillCount: masteredSkills.length,
    recentReportCount: recentReports?.length ?? 0,
  });

  return {
    metaProfile,
    recentReports,
    activeWeaknesses,
    activeStrengths,
    currentMicroLoop: growthLoopStatus?.microLoop,
    currentMacroLoop: growthLoopStatus?.macroLoop,
    previousVision,
    strategyFeedback,
    // Phase 2: 지식 추적 및 망각 곡선
    failedMicroSkills,
    masteredSkills,
    // Phase 3: RAG 기억 서랍
    relevantMemories,
    ragDiagnostics,
  };
}

// ============================================
// 개별 데이터 수집 함수
// ============================================

/**
 * 학생의 메타프로필 조회
 */
async function getStudentMetaProfile(
  studentId: number
): Promise<StudentMetaProfile | undefined> {
  const supabase = await createClient();

  const { data: student, error } = await supabase
    .from('students')
    .select('meta_profile')
    .eq('id', studentId)
    .single();

  if (error || !student?.meta_profile) {
    return undefined;
  }

  return student.meta_profile as StudentMetaProfile;
}

/**
 * 최근 리포트 요약 조회 (최대 3개)
 */
async function getRecentReports(
  studentId: number,
  currentReportType: ReportType
): Promise<AnalysisContextData['recentReports']> {
  const supabase = await createClient();

  // 리포트 타입에 따라 참조할 이전 리포트 유형 결정
  const relevantTypes = getRelevantPreviousReportTypes(currentReportType);

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, report_type, test_date, created_at, analysis_data')
    .eq('student_id', studentId)
    .in('report_type', relevantTypes)
    .order('created_at', { ascending: false })
    .limit(3);

  if (error || !reports || reports.length === 0) {
    return undefined;
  }

  return reports.map((report) => {
    const analysisData = report.analysis_data as Record<string, unknown>;

    return {
      reportId: report.id,
      reportType: report.report_type as ReportType,
      reportDate: report.test_date || report.created_at,
      summary: extractSummary(analysisData),
      keyFindings: extractKeyFindings(analysisData),
      unresolvedIssues: extractUnresolvedIssues(analysisData),
    };
  });
}

/**
 * 현재 리포트 타입에 따라 참조할 이전 리포트 타입 결정
 */
function getRelevantPreviousReportTypes(currentType: ReportType): ReportType[] {
  switch (currentType) {
    case 'level_test':
      // 레벨 테스트는 첫 진단이므로 이전 데이터 없음
      return [];

    case 'test':
      // 시험 분석: 이전 시험과 주간/월간 리포트, 자기 분석 참조
      return ['test', 'weekly', 'monthly', 'self_analysis'];

    case 'weekly':
      // 주간: 이전 주간과 최근 시험, 자기 분석 참조
      return ['weekly', 'test', 'self_analysis'];

    case 'monthly':
      // 월간: 주간들과 시험들, 자기 분석 참조
      return ['weekly', 'test', 'monthly', 'self_analysis'];

    case 'semi_annual':
      // 반기: 월간들과 시험들, 자기 분석 참조
      return ['monthly', 'test', 'semi_annual', 'self_analysis'];

    case 'annual':
      // 연간: 반기들과 월간들, 시험, 자기 분석 참조
      return ['semi_annual', 'monthly', 'test', 'self_analysis'];

    case 'consolidated':
      // 레거시 통합: 시험들 참조
      return ['test', 'consolidated'];

    case 'self_analysis':
      // 자기 분석: 이전 시험과 주간, 자기 분석 참조
      return ['test', 'weekly', 'self_analysis'];

    default:
      return ['test', 'weekly', 'monthly', 'self_analysis'];
  }
}

/**
 * 분석 데이터에서 요약 추출
 */
function extractSummary(analysisData: Record<string, unknown>): string {
  // macroAnalysis에서 요약 추출
  const macroAnalysis = analysisData.macroAnalysis as Record<string, unknown> | undefined;

  if (macroAnalysis?.oneLineSummary) {
    return macroAnalysis.oneLineSummary as string;
  }

  if (macroAnalysis?.summary) {
    // 첫 100자만 사용
    const summary = macroAnalysis.summary as string;
    return summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
  }

  // 월간/주간 리포트용
  if (analysisData.teacherMessage) {
    const msg = analysisData.teacherMessage as string;
    return msg.length > 100 ? msg.substring(0, 100) + '...' : msg;
  }

  return '요약 없음';
}

/**
 * 분석 데이터에서 주요 발견사항 추출
 */
function extractKeyFindings(analysisData: Record<string, unknown>): string[] {
  const findings: string[] = [];

  // macroAnalysis에서 추출
  const macroAnalysis = analysisData.macroAnalysis as Record<string, unknown> | undefined;

  if (macroAnalysis?.strengths) {
    findings.push(`강점: ${(macroAnalysis.strengths as string).substring(0, 50)}`);
  }

  if (macroAnalysis?.weaknesses) {
    findings.push(`약점: ${(macroAnalysis.weaknesses as string).substring(0, 50)}`);
  }

  if (macroAnalysis?.errorPattern) {
    findings.push(`오류 패턴: ${(macroAnalysis.errorPattern as string).substring(0, 50)}`);
  }

  // 주간/월간용
  const achievements = analysisData.weeklyAchievements || analysisData.monthlyAchievements;
  if (Array.isArray(achievements) && achievements.length > 0) {
    findings.push(`성취: ${(achievements as string[]).slice(0, 2).join(', ')}`);
  }

  return findings.slice(0, 5); // 최대 5개
}

/**
 * 분석 데이터에서 미해결 이슈 추출
 */
function extractUnresolvedIssues(analysisData: Record<string, unknown>): string[] {
  const issues: string[] = [];

  // riskFactors에서 추출
  const riskFactors = analysisData.riskFactors as Array<{
    factor: string;
    severity: string;
  }> | undefined;

  if (riskFactors && riskFactors.length > 0) {
    riskFactors
      .filter((r) => r.severity === 'high' || r.severity === 'medium')
      .slice(0, 3)
      .forEach((r) => issues.push(r.factor));
  }

  // 주간/월간용
  const improvements =
    analysisData.areasForImprovement || analysisData.newChallenges;
  if (Array.isArray(improvements)) {
    issues.push(...(improvements as string[]).slice(0, 2));
  }

  // actionablePrescription에서 우선순위 1인 항목
  const prescriptions = analysisData.actionablePrescription as Array<{
    priority: number;
    title: string;
  }> | undefined;

  if (prescriptions && prescriptions.length > 0) {
    prescriptions
      .filter((p) => p.priority === 1)
      .slice(0, 2)
      .forEach((p) => issues.push(p.title));
  }

  return [...new Set(issues)].slice(0, 5); // 중복 제거, 최대 5개
}

/**
 * 활성 취약점 조회
 */
async function getActiveWeaknesses(
  studentId: number
): Promise<AnalysisContextData['activeWeaknesses']> {
  const supabase = await createClient();

  const { data: weaknesses, error } = await supabase
    .from('student_weaknesses')
    .select('concept, severity, status, occurrence_count, first_detected_at')
    .eq('student_id', studentId)
    .in('status', ['active', 'recurring'])
    .order('severity', { ascending: false })
    .limit(10);

  if (error || !weaknesses || weaknesses.length === 0) {
    return undefined;
  }

  return weaknesses.map((w) => ({
    concept: w.concept,
    severity: w.severity,
    duration: calculateDuration(w.first_detected_at),
    attempts: w.occurrence_count,
  }));
}

/**
 * 활성 강점 조회
 */
async function getActiveStrengths(
  studentId: number
): Promise<AnalysisContextData['activeStrengths']> {
  const supabase = await createClient();

  const { data: strengths, error } = await supabase
    .from('student_strengths')
    .select('concept, level, status, confirmation_count')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('level', { ascending: false })
    .limit(10);

  if (error || !strengths || strengths.length === 0) {
    return undefined;
  }

  return strengths.map((s) => ({
    concept: s.concept,
    level: s.level,
    consistency: getConsistencyLabel(s.confirmation_count),
  }));
}

/**
 * 확인 횟수에 따른 일관성 레이블
 */
function getConsistencyLabel(confirmationCount: number): string {
  if (confirmationCount >= 5) return '매우 일관적';
  if (confirmationCount >= 3) return '일관적';
  if (confirmationCount >= 2) return '확인됨';
  return '초기 발견';
}

/**
 * 기간 계산 (first_detected_at ~ 현재)
 */
function calculateDuration(firstDetectedAt: string): string {
  const start = new Date(firstDetectedAt);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 7) return `${diffDays}일`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월`;
  return `${Math.floor(diffDays / 365)}년`;
}

/**
 * 현재 Growth Loop 상태 조회
 */
async function getCurrentGrowthLoop(
  studentId: number,
  reportType: ReportType
): Promise<{ microLoop?: MicroLoopData; macroLoop?: MacroLoopData } | null> {
  const supabase = await createClient();

  // 리포트 타입에 따라 조회할 루프 유형 결정
  const loopTypes = getLoopTypesForReport(reportType);

  if (loopTypes.length === 0) {
    return null;
  }

  const { data: loops, error } = await supabase
    .from('growth_loop_status')
    .select('*')
    .eq('student_id', studentId)
    .in('loop_type', loopTypes)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error || !loops || loops.length === 0) {
    return null;
  }

  const result: { microLoop?: MicroLoopData; macroLoop?: MacroLoopData } = {};

  for (const loop of loops) {
    if (loop.loop_type === 'micro_weekly' || loop.loop_type === 'micro_monthly') {
      result.microLoop = {
        loopType: loop.loop_type === 'micro_weekly' ? 'weekly' : 'monthly',
        cycleNumber: loop.cycle_number,
        previousGoals: (loop.goals as Array<{
          goal: string;
          achieved: boolean;
          achievementRate: number;
          notes: string;
        }>) || [],
        currentPerformance: (loop.performance_data as {
          metrics?: Array<{
            metric: string;
            target: number;
            actual: number;
            variance: number;
          }>;
        })?.metrics || [],
        adjustments: (loop.adjustments as Array<{
          area: string;
          previousSetting: string;
          newSetting: string;
          reason: string;
        }>) || [],
        nextCycleGoals: [],
        continuityScore: (loop.performance_data as { continuityScore?: number })?.continuityScore || 50,
        momentum: ((loop.performance_data as { momentum?: string })?.momentum as MicroLoopData['momentum']) || 'maintaining',
      };
    } else if (loop.loop_type === 'macro_semi_annual' || loop.loop_type === 'macro_annual') {
      result.macroLoop = {
        loopType: loop.loop_type === 'macro_semi_annual' ? 'semi_annual' : 'annual',
        longTermGoalProgress: (loop.goals as Array<{
          goal: string;
          startDate: string;
          targetDate: string;
          currentProgress: number;
          onTrack: boolean;
          adjustmentNeeded: string;
        }>) || [],
        strategyEffectiveness: [],
        patternAnalysis: {
          identifiedPatterns: [],
          positivePatterns: [],
          negativePatterns: [],
          interventionPlan: [],
        },
        baselineGrowth: (loop.performance_data as {
          baselineGrowth?: Array<{
            metric: string;
            baseline: number;
            current: number;
            growthPercentage: number;
            trajectory: 'above_expected' | 'on_track' | 'below_expected';
          }>;
        })?.baselineGrowth || [],
        nextCycleStrategy: {
          primaryObjectives: [],
          keyStrategies: [],
          resourceAllocation: [],
          riskFactors: [],
          contingencyPlans: [],
        },
      };
    }
  }

  return result;
}

/**
 * 리포트 타입에 따른 Growth Loop 유형 결정
 */
function getLoopTypesForReport(reportType: ReportType): string[] {
  switch (reportType) {
    case 'weekly':
      return ['micro_weekly'];
    case 'monthly':
      return ['micro_weekly', 'micro_monthly'];
    case 'semi_annual':
      return ['micro_monthly', 'macro_semi_annual'];
    case 'annual':
      return ['macro_semi_annual', 'macro_annual'];
    case 'test':
      return ['micro_weekly', 'micro_monthly'];
    default:
      return [];
  }
}

/**
 * 이전 리포트의 예측 vs 실제 결과 비교 데이터 생성
 */
async function getPreviousVisionData(
  studentId: number,
  recentReports: AnalysisContextData['recentReports']
): Promise<AnalysisContextData['previousVision']> {
  if (!recentReports || recentReports.length === 0) {
    return undefined;
  }

  const supabase = await createClient();

  // 가장 최근 리포트에서 예측 데이터 추출
  const { data: lastReport, error } = await supabase
    .from('reports')
    .select('id, analysis_data')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !lastReport) {
    return undefined;
  }

  const analysisData = lastReport.analysis_data as Record<string, unknown>;

  // futureVision 또는 growthPredictions에서 예측 추출
  const predictions: string[] = [];

  const futureVision = (analysisData.macroAnalysis as Record<string, unknown>)
    ?.futureVision as Record<string, string> | undefined;

  if (futureVision) {
    if (futureVision.threeMonths) predictions.push(futureVision.threeMonths);
    if (futureVision.sixMonths) predictions.push(futureVision.sixMonths);
  }

  const growthPredictions = analysisData.growthPredictions as Array<{
    timeframe: string;
    predictedScore: number;
    assumptions: string[];
  }> | undefined;

  if (growthPredictions && growthPredictions.length > 0) {
    growthPredictions.forEach((p) => {
      predictions.push(`${p.timeframe}: 예상 ${p.predictedScore}점`);
    });
  }

  if (predictions.length === 0) {
    return undefined;
  }

  // 실제 결과는 현재 분석에서 계산됨 (여기서는 placeholder)
  return {
    reportId: lastReport.id,
    predictions: predictions.slice(0, 3),
    actualOutcomes: [], // 실제 분석 시 채워짐
    accuracy: 0, // 실제 분석 시 계산됨
  };
}

// ============================================
// 메타프로필 업데이트 함수
// ============================================

/**
 * 학생의 메타프로필 업데이트
 */
export async function updateStudentMetaProfile(
  studentId: number,
  updates: Partial<StudentMetaProfile>,
  reportId?: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // 현재 프로필 조회
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select('meta_profile')
    .eq('id', studentId)
    .single();

  if (fetchError) {
    return { success: false, error: '학생 정보 조회 실패' };
  }

  const currentProfile = student?.meta_profile as StudentMetaProfile | null;

  // 프로필 병합
  const updatedProfile: StudentMetaProfile = mergeMetaProfile(
    currentProfile,
    updates
  );

  // 업데이트 실행
  const { error: updateError } = await supabase
    .from('students')
    .update({ meta_profile: updatedProfile })
    .eq('id', studentId);

  if (updateError) {
    return { success: false, error: '메타프로필 업데이트 실패' };
  }

  // 히스토리 기록 (트리거가 처리하지만 추가 정보 기록)
  if (reportId) {
    await supabase.from('student_meta_profile_history').insert({
      student_id: studentId,
      report_id: reportId,
      indicator_type: 'full_profile',
      previous_value: currentProfile,
      new_value: updatedProfile,
      change_reason: 'AI 분석 기반 자동 업데이트',
      changed_by: 'ai',
    });
  }

  return { success: true };
}

/**
 * 메타프로필 병합
 */
function mergeMetaProfile(
  current: StudentMetaProfile | null,
  updates: Partial<StudentMetaProfile>
): StudentMetaProfile {
  const now = new Date().toISOString();

  if (!current) {
    // 첫 프로필 생성
    return {
      baseline: updates.baseline || createEmptyBaseline(),
      errorSignature: updates.errorSignature || createEmptyErrorSignature(),
      absorptionRate: updates.absorptionRate || createEmptyAbsorptionRate(),
      solvingStamina: updates.solvingStamina || createEmptySolvingStamina(),
      metaCognitionLevel:
        updates.metaCognitionLevel || createEmptyMetaCognitionLevel(),
      lastUpdated: now,
      version: '1.0',
    };
  }

  return {
    baseline: current.baseline, // Baseline은 변경하지 않음 (level_test에서만 설정)
    errorSignature: updates.errorSignature
      ? mergeErrorSignature(current.errorSignature, updates.errorSignature)
      : current.errorSignature,
    absorptionRate: updates.absorptionRate
      ? mergeAbsorptionRate(current.absorptionRate, updates.absorptionRate)
      : current.absorptionRate,
    solvingStamina: updates.solvingStamina
      ? mergeSolvingStamina(current.solvingStamina, updates.solvingStamina)
      : current.solvingStamina,
    metaCognitionLevel: updates.metaCognitionLevel
      ? mergeMetaCognitionLevel(
          current.metaCognitionLevel,
          updates.metaCognitionLevel
        )
      : current.metaCognitionLevel,
    lastUpdated: now,
    version: current.version,
  };
}

// ============================================
// 빈 프로필 생성 함수
// ============================================

import type {
  Baseline,
  ErrorSignature,
  AbsorptionRate,
  SolvingStamina,
  MetaCognitionLevel,
} from '@/types';

function createEmptyBaseline(): Baseline {
  return {
    assessmentDate: '',
    levelTestReportId: undefined,
    initialLevel: {
      grade: 0,
      percentile: 0,
      evaluatedAt: '',
    },
    domainScores: [],
    initialStrengths: [],
    initialWeaknesses: [],
    initialLearningStyle: 'mixed',
  };
}

function createEmptyErrorSignature(): ErrorSignature {
  return {
    primaryErrorTypes: [],
    signaturePatterns: [],
    domainVulnerability: [],
    lastUpdated: new Date().toISOString(),
  };
}

function createEmptyAbsorptionRate(): AbsorptionRate {
  return {
    overallScore: 50,
    byDomain: [],
    learningType: 'steady-grower',
    optimalConditions: [],
    recentTrend: [],
    lastUpdated: new Date().toISOString(),
  };
}

function createEmptySolvingStamina(): SolvingStamina {
  return {
    overallScore: 50,
    optimalDuration: 60,
    accuracyBySequence: [],
    fatiguePattern: 'consistent',
    recoveryStrategies: [],
    lastUpdated: new Date().toISOString(),
  };
}

function createEmptyMetaCognitionLevel(): MetaCognitionLevel {
  return {
    overallScore: 50,
    subScores: {
      selfAssessmentAccuracy: 50,
      errorRecognition: 50,
      strategySelection: 50,
      timeManagement: 50,
    },
    developmentStage: 'developing',
    improvementAreas: [],
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================
// 프로필 병합 함수
// ============================================

function mergeErrorSignature(
  current: ErrorSignature,
  updates: Partial<ErrorSignature>
): ErrorSignature {
  const now = new Date().toISOString();

  return {
    primaryErrorTypes: updates.primaryErrorTypes || current.primaryErrorTypes,
    signaturePatterns: [
      ...new Set([
        ...current.signaturePatterns,
        ...(updates.signaturePatterns || []),
      ]),
    ].slice(0, 10), // 최대 10개
    domainVulnerability:
      updates.domainVulnerability || current.domainVulnerability,
    lastUpdated: now,
  };
}

function mergeAbsorptionRate(
  current: AbsorptionRate,
  updates: Partial<AbsorptionRate>
): AbsorptionRate {
  const now = new Date().toISOString();

  // 최근 트렌드 업데이트 (이동 평균)
  const newTrend = updates.recentTrend?.[0];
  const recentTrend = newTrend
    ? [...current.recentTrend, newTrend].slice(-6) // 최근 6개월
    : current.recentTrend;

  return {
    overallScore: updates.overallScore ?? current.overallScore,
    byDomain: updates.byDomain || current.byDomain,
    learningType: updates.learningType || current.learningType,
    optimalConditions: updates.optimalConditions || current.optimalConditions,
    recentTrend,
    lastUpdated: now,
  };
}

function mergeSolvingStamina(
  current: SolvingStamina,
  updates: Partial<SolvingStamina>
): SolvingStamina {
  const now = new Date().toISOString();

  return {
    overallScore: updates.overallScore ?? current.overallScore,
    optimalDuration: updates.optimalDuration ?? current.optimalDuration,
    accuracyBySequence:
      updates.accuracyBySequence || current.accuracyBySequence,
    fatiguePattern: updates.fatiguePattern || current.fatiguePattern,
    recoveryStrategies:
      updates.recoveryStrategies || current.recoveryStrategies,
    lastUpdated: now,
  };
}

function mergeMetaCognitionLevel(
  current: MetaCognitionLevel,
  updates: Partial<MetaCognitionLevel>
): MetaCognitionLevel {
  const now = new Date().toISOString();

  return {
    overallScore: updates.overallScore ?? current.overallScore,
    subScores: {
      selfAssessmentAccuracy:
        updates.subScores?.selfAssessmentAccuracy ??
        current.subScores.selfAssessmentAccuracy,
      errorRecognition:
        updates.subScores?.errorRecognition ??
        current.subScores.errorRecognition,
      strategySelection:
        updates.subScores?.strategySelection ??
        current.subScores.strategySelection,
      timeManagement:
        updates.subScores?.timeManagement ?? current.subScores.timeManagement,
    },
    developmentStage: updates.developmentStage || current.developmentStage,
    improvementAreas: updates.improvementAreas || current.improvementAreas,
    lastUpdated: now,
  };
}

// ============================================
// Growth Loop 관리 함수
// ============================================

/**
 * 새로운 Growth Loop 사이클 시작
 */
export async function startNewGrowthLoopCycle(
  studentId: number,
  loopType: 'micro_weekly' | 'micro_monthly' | 'macro_semi_annual' | 'macro_annual',
  goals: Array<{ goal: string; metric?: string; target?: number; deadline?: string }>
): Promise<{ success: boolean; cycleId?: number; error?: string }> {
  const supabase = await createClient();

  // 기존 활성 사이클 완료 처리
  await supabase
    .from('growth_loop_status')
    .update({ status: 'completed', cycle_end_date: new Date().toISOString().split('T')[0] })
    .eq('student_id', studentId)
    .eq('loop_type', loopType)
    .eq('status', 'active');

  // 마지막 사이클 번호 조회
  const { data: lastCycle } = await supabase
    .from('growth_loop_status')
    .select('cycle_number')
    .eq('student_id', studentId)
    .eq('loop_type', loopType)
    .order('cycle_number', { ascending: false })
    .limit(1)
    .single();

  const newCycleNumber = (lastCycle?.cycle_number || 0) + 1;

  // 새 사이클 생성
  const { data: newCycle, error } = await supabase
    .from('growth_loop_status')
    .insert({
      student_id: studentId,
      loop_type: loopType,
      cycle_number: newCycleNumber,
      cycle_start_date: new Date().toISOString().split('T')[0],
      status: 'active',
      goals,
      performance_data: {},
      adjustments: [],
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: 'Growth Loop 사이클 생성 실패' };
  }

  return { success: true, cycleId: newCycle?.id };
}

/**
 * Growth Loop 사이클 성과 데이터 업데이트
 */
export async function updateGrowthLoopPerformance(
  studentId: number,
  loopType: string,
  performanceData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('growth_loop_status')
    .update({
      performance_data: performanceData,
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId)
    .eq('loop_type', loopType)
    .eq('status', 'active');

  if (error) {
    return { success: false, error: 'Growth Loop 성과 업데이트 실패' };
  }

  return { success: true };
}

// ============================================
// 전략 피드백 데이터 수집 (Phase 2: 피드백 루프)
// ============================================

/**
 * 학생의 전략 피드백 데이터 조회
 * AI 분석에서 과거 전략 효과를 참조하여 새로운 전략 제안에 활용
 */
async function getStrategyFeedback(
  studentId: number
): Promise<StrategyFeedbackContext | undefined> {
  const supabase = await createClient();

  // 완료된 전략 데이터 조회
  const { data: strategies, error } = await supabase
    .from('strategy_tracking')
    .select('*')
    .eq('student_id', studentId)
    .eq('execution_status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(50);

  if (error || !strategies || strategies.length === 0) {
    return undefined;
  }

  // 효과적인 전략 타입 정의
  interface EffectiveStrategyData {
    type: string;
    title: string;
    concept: string | null;
    improvements: number[];
    count: number;
  }

  // 효과적인 전략 추출 (개선율 10% 이상)
  const effectiveStrategies = strategies
    .filter(s => (s.improvement_rate || 0) >= 10)
    .reduce((acc, s) => {
      const strategyContent = s.strategy_content as { type?: string; title?: string } | null;
      const key = `${strategyContent?.type}|${strategyContent?.title}`;
      const existing = acc.get(key);

      if (existing) {
        existing.improvements.push(s.improvement_rate || 0);
        existing.count++;
      } else {
        acc.set(key, {
          type: strategyContent?.type || 'unknown',
          title: strategyContent?.title || 'unknown',
          concept: s.target_concept,
          improvements: [s.improvement_rate || 0],
          count: 1,
        });
      }
      return acc;
    }, new Map<string, EffectiveStrategyData>());

  const effectiveList = (Array.from(effectiveStrategies.values()) as EffectiveStrategyData[])
    .filter(e => e.count >= 1)
    .map(e => ({
      type: e.type,
      title: e.title,
      concept: e.concept || undefined,
      avgImprovement: Math.round(e.improvements.reduce((a, b) => a + b, 0) / e.improvements.length * 10) / 10,
      successRate: 100, // 이미 10% 이상 필터링됨
      usageCount: e.count,
    }))
    .sort((a, b) => b.avgImprovement - a.avgImprovement)
    .slice(0, 5);

  // 비효과적인 전략 추출 (개선율 5% 미만)
  const ineffectiveStrategies = strategies
    .filter(s => (s.improvement_rate || 0) < 5)
    .slice(0, 5)
    .map(s => {
      const strategyContent = s.strategy_content as { type?: string; title?: string } | null;
      return {
        type: strategyContent?.type || 'unknown',
        title: strategyContent?.title || 'unknown',
        concept: s.target_concept || undefined,
        improvement: s.improvement_rate || 0,
        feedback: s.feedback || undefined,
      };
    });

  // 개념별 개선 현황
  const conceptMap = new Map<string, { total: number; count: number }>();
  strategies.forEach(s => {
    if (s.target_concept && s.improvement_rate !== null) {
      const existing = conceptMap.get(s.target_concept) || { total: 0, count: 0 };
      existing.total += s.improvement_rate;
      existing.count++;
      conceptMap.set(s.target_concept, existing);
    }
  });

  const conceptImprovements = Array.from(conceptMap.entries())
    .map(([concept, data]) => ({
      concept,
      totalImprovement: Math.round(data.total * 10) / 10,
      occurrenceCount: data.count,
    }))
    .sort((a, b) => b.totalImprovement - a.totalImprovement)
    .slice(0, 10);

  // 전략 유형별 통계
  const typeMap = new Map<string, { improvements: number[]; completed: number; total: number }>();
  strategies.forEach(s => {
    const strategyContent = s.strategy_content as { type?: string } | null;
    const type = strategyContent?.type || 'unknown';
    const existing = typeMap.get(type) || { improvements: [], completed: 0, total: 0 };
    existing.total++;
    if (s.execution_status === 'completed') {
      existing.completed++;
      if (s.improvement_rate !== null) {
        existing.improvements.push(s.improvement_rate);
      }
    }
    typeMap.set(type, existing);
  });

  const typeStats = Array.from(typeMap.entries()).map(([type, data]) => ({
    type,
    avgImprovement: data.improvements.length > 0
      ? Math.round(data.improvements.reduce((a, b) => a + b, 0) / data.improvements.length * 10) / 10
      : 0,
    completionRate: Math.round((data.completed / Math.max(data.total, 1)) * 100),
    successRate: data.improvements.length > 0
      ? Math.round(data.improvements.filter(i => i >= 10).length / data.improvements.length * 100)
      : 0,
  }));

  // 전체 통계
  const completedStrategies = strategies.filter(s => s.execution_status === 'completed');
  const withImprovement = completedStrategies.filter(s => s.improvement_rate !== null);

  const overallStats = {
    totalStrategies: strategies.length,
    completedCount: completedStrategies.length,
    avgImprovement: withImprovement.length > 0
      ? Math.round(withImprovement.reduce((sum, s) => sum + (s.improvement_rate || 0), 0) / withImprovement.length * 10) / 10
      : 0,
    successRate: withImprovement.length > 0
      ? Math.round(withImprovement.filter(s => (s.improvement_rate || 0) >= 10).length / withImprovement.length * 100)
      : 0,
  };

  return {
    effectiveStrategies: effectiveList,
    ineffectiveStrategies,
    conceptImprovements,
    typeStats,
    overallStats,
  };
}

// ============================================
// Phase 2: 지식 추적 및 망각 곡선 관련 함수
// ============================================

import { KNOWLEDGE_GRAPH } from './knowledge-graph';
import type { MasteredSkillRecord } from './predictive-analysis';

/**
 * 개념명을 미세 스킬 ID로 매핑
 * 취약점 개념명에서 관련 미세 스킬 ID를 찾습니다.
 */
function mapConceptToSkillIds(concept: string): string[] {
  const matchedIds: string[] = [];
  const conceptLower = concept.toLowerCase();

  for (const [skillId, skill] of Object.entries(KNOWLEDGE_GRAPH)) {
    const skillNameLower = skill.name.toLowerCase();
    const skillDescLower = skill.description.toLowerCase();

    // 부분 매칭: 개념이 스킬명이나 설명에 포함되어 있는지 확인
    if (
      skillNameLower.includes(conceptLower) ||
      conceptLower.includes(skillNameLower) ||
      skillDescLower.includes(conceptLower)
    ) {
      matchedIds.push(skillId);
    }
  }

  if (matchedIds.length === 0) {
    console.warn(`[KnowledgeGraph] No micro-skill match for concept: ${concept}`);
  }

  return matchedIds;
}

/**
 * 학생의 실패한 미세 스킬 목록 조회
 * 활성 취약점과 최근 오답 패턴에서 관련 미세 스킬 ID를 추출합니다.
 */
export async function getFailedMicroSkills(
  studentId: number
): Promise<string[]> {
  const supabase = await createClient();

  // 1. 활성 취약점에서 개념 가져오기
  const { data: weaknesses } = await supabase
    .from('student_weaknesses')
    .select('concept')
    .eq('student_id', studentId)
    .in('status', ['active', 'recurring'])
    .order('severity', { ascending: false })
    .limit(5);

  const failedSkillIds: string[] = [];

  // 2. 각 취약 개념을 미세 스킬 ID로 매핑
  if (weaknesses) {
    for (const w of weaknesses) {
      const skillIds = mapConceptToSkillIds(w.concept);
      failedSkillIds.push(...skillIds);
    }
  }

  // 3. 중복 제거 후 반환
  return [...new Set(failedSkillIds)];
}

/**
 * 학생의 마스터한 스킬 목록 조회 (망각 곡선 분석용)
 * 해결된 취약점과 확인된 강점에서 마스터된 스킬 정보를 추출합니다.
 */
export async function getMasteredSkills(
  studentId: number
): Promise<MasteredSkillRecord[]> {
  const supabase = await createClient();

  // 1. 해결된 취약점 조회 (resolved 상태)
  const { data: resolvedWeaknesses } = await supabase
    .from('student_weaknesses')
    .select('concept, resolved_at')
    .eq('student_id', studentId)
    .eq('status', 'resolved')
    .not('resolved_at', 'is', null)
    .order('resolved_at', { ascending: false })
    .limit(10);

  // 2. 확인된 강점 조회
  const { data: confirmedStrengths } = await supabase
    .from('student_strengths')
    .select('concept, last_confirmed_at, confirmation_count')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('last_confirmed_at', { ascending: false })
    .limit(10);

  const masteredSkills: MasteredSkillRecord[] = [];

  // 3. 해결된 취약점을 마스터 스킬로 변환
  if (resolvedWeaknesses) {
    for (const w of resolvedWeaknesses) {
      const skillIds = mapConceptToSkillIds(w.concept);
      for (const skillId of skillIds) {
        const skill = KNOWLEDGE_GRAPH[skillId];
        if (skill) {
          masteredSkills.push({
            skillId,
            skillName: skill.name,
            lastMasteredDate: w.resolved_at || new Date().toISOString(),
            memoryStrength: 3, // 해결된 취약점은 기본 강도 3
          });
        }
      }
    }
  }

  // 4. 확인된 강점을 마스터 스킬로 변환
  if (confirmedStrengths) {
    for (const s of confirmedStrengths) {
      const skillIds = mapConceptToSkillIds(s.concept);
      for (const skillId of skillIds) {
        const skill = KNOWLEDGE_GRAPH[skillId];
        if (skill) {
          // 이미 추가된 스킬은 중복 방지
          if (!masteredSkills.find(ms => ms.skillId === skillId)) {
            masteredSkills.push({
              skillId,
              skillName: skill.name,
              lastMasteredDate: s.last_confirmed_at || new Date().toISOString(),
              memoryStrength: Math.min(s.confirmation_count + 2, 10), // 확인 횟수에 따라 강도 증가
            });
          }
        }
      }
    }
  }

  return masteredSkills;
}

// ============================================
// RAG 기억 서랍: 유사도 기반 과거 메모리 검색
// ============================================

/**
 * 쿼리 텍스트와 의미적으로 유사한 과거 리포트 메모리 검색
 *
 * @param studentId 학생 ID
 * @param queryText 현재 분석 컨텍스트 (시험명 + 범위 등)
 * @param options 검색 옵션
 */
export async function retrieveRelevantMemories(
  studentId: number,
  queryText: string,
  options?: {
    limit?: number;
    threshold?: number;
    excludeReportId?: number;
  }
): Promise<RelevantMemory[]> {
  const { limit = 5, threshold = 0.65, excludeReportId } = options ?? {};

  // 쿼리 텍스트를 임베딩으로 변환 (서버 사이드 전용)
  const { generateEmbedding } = await import('./embedding-service');
  const queryEmbedding = await generateEmbedding(queryText);

  const supabase = createAdminClient();

  // pgvector RPC를 통한 코사인 유사도 검색
  const { data, error } = await supabase.rpc('match_report_memories', {
    query_embedding: queryEmbedding,
    target_student_id: studentId,
    match_threshold: threshold,
    match_count: limit,
    exclude_report_id: excludeReportId ?? null,
  });

  if (error) {
    console.warn('[RAG] 기억 검색 실패:', error.message);
    throw new Error(`RAG 기억 검색 실패: ${error.message}`);
  }

  return (data ?? []).map((row: {
    report_id: number;
    report_type: string;
    test_date: string | null;
    source_type: string;
    source_text: string;
    similarity: number;
  }) => ({
    reportId: row.report_id,
    reportType: row.report_type,
    testDate: row.test_date,
    sourceType: row.source_type,
    text: row.source_text.slice(0, 200),
    similarity: Math.round(row.similarity * 100) / 100,
  }));
}
