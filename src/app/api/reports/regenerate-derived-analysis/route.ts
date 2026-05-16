import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildAnalysisContext } from '@/lib/context-builder';
import { regenerateVerifiedDerivedGuidance, GeminiApiError, GeminiParseError } from '@/lib/gemini';
import { applyRateLimitAsync } from '@/lib/rate-limiter';
import { testFormDataSchema, validateRequest } from '@/lib/validations';
import type {
  AnalysisData,
  RegenerateVerifiedDerivedAnalysisResponse,
  TestAnalysisFormData,
} from '@/types';

export const maxDuration = 60;

const regenerateDerivedAnalysisSchema = z.object({
  studentId: z.number().int().positive(),
  studentName: z.string().min(1).max(50),
  formData: testFormDataSchema,
  analysisData: z.custom<AnalysisData>((value) => {
    if (!value || typeof value !== 'object') return false;
    const data = value as Partial<AnalysisData>;
    return Boolean(data.testResults && data.detailedAnalysis && data.teacherVerified);
  }, '교사 확정 분석 데이터가 필요합니다.'),
});

function buildVerifiedGuidanceQueryText(
  studentName: string,
  formData: TestAnalysisFormData,
  analysisData: AnalysisData
): string {
  const wrongItems = analysisData.detailedAnalysis
    .filter((item) => item.isCorrect === 'X' || item.isCorrect === '△')
    .slice(0, 12)
    .map((item) => `${item.problemNumber}번 ${item.keyConcept} ${item.errorType}`)
    .join(' | ');

  return [
    studentName,
    formData.testName,
    formData.testRange,
    `확정점수 ${analysisData.testResults.totalScore}/${analysisData.testResults.maxScore}`,
    wrongItems,
    analysisData.teacherVerified?.verificationNote,
  ]
    .filter(Boolean)
    .join(' ');
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<RegenerateVerifiedDerivedAnalysisResponse>> {
  try {
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

    if (userError || !userData || userData.role !== 'teacher') {
      return NextResponse.json({ success: false, error: '선생님만 실행할 수 있습니다.' }, { status: 403 });
    }

    const rawBody = await request.json();
    const validation = validateRequest(regenerateDerivedAnalysisSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { studentId, studentName, formData, analysisData } = validation.data;
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, grade')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ success: false, error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const context = await buildAnalysisContext(studentId, 'test', {
      queryText: buildVerifiedGuidanceQueryText(studentName, formData, analysisData),
    });

    const derivedGuidance = await regenerateVerifiedDerivedGuidance(
      studentName,
      formData,
      analysisData,
      context,
      student.grade
    );

    return NextResponse.json({ success: true, derivedGuidance });
  } catch (error) {
    console.error('[RegenerateDerivedAnalysis] failed:', error);

    if (error instanceof GeminiParseError) {
      return NextResponse.json(
        { success: false, error: 'AI 응답을 파싱할 수 없습니다. 확정값은 저장하되 파생 처방은 제외합니다.' },
        { status: 502 }
      );
    }

    if (error instanceof GeminiApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { success: false, error: '교사 확정 기반 파생 분석 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
