import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRegeneratedDerivedGuidance,
  assertCompleteVerifiedDerivedGuidance,
  attachProcessingTrace,
  buildInitialProcessingTrace,
  buildTeacherVerifiedAnalysis,
  getDisplayableDerivedGuidance,
  getGrowthTruthBrief,
  getParentGrowthTruthSnapshot,
  getVerifiedGuidanceDisplayStatus,
  buildVerificationDraft,
  getVerificationError,
  hasUsableVerifiedDerivedGuidance,
  markDerivedGuidanceRegenerationFailed,
  selectLatestDisplayableGuidanceWithSection,
  summarizeGrowthReadiness,
  summarizeProcessingTrace,
  updateDownstreamTrace,
} from '../src/lib/teacher-verified-analysis.js';
import type { AnalysisData, VerifiedDerivedGuidance } from '../src/types/index.js';

function createAnalysisData(): AnalysisData {
  return {
    testInfo: {
      testName: '2학기 기말고사',
      studentName: '테스트 학생',
      testDate: '2026-05-16',
      testRange: '기본도형, 평면도형, 입체도형, 통계',
      difficulty: '중',
      totalQuestions: 26,
      questionsByPoint: [],
      percentageByPoint: [],
    },
    testResults: {
      totalScore: 82,
      maxScore: 100,
      rank: 5,
      totalStudents: 30,
      correctRateByPoint: [
        { name: '3점', value: 8, total: 10 },
        { name: '4점', value: 7, total: 10 },
      ],
    },
    resultAnalysis: {
      scoreComparison: {
        studentTotal: 82,
        averageTotal: 70,
        byPoint: [],
      },
      attemptAnalysisByRank: [],
      gradeTrend: [],
      performanceTrend: [],
    },
    detailedAnalysis: [
      {
        problemNumber: '1',
        keyConcept: '다각형의 내각',
        isCorrect: 'O',
        errorType: 'N/A',
        solutionStrategy: 'N/A',
        analysis: '정확히 해결함',
      },
      {
        problemNumber: '2',
        keyConcept: '다각형의 외각',
        isCorrect: 'X',
        errorType: '개념 오류',
        solutionStrategy: '차선 풀이',
        analysis: '외각의 합을 혼동함',
      },
    ],
    macroAnalysis: {
      summary: 'AI 초안 요약',
      strengths: '도형 계산 강점',
      weaknesses: '외각 개념 약점',
      errorPattern: '개념 오류 반복',
    },
    actionablePrescription: [
      {
        priority: 1,
        type: '개념 교정',
        title: '외각 개념 복습',
        description: '외각 합 개념을 다시 학습',
        whatToDo: '개념 정리',
        where: '교재 3단원',
        howMuch: '20문항',
        howTo: '대표 예제 후 유사 문항 풀이',
        measurementMethod: '다음 확인 테스트 90점',
      },
    ],
    growthPredictions: [
      {
        timeframe: '1개월',
        predictedScore: 88,
        confidenceLevel: 70,
        assumptions: ['주 2회 복습'],
      },
    ],
  };
}

function createCompleteGuidance(): VerifiedDerivedGuidance {
  return {
    macroAnalysis: {
      summary: '교사 확정값 기반 요약',
      strengths: '통계 문항 처리 강점',
      weaknesses: '시간 관리 보완 필요',
      errorPattern: '후반부 미풀이 패턴',
    },
    actionablePrescription: [
      {
        priority: 1,
        type: '전략 개선',
        title: '후반부 쉬운 문항 우선 확보',
        description: '시간 배분 전략을 적용',
        whatToDo: '쉬운 서술형 먼저 표시',
        where: '실전 모의지 후반부',
        howMuch: '주 2회',
        howTo: '40분 타이머로 풀이 순서 훈련',
        measurementMethod: '미풀이 문항 0개',
      },
    ],
    growthPredictions: [
      {
        timeframe: '1개월',
        predictedScore: 86,
        confidenceLevel: 75,
        assumptions: ['시간 배분 훈련 지속'],
      },
    ],
    learningHabits: [
      {
        type: 'bad',
        description: '한 문제에 오래 머무르는 경향',
        frequency: 'sometimes',
      },
    ],
    riskFactors: [
      {
        factor: '시험 긴장 시 쉬운 문항 지연',
        severity: 'medium',
        recommendation: '풀이 순서 체크 루틴',
      },
    ],
    swotAnalysis: {
      strength: '기본 개념 기억',
      weakness: '시간 배분',
      opportunity: '후반 쉬운 문항 회수 가능',
      threat: '긴장 상황',
    },
    trendComment: '확정값 기준으로 시간 관리가 핵심입니다.',
  };
}

test('unchanged teacher verification keeps AI draft guidance but records teacher confirmation', () => {
  const analysis = createAnalysisData();
  const draft = buildVerificationDraft(analysis, 100);
  const verified = buildTeacherVerifiedAnalysis(analysis, draft);

  assert.equal(verified.verificationStatus, 'teacher_verified');
  assert.equal(verified.teacherVerified?.derivedGuidanceStatus, 'ai_draft_retained');
  assert.deepEqual(verified.actionablePrescription, analysis.actionablePrescription);
  assert.deepEqual(verified.growthPredictions, analysis.growthPredictions);
  assert.deepEqual(verified.teacherVerified?.adjustedFields, []);
});

test('grading corrections exclude draft-derived guidance from downstream growth data', () => {
  const analysis = createAnalysisData();
  const draft = buildVerificationDraft(analysis, 100);
  draft.totalScore = 90;
  draft.detailedAnalysis[1] = {
    ...draft.detailedAnalysis[1],
    isCorrect: 'O',
    errorType: 'N/A',
  };

  const verified = buildTeacherVerifiedAnalysis(analysis, draft);

  assert.equal(verified.teacherVerified?.derivedGuidanceStatus, 'excluded_after_teacher_adjustment');
  assert.match(verified.macroAnalysis.summary, /교사 보정/);
  assert.equal(verified.macroAnalysis.strengths, '');
  assert.equal(verified.macroAnalysis.weaknesses, '');
  assert.equal(verified.macroAnalysis.errorPattern, '');
  assert.deepEqual(verified.actionablePrescription, []);
  assert.deepEqual(verified.growthPredictions, []);
  assert.ok(verified.teacherVerified?.adjustedFields.includes('totalScore'));
  assert.ok(verified.teacherVerified?.adjustedFields.includes('detailedAnalysis'));
});

test('regenerated guidance replaces excluded draft guidance and marks regenerated status', () => {
  const analysis = createAnalysisData();
  const draft = buildVerificationDraft(analysis, 100);
  draft.totalScore = 90;
  const verified = buildTeacherVerifiedAnalysis(analysis, draft);
  const regenerated = applyRegeneratedDerivedGuidance(verified, createCompleteGuidance());

  assert.equal(regenerated.teacherVerified?.derivedGuidanceStatus, 'regenerated_from_teacher_verified');
  assert.equal(regenerated.macroAnalysis.summary, '교사 확정값 기반 요약');
  assert.equal(regenerated.actionablePrescription[0].title, '후반부 쉬운 문항 우선 확보');
  assert.equal(regenerated.growthPredictions?.[0].predictedScore, 86);
  assert.ok(regenerated.teacherVerified?.derivedGuidanceRegeneratedAt);
});

test('regeneration failure keeps draft guidance excluded and records the failure reason', () => {
  const analysis = createAnalysisData();
  const draft = buildVerificationDraft(analysis, 100);
  draft.totalScore = 90;
  const verified = buildTeacherVerifiedAnalysis(analysis, draft);
  const failed = markDerivedGuidanceRegenerationFailed(verified, 'timeout');

  assert.equal(failed.teacherVerified?.derivedGuidanceStatus, 'excluded_after_teacher_adjustment');
  assert.equal(failed.teacherVerified?.derivedGuidanceError, 'timeout');
  assert.deepEqual(failed.actionablePrescription, []);
});

test('verified derived guidance must include all growth-loop sections', () => {
  assert.doesNotThrow(() => assertCompleteVerifiedDerivedGuidance(createCompleteGuidance()));

  const incomplete = createCompleteGuidance();
  delete incomplete.growthPredictions;

  assert.throws(
    () => assertCompleteVerifiedDerivedGuidance(incomplete),
    /필수 성장 섹션/
  );
});

test('verification validation rejects invalid score and ranking values', () => {
  const analysis = createAnalysisData();
  const draft = buildVerificationDraft(analysis, 100);

  draft.totalScore = 101;
  assert.equal(getVerificationError(draft), '최종 점수는 만점을 초과할 수 없습니다.');

  draft.totalScore = 90;
  draft.rank = 31;
  draft.totalStudents = 30;
  assert.equal(getVerificationError(draft), '석차는 전체 인원보다 클 수 없습니다.');
});

test('processing trace records teacher verified source of truth and downstream outcomes', () => {
  const analysis = createAnalysisData();
  const draft = buildVerificationDraft(analysis, 100);
  draft.totalScore = 90;
  const verified = buildTeacherVerifiedAnalysis(analysis, draft);
  let trace = buildInitialProcessingTrace(verified);

  assert.equal(trace.sourceOfTruth, 'teacher_verified');
  assert.equal(trace.teacherVerification?.status, 'verified');
  assert.equal(trace.teacherVerification?.derivedGuidanceStatus, 'excluded_after_teacher_adjustment');
  assert.deepEqual(trace.teacherVerification?.adjustedFields, ['totalScore']);

  trace = updateDownstreamTrace(trace, 'metaProfile', 'success', '메타프로필 반영 완료');
  trace = updateDownstreamTrace(trace, 'studyPlan', 'skipped', '확정값 기준 처방 없음');
  const traced = attachProcessingTrace(verified, trace);

  assert.equal(traced.processingTrace?.downstream?.metaProfile?.status, 'success');
  assert.equal(traced.processingTrace?.downstream?.studyPlan?.status, 'skipped');
  assert.equal(traced.processingTrace?.sourceOfTruth, 'teacher_verified');
});

test('verified guidance display helpers gate excluded draft-derived guidance', () => {
  const analysis = createAnalysisData();
  const unchanged = buildTeacherVerifiedAnalysis(analysis, buildVerificationDraft(analysis, 100));
  assert.equal(hasUsableVerifiedDerivedGuidance(unchanged), true);
  assert.equal(getVerifiedGuidanceDisplayStatus(unchanged)?.label, 'AI 초안 기반, 교사 확인 완료');

  const correctedDraft = buildVerificationDraft(analysis, 100);
  correctedDraft.totalScore = 90;
  const excluded = buildTeacherVerifiedAnalysis(analysis, correctedDraft);
  assert.equal(hasUsableVerifiedDerivedGuidance(excluded), false);
  assert.equal(getVerifiedGuidanceDisplayStatus(excluded)?.tone, 'warning');

  const regenerated = applyRegeneratedDerivedGuidance(excluded, createCompleteGuidance());
  assert.equal(hasUsableVerifiedDerivedGuidance(regenerated), true);
  assert.equal(getVerifiedGuidanceDisplayStatus(regenerated)?.label, '교사 확정값 기반 분석');
});

test('displayable guidance hides stale derived sections after teacher corrections', () => {
  const analysis = createAnalysisData();
  const correctedDraft = buildVerificationDraft(analysis, 100);
  correctedDraft.totalScore = 90;
  const excluded = buildTeacherVerifiedAnalysis(analysis, correctedDraft);

  excluded.actionablePrescription = createCompleteGuidance().actionablePrescription;
  excluded.growthPredictions = createCompleteGuidance().growthPredictions;
  excluded.learningHabits = createCompleteGuidance().learningHabits;
  excluded.riskFactors = createCompleteGuidance().riskFactors;
  excluded.swotAnalysis = createCompleteGuidance().swotAnalysis;
  excluded.macroAnalysis.futureVision = {
    threeMonths: 'AI 초안 기준 3개월 전망',
    sixMonths: 'AI 초안 기준 6개월 전망',
    longTerm: 'AI 초안 기준 장기 전망',
    encouragement: '보정 후에는 숨겨야 하는 격려',
  };
  excluded.macroAnalysis.weaknessFlow = {
    step1: { title: '숨겨야 하는 약점 발견', description: 'stale' },
    step2: { title: '숨겨야 하는 훈련', description: 'stale' },
    step3: { title: '숨겨야 하는 목표', description: 'stale' },
  };

  const displayable = getDisplayableDerivedGuidance(excluded);

  assert.equal(displayable.canShowDerivedGuidance, false);
  assert.deepEqual(displayable.actionablePrescription, []);
  assert.deepEqual(displayable.growthPredictions, []);
  assert.deepEqual(displayable.learningHabits, []);
  assert.deepEqual(displayable.riskFactors, []);
  assert.equal(displayable.swotAnalysis, undefined);
  assert.equal(displayable.futureVision, undefined);
  assert.equal(displayable.weaknessFlow, undefined);
});

test('displayable guidance keeps legacy AI draft reports compatible', () => {
  const analysis = createAnalysisData();
  analysis.learningHabits = createCompleteGuidance().learningHabits;
  analysis.riskFactors = createCompleteGuidance().riskFactors;
  analysis.swotAnalysis = createCompleteGuidance().swotAnalysis;
  analysis.macroAnalysis.futureVision = {
    threeMonths: '3개월 전망',
    sixMonths: '6개월 전망',
    longTerm: '장기 전망',
    encouragement: '실천 격려',
  };
  analysis.macroAnalysis.weaknessFlow = {
    step1: { title: '약점 발견', description: '도형' },
    step2: { title: '훈련', description: '반복' },
    step3: { title: '극복', description: '확인' },
  };

  const displayable = getDisplayableDerivedGuidance(analysis);

  assert.equal(displayable.canShowDerivedGuidance, true);
  assert.deepEqual(displayable.actionablePrescription, analysis.actionablePrescription);
  assert.deepEqual(displayable.growthPredictions, analysis.growthPredictions);
  assert.deepEqual(displayable.learningHabits, analysis.learningHabits);
  assert.deepEqual(displayable.riskFactors, analysis.riskFactors);
  assert.deepEqual(displayable.swotAnalysis, analysis.swotAnalysis);
  assert.deepEqual(displayable.futureVision, analysis.macroAnalysis.futureVision);
  assert.deepEqual(displayable.weaknessFlow, analysis.macroAnalysis.weaknessFlow);
});

test('parent growth truth snapshot explains retained AI draft guidance', () => {
  const analysis = createAnalysisData();
  const retained = buildTeacherVerifiedAnalysis(analysis, buildVerificationDraft(analysis, 100));

  const snapshot = getParentGrowthTruthSnapshot(retained);

  assert.equal(snapshot?.guidanceState, 'available');
  assert.equal(snapshot?.sourceLabel, 'AI 초안, 교사 확인');
  assert.equal(snapshot?.tone, 'neutral');
  assert.ok(snapshot?.visibleSections.includes('학습 처방'));
  assert.ok(snapshot?.visibleSections.includes('성장 예측'));
  assert.deepEqual(snapshot?.withheldSections, []);
});

test('parent growth truth snapshot makes excluded guidance visibly withheld', () => {
  const analysis = createAnalysisData();
  const correctedDraft = buildVerificationDraft(analysis, 100);
  correctedDraft.totalScore = 90;
  const excluded = buildTeacherVerifiedAnalysis(analysis, correctedDraft);

  excluded.actionablePrescription = createCompleteGuidance().actionablePrescription;
  excluded.growthPredictions = createCompleteGuidance().growthPredictions;
  excluded.macroAnalysis.futureVision = {
    threeMonths: '숨겨야 하는 전망',
    sixMonths: '숨겨야 하는 전망',
    longTerm: '숨겨야 하는 전망',
    encouragement: '숨겨야 하는 격려',
  };

  const snapshot = getParentGrowthTruthSnapshot(excluded);

  assert.equal(snapshot?.guidanceState, 'withheld');
  assert.equal(snapshot?.sourceLabel, '교사 확정값');
  assert.equal(snapshot?.tone, 'warning');
  assert.ok(snapshot?.headline.includes('교사 확정값'));
  assert.ok(snapshot?.description.includes('초안에서 만든 성장 처방과 예측은 표시하지 않습니다'));
  assert.ok(snapshot?.visibleSections.includes('문항별 분석'));
  assert.equal(snapshot?.visibleSections.includes('학습 처방'), false);
  assert.equal(snapshot?.visibleSections.includes('성장 예측'), false);
  assert.equal(snapshot?.visibleSections.includes('미래 비전'), false);
  assert.ok(snapshot?.withheldSections.includes('학습 처방'));
  assert.ok(snapshot?.withheldSections.includes('성장 예측'));
  assert.ok(snapshot?.withheldSections.includes('미래 비전'));
});

test('parent growth truth snapshot explains regenerated teacher verified guidance', () => {
  const analysis = createAnalysisData();
  const correctedDraft = buildVerificationDraft(analysis, 100);
  correctedDraft.totalScore = 90;
  const excluded = buildTeacherVerifiedAnalysis(analysis, correctedDraft);
  const regenerated = applyRegeneratedDerivedGuidance(excluded, createCompleteGuidance());

  const snapshot = getParentGrowthTruthSnapshot(regenerated);

  assert.equal(snapshot?.guidanceState, 'available');
  assert.equal(snapshot?.sourceLabel, '교사 확정값 기반 재분석');
  assert.equal(snapshot?.tone, 'success');
  assert.ok(snapshot?.visibleSections.includes('학습 처방'));
  assert.ok(snapshot?.visibleSections.includes('성장 예측'));
  assert.deepEqual(snapshot?.withheldSections, []);
});

test('parent growth truth snapshot keeps legacy reports readable', () => {
  const analysis = createAnalysisData();

  const snapshot = getParentGrowthTruthSnapshot(analysis);

  assert.equal(snapshot?.guidanceState, 'legacy');
  assert.equal(snapshot?.sourceLabel, '기존 AI 분석');
  assert.equal(snapshot?.tone, 'neutral');
  assert.ok(snapshot?.description.includes('교사 확정 메타데이터가 도입되기 전'));
  assert.ok(snapshot?.visibleSections.includes('학습 처방'));
  assert.deepEqual(snapshot?.withheldSections, []);
});

test('processing trace summary distinguishes ready partial and failed states', () => {
  const base = buildInitialProcessingTrace(createAnalysisData());

  const ready = updateDownstreamTrace(
    updateDownstreamTrace(base, 'metaProfile', 'success', 'ok'),
    'embeddings',
    'success',
    'ok'
  );
  assert.equal(summarizeProcessingTrace(ready)?.label, '성장 데이터 반영 완료');

  const partial = updateDownstreamTrace(ready, 'studyPlan', 'skipped', 'no prescription');
  assert.equal(summarizeProcessingTrace(partial)?.tone, 'warning');

  const failed = updateDownstreamTrace(partial, 'feedbackLoop', 'failed', 'api error');
  assert.equal(summarizeProcessingTrace(failed)?.label, '성장 데이터 보완 필요');
});

test('growth readiness summary prioritizes teacher verified guidance states', () => {
  const base = createAnalysisData();
  const draft = buildVerificationDraft(base, 100);
  const retained = buildTeacherVerifiedAnalysis(base, draft);

  assert.deepEqual(
    {
      label: summarizeGrowthReadiness(retained, 'test').label,
      needsAttention: summarizeGrowthReadiness(retained, 'test').needsAttention,
    },
    {
      label: 'AI 초안 확인 완료',
      needsAttention: false,
    }
  );

  const corrected = buildVerificationDraft(base, 100);
  corrected.totalScore = 78;
  const excluded = buildTeacherVerifiedAnalysis(base, corrected);
  const excludedSummary = summarizeGrowthReadiness(excluded, 'test');
  assert.equal(excludedSummary.label, '성장 처방 보류');
  assert.equal(excludedSummary.tone, 'warning');
  assert.equal(excludedSummary.needsAttention, true);

  const regenerated = applyRegeneratedDerivedGuidance(excluded, createCompleteGuidance());
  const regeneratedSummary = summarizeGrowthReadiness(regenerated, 'test');
  assert.equal(regeneratedSummary.label, '교사 확정값 기반');
  assert.equal(regeneratedSummary.needsAttention, false);
});

test('growth readiness summary flags downstream failures and keeps legacy reports neutral', () => {
  const base = createAnalysisData();
  const trace = updateDownstreamTrace(
    buildInitialProcessingTrace(base),
    'embeddings',
    'failed',
    'embedding error'
  );
  const failed = attachProcessingTrace(base, trace);
  const failedSummary = summarizeGrowthReadiness(failed, 'test');
  assert.equal(failedSummary.label, '성장 데이터 보완 필요');
  assert.equal(failedSummary.tone, 'danger');
  assert.equal(failedSummary.needsAttention, true);

  const legacySummary = summarizeGrowthReadiness(base, 'test');
  assert.equal(legacySummary.label, '기존 AI 분석');
  assert.equal(legacySummary.tone, 'neutral');
  assert.equal(legacySummary.needsAttention, false);

  const weeklySummary = summarizeGrowthReadiness(base, 'weekly');
  assert.equal(weeklySummary.label, '성장 흐름 참고');
  assert.equal(weeklySummary.needsAttention, false);
});

test('growth truth brief explains past current and future vision states', () => {
  const base = createAnalysisData();
  const corrected = buildVerificationDraft(base, 100);
  corrected.totalScore = 78;
  const excluded = buildTeacherVerifiedAnalysis(base, corrected);

  const excludedBrief = getGrowthTruthBrief(excluded, 'test');
  assert.equal(excludedBrief.pastData, '교사 확정값');
  assert.equal(excludedBrief.currentAnalysis, '보완 필요');
  assert.equal(excludedBrief.futureVision, '비전 보류');
  assert.ok(excludedBrief.compactText.includes('근거: 교사 확정값'));

  const regenerated = applyRegeneratedDerivedGuidance(excluded, createCompleteGuidance());
  const regeneratedBrief = getGrowthTruthBrief(regenerated, 'test');
  assert.equal(regeneratedBrief.pastData, '교사 확정값');
  assert.equal(regeneratedBrief.currentAnalysis, '분석 가능');
  assert.equal(regeneratedBrief.futureVision, '비전 표시');

  const retained = buildTeacherVerifiedAnalysis(base, buildVerificationDraft(base, 100));
  const retainedBrief = getGrowthTruthBrief(retained, 'test');
  assert.equal(retainedBrief.pastData, 'AI 초안 확인');
  assert.equal(retainedBrief.futureVision, '비전 표시');
});

test('growth truth brief distinguishes failed downstream and legacy reports', () => {
  const base = createAnalysisData();
  const failedTrace = updateDownstreamTrace(
    buildInitialProcessingTrace(base),
    'metaProfile',
    'failed',
    'meta profile update failed'
  );
  const failed = attachProcessingTrace(base, failedTrace);
  const failedBrief = getGrowthTruthBrief(failed, 'test');
  assert.equal(failedBrief.currentAnalysis, '반영 실패');
  assert.equal(failedBrief.futureVision, '비전 표시');

  const legacyBrief = getGrowthTruthBrief(base, 'test');
  assert.equal(legacyBrief.pastData, '기존 AI 분석');
  assert.equal(legacyBrief.currentAnalysis, '기존 AI 분석');
  assert.equal(legacyBrief.futureVision, '비전 표시');

  const weeklyBrief = getGrowthTruthBrief(base, 'weekly');
  assert.equal(weeklyBrief.pastData, '성장 참고 데이터');
  assert.equal(weeklyBrief.futureVision, '비전 표시');
});

test('latest guidance selector stops at withheld current test reports', () => {
  const base = createAnalysisData();
  const corrected = buildVerificationDraft(base, 100);
  corrected.totalScore = 78;
  const excluded = buildTeacherVerifiedAnalysis(base, corrected);

  const older = createAnalysisData();
  older.growthPredictions = [
    { timeframe: '1개월', predictedScore: 88, confidenceLevel: 0.8, assumptions: ['older guidance'] },
  ];

  const selected = selectLatestDisplayableGuidanceWithSection(
    [
      { report_type: 'test', analysis_data: excluded },
      { report_type: 'test', analysis_data: older },
    ],
    guidance => guidance.growthPredictions.length > 0
  );

  assert.equal(selected.canShowDerivedGuidance, false);
  assert.deepEqual(selected.growthPredictions, []);
});

test('latest guidance selector falls back past legacy reports missing a section', () => {
  const newestLegacy = createAnalysisData();
  newestLegacy.growthPredictions = [];

  const older = createAnalysisData();
  older.growthPredictions = [
    { timeframe: '3개월', predictedScore: 91, confidenceLevel: 0.7, assumptions: ['older prediction'] },
  ];

  const selected = selectLatestDisplayableGuidanceWithSection(
    [
      { report_type: 'test', analysis_data: newestLegacy },
      { report_type: 'level_test', analysis_data: older },
      { report_type: 'weekly', analysis_data: older },
    ],
    guidance => guidance.growthPredictions.length > 0
  );

  assert.equal(selected.canShowDerivedGuidance, true);
  assert.equal(selected.growthPredictions[0]?.predictedScore, 91);
});
