function extractMetaProfileFromAnalysis(
  analysisData: any
): any {
  if (!analysisData || typeof analysisData !== 'object') return null;

  const data = analysisData as Record<string, unknown>;
  const updates: any = {};
  const now = new Date().toISOString();
  const currentMonth = now.substring(0, 7);

  // macroAnalysis에서 오류 패턴 추출
  const macroAnalysis = data.macroAnalysis as Record<string, unknown> | undefined;
  if (macroAnalysis) {
    const errorPattern = macroAnalysis.errorPattern as string | undefined;
    const weaknesses = macroAnalysis.weaknesses as string | undefined;

    if (errorPattern || weaknesses) {
      const patterns: string[] = [];
      if (errorPattern) patterns.push(errorPattern);
      if (weaknesses) patterns.push(weaknesses);

      updates.errorSignature = {
        primaryErrorTypes: [{
          type: '개념 오류',
          frequency: 50,
          recentTrend: 'stable',
        }],
        signaturePatterns: patterns.slice(0, 5),
        domainVulnerability: [],
        lastUpdated: now,
      };
    }
  }

  // testResults에서 흡수율 관련 데이터 추출
  const testResults = data.testResults as Record<string, unknown> | undefined;
  if (testResults) {
    const score = testResults.totalScore as number | undefined;
    const maxScore = testResults.maxScore as number | undefined;

    if (score !== undefined && maxScore) {
      const percentage = Math.round((score / maxScore) * 100);
      const learningType = percentage >= 80 ? 'fast-starter' : percentage >= 60 ? 'steady-grower' : 'slow-but-deep';

      updates.absorptionRate = {
        overallScore: percentage,
        byDomain: [],
        learningType: learningType,
        optimalConditions: [],
        recentTrend: [{ month: currentMonth, score: percentage }],
        lastUpdated: now,
      };
    }
  }

  // detailedAnalysis에서 풀이 지구력 관련 데이터 추출
  const detailedAnalysis = data.detailedAnalysis as Array<Record<string, unknown>> | undefined;
  if (detailedAnalysis && detailedAnalysis.length > 0) {
    const accuracyBySequence: Array<{ problemRange: string; accuracy: number }> = [];
    const chunkSize = Math.ceil(detailedAnalysis.length / 3);

    for (let i = 0; i < 3; i++) {
      const chunk = detailedAnalysis.slice(i * chunkSize, (i + 1) * chunkSize);
      const correctCount = chunk.filter(q => q.isCorrect === true || q.isCorrect === 'O').length;
      const accuracy = chunk.length > 0 ? Math.round((correctCount / chunk.length) * 100) : 0;

      accuracyBySequence.push({
        problemRange: `${i * chunkSize + 1}-${Math.min((i + 1) * chunkSize, detailedAnalysis.length)}`,
        accuracy,
      });
    }

    const avgAccuracy = accuracyBySequence.length > 0
      ? Math.round(accuracyBySequence.reduce((sum, a) => sum + a.accuracy, 0) / accuracyBySequence.length)
      : 50;

    const hasLateFatigue = accuracyBySequence.length >= 2 &&
      accuracyBySequence[accuracyBySequence.length - 1].accuracy < accuracyBySequence[0].accuracy - 20;

    updates.solvingStamina = {
      overallScore: avgAccuracy,
      optimalDuration: 60,
      accuracyBySequence,
      fatiguePattern: hasLateFatigue ? 'late-fatigue' : 'consistent',
      recoveryStrategies: [],
      lastUpdated: now,
    };
  }

  // learningHabits에서 메타인지 관련 데이터 추출
  const learningHabits = data.learningHabits as Array<{ type: string; description: string }> | undefined;
  if (learningHabits) {
    const goodHabits = learningHabits.filter(h => h.type === 'good').length;
    const totalHabits = learningHabits.length;
    const habitRatio = totalHabits > 0 ? (goodHabits / totalHabits) : 0.5;
    const devStage = habitRatio >= 0.7 ? 'proficient' : habitRatio >= 0.4 ? 'developing' : 'beginner';

    updates.metaCognitionLevel = {
      overallScore: Math.round(habitRatio * 100),
      subScores: {
        selfAssessmentAccuracy: Math.round(habitRatio * 100),
        errorRecognition: 50,
        strategySelection: 50,
        timeManagement: 50,
      },
      developmentStage: devStage,
      improvementAreas: learningHabits.filter(h => h.type === 'bad').map(h => h.description).slice(0, 3),
      lastUpdated: now,
    };
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

// Now let's run the tests
async function runTests() {
  console.log('--- Running TC-02: extractMetaProfileFromAnalysis (Full Data) ---');
  const mockGeminiAnalysis = {
    testResults: { totalScore: 85, maxScore: 100 },
    macroAnalysis: {
      errorPattern: "계산 단계가 많을수록 실수 증가",
      weaknesses: "복잡한 계산에서 실수 발생"
    },
    detailedAnalysis: [
      { problemNumber: "1", isCorrect: "O" },
      { problemNumber: "2", isCorrect: "X", errorType: "계산 오류" },
      { problemNumber: "3", isCorrect: "O" },
      { problemNumber: "4", isCorrect: "O" },
    ],
    learningHabits: [
      { type: "good", description: "풀이 과정을 단계별로 기록" },
      { type: "bad", description: "검산 누락" }
    ]
  };

  const result = extractMetaProfileFromAnalysis(mockGeminiAnalysis);
  console.log('Result Full:', JSON.stringify(result, null, 2));

  console.log('\n--- Running TC-05: Empty Analysis Data ---');
  const emptyResult = extractMetaProfileFromAnalysis({});
  console.log('Empty Result:', emptyResult);

  console.log('\n--- Running TC-06: Partial Analysis Data ---');
  const partialResult = extractMetaProfileFromAnalysis({
    testResults: { totalScore: 90, maxScore: 100 }
  });
  console.log('Partial Result:', JSON.stringify(partialResult, null, 2));
}

runTests().catch(console.error);
