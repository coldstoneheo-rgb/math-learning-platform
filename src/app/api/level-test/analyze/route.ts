import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeLevelTest } from '@/lib/gemini';
import { applyRateLimit } from '@/lib/rate-limiter';
import { levelTestRequestSchema, validateRequest } from '@/lib/validations';
import type { LevelTestAnalysis } from '@/types';

// Route Segment Config: 2분 타임아웃 (Vercel Pro/Enterprise)
export const maxDuration = 120;

interface AnalyzeLevelTestRequest {
  studentId: number;
  testImages: string[]; // base64 encoded images
  additionalInfo?: {
    school?: string;
    previousExperience?: string;
    parentExpectations?: string;
  };
}

interface AnalyzeLevelTestResponse {
  success: boolean;
  analysis?: LevelTestAnalysis;
  error?: string;
}

/**
 * POST /api/level-test/analyze
 *
 * 레벨 테스트(신규 학생 진단 테스트)를 분석합니다.
 * 이 테스트는 학생의 Baseline을 설정하는 핵심 단계입니다.
 *
 * 분석 항목:
 * 1. 영역별 진단 (연산, 방정식, 도형, 확률통계 등)
 * 2. 학년 수준 평가
 * 3. 선수학습 결손 분석
 * 4. 학습 성향 진단
 * 5. 초기 오류 서명 추출
 * 6. 맞춤 커리큘럼 제안
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyzeLevelTestResponse>> {
  try {
    // 0. Rate Limiting: AI 분석은 분당 5회 제한
    const rateLimitResult = applyRateLimit(request, 'AI_ANALYSIS');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    // 1. 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 교사만 레벨 테스트 분석 가능
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'teacher') {
      return NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 2. 입력 데이터 검증 (Zod)
    const rawBody = await request.json();
    const validation = validateRequest(levelTestRequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { studentId, testImages, additionalInfo } = validation.data;

    // 3. 학생 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, grade, school, meta_profile')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { success: false, error: '학생을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 Baseline이 설정된 학생인지 확인
    const metaProfile = student.meta_profile as Record<string, unknown> | null;
    if (metaProfile?.baseline && (metaProfile.baseline as Record<string, unknown>).assessmentDate) {
      console.log(`[Level Test] Warning: Student ${student.name} already has baseline set`);
      // 경고만 하고 진행 (재측정 허용)
    }

    console.log(`[Level Test] Analyzing for ${student.name} (Grade ${student.grade})`);

    // 4. AI 분석 실행
    const analysis = await analyzeLevelTest(
      student.name,
      student.grade,
      testImages,
      {
        school: additionalInfo?.school || student.school || undefined,
        previousExperience: additionalInfo?.previousExperience,
        parentExpectations: additionalInfo?.parentExpectations,
      }
    );

    console.log('[Level Test] Analysis completed successfully');

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('[Level Test] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '레벨 테스트 분석 중 오류',
      },
      { status: 500 }
    );
  }
}
