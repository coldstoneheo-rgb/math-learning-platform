import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeSelfStudy, GeminiApiError, GeminiParseError } from '@/lib/gemini';
import { buildAnalysisContext } from '@/lib/context-builder';
import { applyRateLimit } from '@/lib/rate-limiter';
import { z } from 'zod';
import type { SelfAnalysisProblemType, SelfAnalysisReport } from '@/types';

export const maxDuration = 120;

const selfAnalysisRequestSchema = z.object({
  // 학생 ID - student 역할이면 undefined(자동), parent면 필수
  studentId: z.number().int().positive().optional(),
  images: z.array(z.string()).min(1, '최소 1개의 이미지가 필요합니다').max(10, '최대 10개의 이미지만 허용됩니다'),
  problemType: z.enum(['연습문제', '교재', '숙제', '시험대비', '자유학습']),
  topicTags: z.array(z.string().max(30)).max(10).default([]),
  studentNote: z.string().max(500).optional(),
});

interface SelfAnalysisApiResponse {
  success: boolean;
  analysisData?: SelfAnalysisReport;
  reportId?: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<SelfAnalysisApiResponse>> {
  try {
    // Rate limiting: self-analysis는 분당 3회 제한 (비용 관리)
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
      .select('role, name')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: '사용자 정보를 찾을 수 없습니다.' }, { status: 403 });
    }

    // 학생 또는 학부모만 접근 가능
    if (!['student', 'parent'].includes(userData.role)) {
      return NextResponse.json(
        { success: false, error: '학생 또는 학부모만 자기 분석을 사용할 수 있습니다.' },
        { status: 403 }
      );
    }

    const rawBody = await request.json();
    const validation = selfAnalysisRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || '입력 데이터가 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    const body = validation.data;

    // 학생 정보 조회 및 권한 확인
    let studentId: number;
    let studentName: string;

    if (userData.role === 'student') {
      // 학생 본인: user_id로 자신의 student 레코드 조회
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name')
        .eq('user_id', user.id)
        .single();

      if (studentError || !studentData) {
        return NextResponse.json(
          { success: false, error: '학생 정보를 찾을 수 없습니다. 선생님께 계정 연결을 요청해주세요.' },
          { status: 404 }
        );
      }
      studentId = studentData.id;
      studentName = studentData.name;
    } else {
      // 학부모: body.studentId로 자녀 확인
      if (!body.studentId) {
        return NextResponse.json(
          { success: false, error: '분석할 자녀를 선택해주세요.' },
          { status: 400 }
        );
      }

      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, name')
        .eq('id', body.studentId)
        .eq('parent_id', user.id)
        .single();

      if (studentError || !studentData) {
        return NextResponse.json(
          { success: false, error: '해당 학생 정보를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      studentId = studentData.id;
      studentName = studentData.name;
    }

    // 누적 학습 컨텍스트 조회
    let context = undefined;
    try {
      context = await buildAnalysisContext(studentId, 'self_analysis');
    } catch {
      // 컨텍스트 조회 실패 시 컨텍스트 없이 진행
      console.warn('[Self-Analysis] 컨텍스트 조회 실패, 컨텍스트 없이 진행');
    }

    // Gemini AI 분석 실행
    const analysisData = await analyzeSelfStudy(
      studentName,
      body.images,
      body.problemType as SelfAnalysisProblemType,
      body.topicTags,
      body.studentNote,
      userData.role as 'student' | 'parent',
      context
    );

    // reports 테이블에 저장
    const today = new Date().toISOString().split('T')[0];
    const { data: savedReport, error: saveError } = await supabase
      .from('reports')
      .insert({
        student_id: studentId,
        report_type: 'self_analysis',
        test_name: `${body.problemType} 자기 분석 (${body.topicTags.join(', ') || '일반'})`,
        test_date: today,
        analysis_data: analysisData,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('[Self-Analysis] 저장 오류:', saveError);
      // 저장 실패해도 분석 결과는 반환
      return NextResponse.json({ success: true, analysisData });
    }

    return NextResponse.json({
      success: true,
      analysisData,
      reportId: savedReport?.id,
    });

  } catch (error) {
    console.error('[Self-Analysis] 오류:', error);

    if (error instanceof GeminiApiError) {
      return NextResponse.json({ success: false, error: `AI 분석 오류: ${error.message}` }, { status: 500 });
    }
    if (error instanceof GeminiParseError) {
      return NextResponse.json({ success: false, error: 'AI 응답 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: '분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
