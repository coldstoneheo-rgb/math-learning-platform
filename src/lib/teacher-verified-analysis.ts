import type {
  ActionablePrescriptionItem,
  AnalysisData,
  AnyAnalysisData,
  DetailedProblemAnalysis,
  GrowthPrediction,
  LearningHabit,
  ReportProcessingStatus,
  ReportProcessingTrace,
  RiskFactor,
  SwotData,
  TestResults,
  VerifiedDerivedGuidance,
} from '@/types';

export type VerificationDraft = {
  totalScore: number;
  maxScore: number;
  rank: number | '';
  totalStudents: number | '';
  correctRateByPoint: { name: string; value: number; total: number }[];
  detailedAnalysis: DetailedProblemAnalysis[];
  verificationNote: string;
};

export const DERIVED_GUIDANCE_EXCLUDED_NOTE =
  '교사가 AI 초안의 채점/문항 판정을 보정했으므로, AI 초안에서 파생된 약점·처방·성장 예측은 최종 성장 데이터에서 제외했습니다. 확정값 기준의 새 처방은 후속 리포트 또는 교사 코멘트로 보완하세요.';

const GROWTH_CRITICAL_ADJUSTMENT_FIELDS = new Set([
  'totalScore',
  'maxScore',
  'rank',
  'totalStudents',
  'correctRateByPoint',
  'detailedAnalysis',
]);

export const toNumberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const cloneDetailedAnalysis = (items?: DetailedProblemAnalysis[]): DetailedProblemAnalysis[] =>
  (items || []).map((item) => ({ ...item }));

export const buildVerificationDraft = (
  analysisData: AnalysisData,
  fallbackMaxScore: number
): VerificationDraft => ({
  totalScore: toNumberOrZero(analysisData.testResults?.totalScore),
  maxScore: toNumberOrZero(analysisData.testResults?.maxScore || fallbackMaxScore),
  rank: analysisData.testResults?.rank || '',
  totalStudents: analysisData.testResults?.totalStudents || '',
  correctRateByPoint: (analysisData.testResults?.correctRateByPoint || []).map((item) => ({ ...item })),
  detailedAnalysis: cloneDetailedAnalysis(analysisData.detailedAnalysis),
  verificationNote: '',
});

export const detectAdjustedFields = (analysisData: AnalysisData, draft: VerificationDraft): string[] => {
  const adjusted = new Set<string>();
  const originalResults = analysisData.testResults;

  if (originalResults?.totalScore !== draft.totalScore) adjusted.add('totalScore');
  if (originalResults?.maxScore !== draft.maxScore) adjusted.add('maxScore');
  if ((originalResults?.rank || '') !== draft.rank) adjusted.add('rank');
  if ((originalResults?.totalStudents || '') !== draft.totalStudents) adjusted.add('totalStudents');

  draft.correctRateByPoint.forEach((row, index) => {
    const original = originalResults?.correctRateByPoint?.[index];
    if (!original || original.name !== row.name || original.value !== row.value || original.total !== row.total) {
      adjusted.add('correctRateByPoint');
    }
  });

  draft.detailedAnalysis.forEach((item, index) => {
    const original = analysisData.detailedAnalysis?.[index];
    if (!original || original.isCorrect !== item.isCorrect || original.errorType !== item.errorType) {
      adjusted.add('detailedAnalysis');
    }
  });

  if (draft.verificationNote.trim()) adjusted.add('verificationNote');
  return Array.from(adjusted);
};

export const hasGrowthCriticalAdjustments = (adjustedFields: string[]): boolean =>
  adjustedFields.some((field) => GROWTH_CRITICAL_ADJUSTMENT_FIELDS.has(field));

export const excludeDraftDerivedGuidance = (analysisData: AnalysisData): AnalysisData => ({
  ...analysisData,
  macroAnalysis: {
    ...analysisData.macroAnalysis,
    summary: `${analysisData.macroAnalysis?.summary || '분석 결과'}\n\n[교사 보정] ${DERIVED_GUIDANCE_EXCLUDED_NOTE}`,
    oneLineSummary: analysisData.macroAnalysis?.oneLineSummary,
    strengths: '',
    weaknesses: '',
    errorPattern: '',
    futureVision: undefined,
    weaknessFlow: undefined,
    mathCapability: undefined,
  },
  actionablePrescription: [],
  growthPredictions: [],
  riskFactors: [],
  swotAnalysis: undefined,
  trendComment: DERIVED_GUIDANCE_EXCLUDED_NOTE,
});

export const applyRegeneratedDerivedGuidance = (
  analysisData: AnalysisData,
  derivedGuidance: VerifiedDerivedGuidance
): AnalysisData => ({
  ...analysisData,
  macroAnalysis: derivedGuidance.macroAnalysis,
  actionablePrescription: derivedGuidance.actionablePrescription,
  growthPredictions: derivedGuidance.growthPredictions,
  learningHabits: derivedGuidance.learningHabits,
  riskFactors: derivedGuidance.riskFactors,
  swotAnalysis: derivedGuidance.swotAnalysis,
  trendComment: derivedGuidance.trendComment,
  teacherVerified: analysisData.teacherVerified
    ? {
        ...analysisData.teacherVerified,
        derivedGuidanceStatus: 'regenerated_from_teacher_verified',
        derivedGuidanceRegeneratedAt: new Date().toISOString(),
        derivedGuidanceError: undefined,
      }
    : analysisData.teacherVerified,
});

export const markDerivedGuidanceRegenerationFailed = (
  analysisData: AnalysisData,
  error: string
): AnalysisData => ({
  ...analysisData,
  teacherVerified: analysisData.teacherVerified
    ? {
        ...analysisData.teacherVerified,
        derivedGuidanceStatus: 'excluded_after_teacher_adjustment',
        derivedGuidanceError: error,
      }
    : analysisData.teacherVerified,
});

export const getVerificationError = (draft: VerificationDraft): string | null => {
  if (draft.maxScore <= 0) return '만점은 1점 이상이어야 합니다.';
  if (draft.totalScore < 0) return '최종 점수는 0점 이상이어야 합니다.';
  if (draft.totalScore > draft.maxScore) return '최종 점수는 만점을 초과할 수 없습니다.';
  if (draft.rank !== '' && draft.rank < 1) return '석차는 1 이상이어야 합니다.';
  if (draft.totalStudents !== '' && draft.totalStudents < 1) return '전체 인원은 1 이상이어야 합니다.';
  if (draft.rank !== '' && draft.totalStudents !== '' && draft.rank > draft.totalStudents) {
    return '석차는 전체 인원보다 클 수 없습니다.';
  }

  for (const row of draft.correctRateByPoint) {
    if (row.value < 0 || row.total < 0) return '배점별 정답 수와 전체 수는 0 이상이어야 합니다.';
    if (row.value > row.total) return `${row.name} 정답 수는 전체 수를 초과할 수 없습니다.`;
  }

  return null;
};

export const buildTeacherVerifiedAnalysis = (
  analysisData: AnalysisData,
  draft: VerificationDraft
): AnalysisData => {
  const adjustedFields = detectAdjustedFields(analysisData, draft);
  const shouldExcludeDraftGuidance = hasGrowthCriticalAdjustments(adjustedFields);
  const sourceAnalysis = shouldExcludeDraftGuidance
    ? excludeDraftDerivedGuidance(analysisData)
    : analysisData;
  const verifiedResults: TestResults = {
    ...(analysisData.testResults || {}),
    totalScore: draft.totalScore,
    maxScore: draft.maxScore,
    rank: draft.rank === '' ? 0 : draft.rank,
    totalStudents: draft.totalStudents === '' ? 0 : draft.totalStudents,
    correctRateByPoint: draft.correctRateByPoint.map((item) => ({ ...item })),
  };
  const verifiedDetailed = cloneDetailedAnalysis(draft.detailedAnalysis);

  return {
    ...sourceAnalysis,
    testResults: verifiedResults,
    detailedAnalysis: verifiedDetailed,
    verificationStatus: 'teacher_verified',
    aiInferred: {
      capturedAt: new Date().toISOString(),
      testResults: analysisData.testResults ? { ...analysisData.testResults } : undefined,
      detailedAnalysis: cloneDetailedAnalysis(analysisData.detailedAnalysis),
      note: 'Original AI-inferred values before teacher correction. Do not use as final grading truth.',
    },
    teacherVerified: {
      verifiedAt: new Date().toISOString(),
      testResults: verifiedResults,
      detailedAnalysis: verifiedDetailed,
      verificationNote: draft.verificationNote.trim() || undefined,
      adjustedFields,
      derivedGuidanceStatus: shouldExcludeDraftGuidance
        ? 'excluded_after_teacher_adjustment'
        : 'ai_draft_retained',
    },
  };
};

export function assertCompleteVerifiedDerivedGuidance(
  value: VerifiedDerivedGuidance
): VerifiedDerivedGuidance {
  const macro = value.macroAnalysis;
  const hasMacro =
    Boolean(macro?.summary?.trim()) &&
    Boolean(macro?.strengths?.trim()) &&
    Boolean(macro?.weaknesses?.trim()) &&
    Boolean(macro?.errorPattern?.trim());

  if (
    !hasMacro ||
    !Array.isArray(value.actionablePrescription) ||
    value.actionablePrescription.length === 0 ||
    !Array.isArray(value.growthPredictions) ||
    value.growthPredictions.length === 0 ||
    !Array.isArray(value.learningHabits) ||
    value.learningHabits.length === 0 ||
    !Array.isArray(value.riskFactors) ||
    value.riskFactors.length === 0 ||
    !value.swotAnalysis ||
    !value.trendComment?.trim()
  ) {
    throw new Error('교사 확정 기반 파생 분석의 필수 성장 섹션이 누락되었습니다.');
  }

  return value;
}

export type DownstreamTraceKey = NonNullable<ReportProcessingTrace['downstream']> extends infer Downstream
  ? keyof Downstream
  : never;

export function buildInitialProcessingTrace(analysisData: AnalysisData): ReportProcessingTrace {
  return {
    savedAt: new Date().toISOString(),
    sourceOfTruth: analysisData.verificationStatus === 'teacher_verified'
      ? 'teacher_verified'
      : 'ai_draft',
    teacherVerification: analysisData.teacherVerified
      ? {
          status: 'verified',
          adjustedFields: [...analysisData.teacherVerified.adjustedFields],
          derivedGuidanceStatus: analysisData.teacherVerified.derivedGuidanceStatus,
        }
      : {
          status: 'not_required',
          adjustedFields: [],
        },
    downstream: {},
  };
}

export function attachProcessingTrace(
  analysisData: AnalysisData,
  trace: ReportProcessingTrace
): AnalysisData {
  return {
    ...analysisData,
    processingTrace: trace,
  };
}

export function updateDownstreamTrace(
  trace: ReportProcessingTrace,
  key: DownstreamTraceKey,
  status: ReportProcessingStatus,
  message?: string
): ReportProcessingTrace {
  return {
    ...trace,
    downstream: {
      ...trace.downstream,
      [key]: {
        status,
        message,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

export function hasUsableVerifiedDerivedGuidance(analysisData?: AnalysisData | null): boolean {
  return analysisData?.teacherVerified?.derivedGuidanceStatus !== 'excluded_after_teacher_adjustment';
}

export type DisplayableDerivedGuidance = {
  canShowDerivedGuidance: boolean;
  actionablePrescription: ActionablePrescriptionItem[];
  growthPredictions: GrowthPrediction[];
  learningHabits: LearningHabit[];
  riskFactors: RiskFactor[];
  swotAnalysis?: SwotData;
  futureVision?: AnalysisData['macroAnalysis']['futureVision'];
  weaknessFlow?: AnalysisData['macroAnalysis']['weaknessFlow'];
  mathCapability?: AnalysisData['macroAnalysis']['mathCapability'];
};

export function getDisplayableDerivedGuidance(
  analysisData?: AnalysisData | null
): DisplayableDerivedGuidance {
  const canShowDerivedGuidance = hasUsableVerifiedDerivedGuidance(analysisData);

  if (!analysisData || !canShowDerivedGuidance) {
    return {
      canShowDerivedGuidance,
      actionablePrescription: [],
      growthPredictions: [],
      learningHabits: [],
      riskFactors: [],
    };
  }

  return {
    canShowDerivedGuidance,
    actionablePrescription: analysisData.actionablePrescription || [],
    growthPredictions: analysisData.growthPredictions || [],
    learningHabits: analysisData.learningHabits || [],
    riskFactors: analysisData.riskFactors || [],
    swotAnalysis: analysisData.swotAnalysis,
    futureVision: analysisData.macroAnalysis?.futureVision,
    weaknessFlow: analysisData.macroAnalysis?.weaknessFlow,
    mathCapability: analysisData.macroAnalysis?.mathCapability,
  };
}

export function canShowStudentDerivedNarrative(analysisData?: AnalysisData | null): boolean {
  return hasUsableVerifiedDerivedGuidance(analysisData);
}

export type GuidanceSelectableReport = {
  report_type: string;
  analysis_data?: AnalysisData | AnyAnalysisData | null;
};

export type GrowthTruthDashboardReport = GuidanceSelectableReport & {
  id?: number | string;
  test_name?: string | null;
  test_date?: string | null;
  created_at?: string | null;
};

export type DashboardGrowthTruthSummary = {
  reportId?: number | string;
  reportType: string;
  reportTitle: string;
  reportDate?: string | null;
  readiness: GrowthReadinessSummary;
  brief: GrowthTruthBrief;
  canShowDerivedGuidance: boolean;
};

const parseTimestamp = (rawDate?: string | null): number => {
  if (!rawDate) return 0;

  const parsed = Date.parse(rawDate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getReportIdNumber = (report: GrowthTruthDashboardReport): number => {
  const parsed = Number(report.id);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function getDashboardGrowthTruthSummary(
  reports: GrowthTruthDashboardReport[] | undefined | null
): DashboardGrowthTruthSummary | null {
  const latest = (reports || [])
    .filter((report) => report.report_type === 'test' || report.report_type === 'level_test')
    .map((report, index) => ({ report, index }))
    .sort((a, b) => {
      const testDateDiff = parseTimestamp(b.report.test_date) - parseTimestamp(a.report.test_date);
      if (testDateDiff !== 0) return testDateDiff;

      const createdAtDiff = parseTimestamp(b.report.created_at) - parseTimestamp(a.report.created_at);
      if (createdAtDiff !== 0) return createdAtDiff;

      const idDiff = getReportIdNumber(b.report) - getReportIdNumber(a.report);
      if (idDiff !== 0) return idDiff;

      return a.index - b.index;
    })[0]?.report;

  if (!latest) return null;

  const analysisData = latest.analysis_data as AnalysisData | undefined;
  const displayable = getDisplayableDerivedGuidance(analysisData);

  return {
    reportId: latest.id,
    reportType: latest.report_type,
    reportTitle: latest.test_name || (latest.report_type === 'level_test' ? '레벨 테스트' : '시험 분석'),
    reportDate: latest.test_date || latest.created_at,
    readiness: summarizeGrowthReadiness(analysisData, latest.report_type),
    brief: getGrowthTruthBrief(analysisData, latest.report_type),
    canShowDerivedGuidance: displayable.canShowDerivedGuidance,
  };
}

export function selectLatestDisplayableGuidanceWithSection(
  reports: GuidanceSelectableReport[] | undefined | null,
  hasSection: (guidance: DisplayableDerivedGuidance) => boolean
): DisplayableDerivedGuidance {
  const testReports = (reports || []).filter(
    (report) => report.report_type === 'test' || report.report_type === 'level_test'
  );

  for (const report of testReports) {
    const analysisData = report.analysis_data as AnalysisData | undefined;
    const displayableGuidance = getDisplayableDerivedGuidance(analysisData);

    if (hasSection(displayableGuidance)) return displayableGuidance;
    if (analysisData?.teacherVerified?.derivedGuidanceStatus === 'excluded_after_teacher_adjustment') {
      return displayableGuidance;
    }
  }

  return getDisplayableDerivedGuidance(undefined);
}

export function getVerifiedGuidanceDisplayStatus(analysisData?: AnalysisData | null): {
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'neutral';
} | null {
  switch (analysisData?.teacherVerified?.derivedGuidanceStatus) {
    case 'regenerated_from_teacher_verified':
      return {
        label: '교사 확정값 기반 분석',
        description: '선생님이 확인한 채점과 문항 판정을 기준으로 약점, 처방, 성장 비전을 다시 생성했습니다.',
        tone: 'success',
      };
    case 'excluded_after_teacher_adjustment':
      return {
        label: '교사 확정 완료, 성장 처방 보류',
        description: '점수와 문항 판정은 선생님이 확인한 값입니다. 확정값 기반 성장 처방은 아직 사용할 수 없어 AI 초안 처방을 표시하지 않습니다.',
        tone: 'warning',
      };
    case 'ai_draft_retained':
      return {
        label: 'AI 초안 기반, 교사 확인 완료',
        description: '선생님이 AI 분석 초안을 확인한 뒤 최종 리포트로 공개했습니다.',
        tone: 'neutral',
      };
    default:
      return null;
  }
}

export type ParentGrowthTruthSnapshot = {
  headline: string;
  description: string;
  sourceLabel: string;
  guidanceState: 'available' | 'withheld' | 'legacy';
  visibleSections: string[];
  withheldSections: string[];
  tone: 'success' | 'warning' | 'neutral';
};

export function getParentGrowthTruthSnapshot(
  analysisData?: AnalysisData | null
): ParentGrowthTruthSnapshot | null {
  if (!analysisData) return null;

  const displayable = getDisplayableDerivedGuidance(analysisData);
  const visibleSections = [
    analysisData.detailedAnalysis?.length ? '문항별 분석' : null,
    displayable.actionablePrescription.length ? '학습 처방' : null,
    displayable.growthPredictions.length ? '성장 예측' : null,
    displayable.futureVision ? '미래 비전' : null,
    displayable.learningHabits.length ? '학습 습관' : null,
    displayable.riskFactors.length ? '주의 요인' : null,
  ].filter(Boolean) as string[];

  if (analysisData.teacherVerified?.derivedGuidanceStatus === 'excluded_after_teacher_adjustment') {
    return {
      headline: '점수와 문항 판정은 교사 확정값입니다.',
      description:
        '선생님이 AI 초안의 채점 또는 문항 판정을 보정했기 때문에, 초안에서 만든 성장 처방과 예측은 표시하지 않습니다. 확정값 기준 처방은 후속 리포트나 교사 코멘트로 보완됩니다.',
      sourceLabel: '교사 확정값',
      guidanceState: 'withheld',
      visibleSections: visibleSections.length ? visibleSections : ['확정 점수', '문항별 분석'],
      withheldSections: ['학습 처방', '성장 예측', '미래 비전', '학습 습관', '주의 요인'],
      tone: 'warning',
    };
  }

  if (analysisData.teacherVerified?.derivedGuidanceStatus === 'regenerated_from_teacher_verified') {
    return {
      headline: '교사 확정값을 기준으로 성장 방향을 다시 계산했습니다.',
      description:
        '선생님이 확인한 채점과 문항 판정을 바탕으로 약점, 처방, 성장 비전을 다시 만들었습니다. 현재 리포트의 성장 안내는 확정 데이터 기준입니다.',
      sourceLabel: '교사 확정값 기반 재분석',
      guidanceState: 'available',
      visibleSections,
      withheldSections: [],
      tone: 'success',
    };
  }

  if (analysisData.teacherVerified?.derivedGuidanceStatus === 'ai_draft_retained') {
    return {
      headline: 'AI 초안을 선생님이 확인한 리포트입니다.',
      description:
        '채점과 문항 판정에 큰 보정 없이 공개된 리포트입니다. 성장 처방과 예측은 AI 초안을 바탕으로 하되, 선생님 확인을 거친 참고 자료로 읽어 주세요.',
      sourceLabel: 'AI 초안, 교사 확인',
      guidanceState: 'available',
      visibleSections,
      withheldSections: [],
      tone: 'neutral',
    };
  }

  return {
    headline: '기존 분석 데이터를 기준으로 성장 방향을 보여줍니다.',
    description:
      '이 리포트는 교사 확정 메타데이터가 도입되기 전의 형식입니다. 표시된 성장 처방과 예측은 기존 AI 분석 결과로, 다음 리포트에서 교사 확인 데이터와 함께 더 정확히 보정됩니다.',
    sourceLabel: '기존 AI 분석',
    guidanceState: 'legacy',
    visibleSections,
    withheldSections: [],
    tone: 'neutral',
  };
}

export type StudentGrowthTruthNotice = {
  label: string;
  headline: string;
  description: string;
  guidanceState: 'available' | 'withheld' | 'legacy';
  tone: 'success' | 'warning' | 'neutral';
};

export function getStudentGrowthTruthNotice(
  analysisData?: AnalysisData | null,
  reportType?: string | null
): StudentGrowthTruthNotice | null {
  if (!analysisData || (reportType !== 'test' && reportType !== 'level_test')) return null;

  switch (analysisData.teacherVerified?.derivedGuidanceStatus) {
    case 'excluded_after_teacher_adjustment':
      return {
        label: '선생님 확인 완료',
        headline: '점수와 문항 판정은 선생님이 확인한 값이에요.',
        description:
          '이전 분석 초안의 공부 방법과 성장 예측은 지금의 확정값과 맞지 않을 수 있어 잠시 숨겨두었어요. 확정값을 기준으로 한 성장 방향은 선생님 설명이나 다음 리포트에서 이어서 확인할 수 있어요.',
        guidanceState: 'withheld',
        tone: 'warning',
      };
    case 'regenerated_from_teacher_verified':
      return {
        label: '확정값 기반 성장 안내',
        headline: '선생님이 확인한 값을 기준으로 성장 방향을 다시 정리했어요.',
        description:
          '현재 보이는 공부 방법과 성장 예측은 확정된 점수와 문항 판정을 바탕으로 다시 만든 안내예요. 지금 리포트를 기준으로 다음 학습을 이어가면 됩니다.',
        guidanceState: 'available',
        tone: 'success',
      };
    case 'ai_draft_retained':
      return {
        label: '선생님 확인 리포트',
        headline: '이 리포트는 선생님 확인을 거친 분석이에요.',
        description:
          '점수와 문항 판정에 큰 보정이 없어 현재 보이는 공부 방법과 성장 예측을 참고할 수 있어요. 중요한 결정은 선생님 설명과 함께 확인해 주세요.',
        guidanceState: 'available',
        tone: 'neutral',
      };
    default:
      return {
        label: '기존 성장 분석',
        headline: '기존 분석 데이터를 기준으로 성장 방향을 보여줘요.',
        description:
          '이전 형식의 리포트라 선생님 확인 상태가 따로 표시되지는 않아요. 다음 시험 리포트부터는 확정값 기준으로 더 분명하게 성장 흐름을 확인할 수 있어요.',
        guidanceState: 'legacy',
        tone: 'neutral',
      };
  }
}

export function summarizeProcessingTrace(trace?: ReportProcessingTrace | null): {
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} | null {
  if (!trace) return null;

  const downstream = Object.values(trace.downstream || {});
  if (downstream.some((step) => step?.status === 'failed')) {
    return {
      label: '성장 데이터 보완 필요',
      description: '리포트는 저장됐지만 일부 성장 데이터 반영 단계가 실패했습니다. 아래 항목을 확인해 주세요.',
      tone: 'danger',
    };
  }

  if (downstream.some((step) => step?.status === 'skipped')) {
    return {
      label: '성장 데이터 일부 보류',
      description: '확정값은 저장됐고 가능한 항목은 반영됐습니다. 일부 후속 단계는 조건이 맞지 않아 건너뛰었습니다.',
      tone: 'warning',
    };
  }

  if (downstream.length > 0 && downstream.every((step) => step?.status === 'success')) {
    return {
      label: '성장 데이터 반영 완료',
      description: '이 리포트의 확정 데이터가 주요 장기 성장 데이터 흐름에 반영되었습니다.',
      tone: 'success',
    };
  }

  return {
    label: '성장 데이터 반영 기록 대기',
    description: '저장 기록은 있으나 후속 반영 결과가 아직 충분히 남아 있지 않습니다.',
    tone: 'neutral',
  };
}

export type GrowthReadinessSummary = {
  label: string;
  description: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  needsAttention: boolean;
};

export function summarizeGrowthReadiness(
  analysisData?: AnalysisData | null,
  reportType?: string | null
): GrowthReadinessSummary {
  const traceSummary = summarizeProcessingTrace(analysisData?.processingTrace);

  if (traceSummary?.tone === 'danger') {
    return {
      ...traceSummary,
      needsAttention: true,
    };
  }

  if (analysisData?.teacherVerified?.derivedGuidanceStatus === 'excluded_after_teacher_adjustment') {
    return {
      label: '성장 처방 보류',
      description: '점수와 문항 판정은 교사 확정값입니다. 확정값 기반 약점, 처방, 성장 예측은 아직 보완이 필요합니다.',
      tone: 'warning',
      needsAttention: true,
    };
  }

  if (traceSummary?.tone === 'warning') {
    return {
      ...traceSummary,
      needsAttention: true,
    };
  }

  if (analysisData?.teacherVerified?.derivedGuidanceStatus === 'regenerated_from_teacher_verified') {
    return {
      label: '교사 확정값 기반',
      description: '교사 확정 채점과 문항 판정을 기준으로 성장 안내를 다시 생성했습니다.',
      tone: 'success',
      needsAttention: false,
    };
  }

  if (analysisData?.teacherVerified?.derivedGuidanceStatus === 'ai_draft_retained') {
    return {
      label: 'AI 초안 확인 완료',
      description: 'AI 초안 성장 안내를 교사가 확인한 뒤 공개한 리포트입니다.',
      tone: 'neutral',
      needsAttention: false,
    };
  }

  if (traceSummary?.tone === 'success') {
    return {
      ...traceSummary,
      needsAttention: false,
    };
  }

  if (reportType === 'test' || reportType === 'level_test') {
    return {
      label: '기존 AI 분석',
      description: '교사 확정 메타데이터 도입 전 리포트입니다. 다음 리포트에서 확정값 기준으로 더 정확히 보정됩니다.',
      tone: 'neutral',
      needsAttention: false,
    };
  }

  return {
    label: '성장 흐름 참고',
    description: '이 리포트는 장기 성장 흐름을 보조하는 참고 데이터입니다.',
    tone: 'neutral',
    needsAttention: false,
  };
}

export type GrowthTruthBrief = {
  pastData: string;
  currentAnalysis: string;
  futureVision: string;
  compactText: string;
};

export function getGrowthTruthBrief(
  analysisData?: AnalysisData | null,
  reportType?: string | null
): GrowthTruthBrief {
  const readiness = summarizeGrowthReadiness(analysisData, reportType);
  const displayable = getDisplayableDerivedGuidance(analysisData);

  const pastData = (() => {
    switch (analysisData?.teacherVerified?.derivedGuidanceStatus) {
      case 'regenerated_from_teacher_verified':
        return '교사 확정값';
      case 'excluded_after_teacher_adjustment':
        return '교사 확정값';
      case 'ai_draft_retained':
        return 'AI 초안 확인';
      default:
        return reportType === 'test' || reportType === 'level_test'
          ? '기존 AI 분석'
          : '성장 참고 데이터';
    }
  })();

  const currentAnalysis = (() => {
    if (readiness.tone === 'danger') return '반영 실패';
    if (readiness.needsAttention) return '보완 필요';
    if (readiness.tone === 'success') return '분석 가능';
    return readiness.label;
  })();

  const futureVision = (() => {
    if (!displayable.canShowDerivedGuidance) return '비전 보류';
    if (displayable.futureVision || displayable.growthPredictions.length > 0) return '비전 표시';
    return readiness.needsAttention ? '교사 보완 필요' : '비전 자료 부족';
  })();

  return {
    pastData,
    currentAnalysis,
    futureVision,
    compactText: `근거: ${pastData} · 현재: ${currentAnalysis} · 비전: ${futureVision}`,
  };
}
