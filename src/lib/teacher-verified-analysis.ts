import type {
  AnalysisData,
  DetailedProblemAnalysis,
  ReportProcessingStatus,
  ReportProcessingTrace,
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
