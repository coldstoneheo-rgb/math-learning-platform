import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateMetaProfileUpdate } from '@/lib/gemini';
import { updateStudentMetaProfile } from '@/lib/context-builder';
import type { AnalysisData, ReportType, StudentMetaProfile } from '@/types';

interface UpdateMetaProfileRequest {
  studentId: number;
  reportId: number;
  analysisData: AnalysisData;
  reportType: ReportType;
}

interface UpdateMetaProfileResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * POST /api/meta-profile/update
 *
 * AI 분석 결과를 기반으로 학생의 메타프로필(5대 핵심 지표)을 업데이트합니다.
 * 이 엔드포인트는 리포트 저장 후 호출되어 Anchor Loop를 완성합니다.
 *
 * Flow:
 * 1. 학생의 현재 meta_profile 조회
 * 2. AI(Gemini)를 통해 분석 데이터에서 메타프로필 업데이트 추출
 * 3. 기존 프로필과 병합하여 DB 업데이트
 * 4. 히스토리 테이블에 변경 기록
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UpdateMetaProfileResponse>> {
  try {
    // 1. 인증 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 교사만 메타프로필 업데이트 가능
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

    // 2. 요청 데이터 파싱
    const body: UpdateMetaProfileRequest = await request.json();
    const { studentId, reportId, analysisData, reportType } = body;

    if (!studentId || !reportId || !analysisData) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 3. 현재 학생 메타프로필 조회
    const { data: student, error: fetchError } = await supabase
      .from('students')
      .select('meta_profile')
      .eq('id', studentId)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: '학생 정보 조회 실패' },
        { status: 404 }
      );
    }

    const currentProfile = student?.meta_profile as StudentMetaProfile | null;

    // 4. AI를 통해 메타프로필 업데이트 생성
    console.log(`[Meta Profile] Generating update for student ${studentId}, report ${reportId}`);

    const metaProfileUpdates = await generateMetaProfileUpdate(
      currentProfile,
      analysisData,
      reportType || 'test'
    );

    // 5. 업데이트가 있는 경우에만 저장
    if (Object.keys(metaProfileUpdates).length === 0) {
      console.log('[Meta Profile] No updates generated');
      return NextResponse.json({
        success: true,
        message: '메타프로필 변경 사항 없음'
      });
    }

    // 6. 메타프로필 업데이트 실행
    const updateResult = await updateStudentMetaProfile(
      studentId,
      metaProfileUpdates,
      reportId
    );

    if (!updateResult.success) {
      console.error('[Meta Profile] Update failed:', updateResult.error);
      return NextResponse.json(
        { success: false, error: updateResult.error },
        { status: 500 }
      );
    }

    console.log(`[Meta Profile] Successfully updated for student ${studentId}`);

    return NextResponse.json({
      success: true,
      message: 'Anchor Loop Repaired: Meta profile updated successfully'
    });

  } catch (error) {
    console.error('[Meta Profile] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '메타프로필 업데이트 중 오류'
      },
      { status: 500 }
    );
  }
}
