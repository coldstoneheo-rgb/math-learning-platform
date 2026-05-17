import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRegeneratedDerivedGuidance,
  assertCompleteVerifiedDerivedGuidance,
  attachProcessingTrace,
  buildInitialProcessingTrace,
  buildTeacherVerifiedAnalysis,
  buildVerificationDraft,
  getVerificationError,
  markDerivedGuidanceRegenerationFailed,
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
