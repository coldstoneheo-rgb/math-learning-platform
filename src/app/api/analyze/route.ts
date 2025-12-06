import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeTestPaper, GeminiApiError, GeminiParseError } from '@/lib/gemini';
import type { AnalyzeApiRequest, AnalyzeApiResponse } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeApiResponse>> {
  try {
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

    const body: AnalyzeApiRequest = await request.json();

    if (!body.studentName || !body.formData || !body.currentImages?.length) {
      return NextResponse.json({ success: false, error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    const analysisData = await analyzeTestPaper(
      body.studentName,
      body.formData,
      body.currentImages,
      body.pastImages || []
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
