import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeTestPaperWithContext, GeminiApiError, GeminiParseError } from '@/lib/gemini';
import { buildAnalysisContext } from '@/lib/context-builder';
import { applyRateLimit } from '@/lib/rate-limiter';
import { analyzeRequestSchema, validateRequest } from '@/lib/validations';
import type { AnalyzeApiResponse, ReportType, TestAnalysisFormData } from '@/types';

// Route Segment Config: 2분 타임아웃 (Vercel Pro/Enterprise)
export const maxDuration = 120;

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeApiResponse>> {
  try {
    // Rate Limiting: AI 분석은 분당 5회 제한
    const rateLimitResult = applyRateLimit(request, 'AI_ANALYSIS');
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
