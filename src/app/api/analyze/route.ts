import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeTestPaperWithContext, GeminiApiError, GeminiParseError } from '@/lib/gemini';
import { buildAnalysisContext, updateStudentMetaProfile } from '@/lib/context-builder';
import { applyRateLimitAsync } from '@/lib/rate-limiter';
import { analyzeRequestSchema, validateRequest } from '@/lib/validations';
import type { AnalyzeApiResponse, ReportType, TestAnalysisFormData, StudentMetaProfile, ErrorSignature, AbsorptionRate, SolvingStamina, MetaCognitionLevel } from '@/types';

// Route Segment Config: 2분 타임아웃 (Vercel Pro/Enterprise)
export const maxDuration = 120;

/**
 * AI 분석 결과에서 메타프로필 업데이트 데이터 추출
 */
function extractMetaProfileFromAnalysis(
  analysisData: unknown
): Partial<StudentMetaProfile> | null {
  if (!analysisData || typeof analysisData !== 'object') return null;

  const data = analysisData as Record<string, unknown>;
  const updates: Partial<StudentMetaProfile> = {};
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

      const errorSignature: ErrorSignature = {
        primaryErrorTypes: [{
          type: '개념 오류',
          frequency: 50,
          recentTrend: 'stable',
        }],
        signaturePatterns: patterns.slice(0, 5),
        domainVulnerability: [],
        lastUpdated: now,
      };
      updates.errorSignature = errorSignature;
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

      const absorptionRate: AbsorptionRate = {
        overallScore: percentage,
        byDomain: [],
        learningType: learningType as AbsorptionRate['learningType'],
        optimalConditions: [],
        recentTrend: [{ month: currentMonth, score: percentage }],
        lastUpdated: now,
      };
      updates.absorptionRate = absorptionRate;
    }
  }

  // detailedAnalysis에서 풀이 지구력 관련 데이터 추출
  const detailedAnalysis = data.detailedAnalysis as Array<Record<string, unknown>> | undefined;
  if (detailedAnalysis && detailedAnalysis.length > 0) {
    const accuracyBySequence: Array<{ problemRange: string; accuracy: number }> = [];
    const totalItems = detailedAnalysis.length;
    const chunkSize = Math.ceil(totalItems / 3);

    for (let i = 0; i < 3; i++) {
      const startIdx = i * chunkSize;
      const endIdx = Math.min((i + 1) * chunkSize, totalItems);

      // Skip if this chunk would be empty or have invalid range
      if (startIdx >= totalItems) continue;

      const chunk = detailedAnalysis.slice(startIdx, endIdx);
      const correctCount = chunk.filter(q => q.isCorrect === true || q.isCorrect === 'O').length;
      const accuracy = chunk.length > 0 ? Math.round((correctCount / chunk.length) * 100) : 0;

      accuracyBySequence.push({
        problemRange: `${startIdx + 1}-${endIdx}`,
        accuracy,
      });
    }

    const avgAccuracy = accuracyBySequence.length > 0
      ? Math.round(accuracyBySequence.reduce((sum, a) => sum + a.accuracy, 0) / accuracyBySequence.length)
      : 50;

    const hasLateFatigue = accuracyBySequence.length >= 2 &&
      accuracyBySequence[accuracyBySequence.length - 1].accuracy < accuracyBySequence[0].accuracy - 20;

    const solvingStamina: SolvingStamina = {
      overallScore: avgAccuracy,
      optimalDuration: 60,
      accuracyBySequence,
      fatiguePattern: hasLateFatigue ? 'late-fatigue' : 'consistent',
      recoveryStrategies: [],
      lastUpdated: now,
    };
    updates.solvingStamina = solvingStamina;
  }

  // learningHabits에서 메타인지 관련 데이터 추출
  const learningHabits = data.learningHabits as Array<{ type: string; description: string }> | undefined;
  if (learningHabits) {
    const goodHabits = learningHabits.filter(h => h.type === 'good').length;
    const totalHabits = learningHabits.length;
    const habitRatio = totalHabits > 0 ? (goodHabits / totalHabits) : 0.5;
    const devStage = habitRatio >= 0.7 ? 'proficient' : habitRatio >= 0.4 ? 'developing' : 'beginner';

    const metaCognitionLevel: MetaCognitionLevel = {
      overallScore: Math.round(habitRatio * 100),
      subScores: {
        selfAssessmentAccuracy: Math.round(habitRatio * 100),
        errorRecognition: 50,
        strategySelection: 50,
        timeManagement: 50,
      },
      developmentStage: devStage as MetaCognitionLevel['developmentStage'],
      improvementAreas: learningHabits.filter(h => h.type === 'bad').map(h => h.description).slice(0, 3),
      lastUpdated: now,
    };
    updates.metaCognitionLevel = metaCognitionLevel;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeApiResponse>> {
  try {
    // Rate Limiting: AI 분석은 분당 5회 제한 (Redis 우선, in-memory fallback)
    const rateLimitResult = await applyRateLimitAsync(request, 'AI_ANALYSIS');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: '사용자 정보를 찾을 수 없습니다.' }, { status: 403 });
    }

    if (userData.role !== 'teacher') {
      return NextResponse.json({ success: false, error: '선생님만 분석을 실행할 수 있습니다.' }, { status: 403 });
    }

    // 입력 데이터 검증 (Zod)
    const rawBody = await request.json();
    const validation = validateRequest(analyzeRequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }
    const body = validation.data;

    // 학생 ID가 있으면 컨텍스트 빌드
    let context = undefined;
    if (body.studentId) {
      const reportType: ReportType = body.reportType || 'test';
      context = await buildAnalysisContext(body.studentId, reportType);
    }

    // 컨텍스트를 포함한 분석 실행
    const analysisData = await analyzeTestPaperWithContext(
      body.studentName,
      body.formData as TestAnalysisFormData,
      body.currentImages,
      body.pastImages || [],
      body.reportType || 'test',
      context
    );

    // Anchor Loop: 분석 결과로 메타프로필 업데이트 (studentId가 있는 경우)
    if (body.studentId && analysisData) {
      try {
        const metaProfileUpdates = extractMetaProfileFromAnalysis(analysisData);
        if (metaProfileUpdates) {
          await updateStudentMetaProfile(body.studentId, metaProfileUpdates);
          console.log(`[Anchor Loop] 메타프로필 업데이트 완료 - 학생 ID: ${body.studentId}`);
        }
      } catch (anchorError) {
        console.warn('[Anchor Loop] 메타프로필 업데이트 실패 (분석은 성공):', anchorError);
      }
    }

    return NextResponse.json({ success: true, analysisData });

  } catch (error) {
    console.error('분석 API 오류:', error);

    if (error instanceof GeminiApiError) {
      return NextResponse.json({ success: false, error: `AI 분석 오류: ${error.message}` }, { status: 500 });
    }
    if (error instanceof GeminiParseError) {
      return NextResponse.json({ success: false, error: 'AI 응답 파싱 오류가 발생했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: '분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
