import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSemiAnnualReport, SemiAnnualReportInput } from '@/lib/gemini';
import { buildAnalysisContext } from '@/lib/context-builder';
import { applyRateLimit } from '@/lib/rate-limiter';
import { semiAnnualReportRequestSchema, validateRequest } from '@/lib/validations';
import type { SemiAnnualReportAnalysis, StudentMetaProfile } from '@/types';

// Route Segment Config: 2분 타임아웃 (Vercel Pro/Enterprise)
export const maxDuration = 120;

interface GenerateSemiAnnualReportRequest {
  studentId: number;
  year: number;
  halfYear: '상반기' | '하반기';
}

interface GenerateSemiAnnualReportResponse {
  success: boolean;
  analysis?: SemiAnnualReportAnalysis;
  error?: string;
}

/**
 * POST /api/semi-annual-report/generate
 *
 * 반기 리포트 AI 분석을 생성합니다.
 * 6개월간의 학습 데이터를 종합하여 Macro Loop 분석을 생성합니다.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateSemiAnnualReportResponse>> {
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
    const validation = validateRequest(semiAnnualReportRequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { studentId, year, halfYear } = validation.data;

    // 3. 학생 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, grade, meta_profile')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { success: false, error: '학생을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 4. 반기 날짜 범위 계산
    const startMonth = halfYear === '상반기' ? 1 : 7;
    const endMonth = halfYear === '상반기' ? 6 : 12;
    const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${endMonth === 6 ? '30' : '31'}`;
    const period = `${year}년 ${halfYear} (${startMonth}월~${endMonth}월)`;

    console.log(`[Semi-Annual Report] Generating for ${student.name}, ${period}`);

    // 5. 수업 통계 조회
    const { data: classSessions } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('student_id', studentId)
      .gte('session_date', startDate)
      .lte('session_date', endDate);

    // 6. 시험 리포트 조회
    const { data: testReports } = await supabase
      .from('reports')
      .select('total_score, max_score, test_date, analysis_data')
      .eq('student_id', studentId)
      .eq('report_type', 'test')
      .gte('test_date', startDate)
      .lte('test_date', endDate)
      .order('test_date');

    // 7. 월간 리포트 조회
    const { data: monthlyReports } = await supabase
      .from('reports')
      .select('analysis_data, test_date')
      .eq('student_id', studentId)
      .eq('report_type', 'monthly')
      .gte('test_date', startDate)
      .lte('test_date', endDate)
      .order('test_date');

    // 8. 통계 계산
    const totalClasses = classSessions?.length || 0;
    const totalHours = calculateTotalHours(classSessions || []);
    const totalTests = testReports?.length || 0;

    let averageScore = 0;
    let scoreImprovement = 0;
    if (testReports && testReports.length > 0) {
      const scores = testReports.map(r => ((r.total_score || 0) / (r.max_score || 100)) * 100);
      averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      if (scores.length >= 2) {
        scoreImprovement = Math.round(scores[scores.length - 1] - scores[0]);
      }
    }

    // 9. 월간 리포트 요약 생성
    const monthlyReportsSummary = (monthlyReports || []).map((mr, idx) => {
      const data = mr.analysis_data as Record<string, unknown> || {};
      const monthNum = startMonth + idx;
      return {
        month: monthNum,
        achievements: (data.monthlyAchievements as string[]) || (data.whatWentWell as string[]) || [],
        challenges: (data.newChallenges as string[]) || (data.needsImprovement as string[]) || [],
        growthMomentum: 'maintaining' as const,
      };
    });

    // 10. SemiAnnualReportInput 구성
    const semiAnnualInput: SemiAnnualReportInput = {
      studentName: student.name,
      year,
      halfYear,
      period,
      periodSummary: {
        totalClasses,
        totalHours,
        totalTests,
        averageScore,
        scoreImprovement,
      },
      monthlyReports: monthlyReportsSummary.length > 0 ? monthlyReportsSummary : [
        { month: startMonth, achievements: ['데이터 수집 중'], challenges: [], growthMomentum: 'maintaining' as const }
      ],
      metaProfile: student.meta_profile as StudentMetaProfile | undefined,
    };

    // 11. 컨텍스트 데이터 구성
    let context;
    try {
      context = await buildAnalysisContext(studentId, 'semi_annual');
    } catch (contextError) {
      console.warn('[Semi-Annual Report] Context building failed:', contextError);
    }

    // 12. AI 분석 생성
    console.log('[Semi-Annual Report] Calling Gemini AI...');
    const analysis = await generateSemiAnnualReport(semiAnnualInput, context);

    console.log('[Semi-Annual Report] AI analysis generated successfully');

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('[Semi-Annual Report] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '반기 리포트 AI 분석 생성 중 오류',
      },
      { status: 500 }
    );
  }
}

function calculateTotalHours(sessions: Array<{ start_time?: string; end_time?: string }>): number {
  let totalMinutes = 0;
  for (const session of sessions) {
    if (session.start_time && session.end_time) {
      const [startH, startM] = session.start_time.split(':').map(Number);
      const [endH, endM] = session.end_time.split(':').map(Number);
      totalMinutes += (endH * 60 + endM) - (startH * 60 + startM);
    } else {
      totalMinutes += 90; // 기본 90분
    }
  }
  return Math.round(totalMinutes / 60 * 10) / 10;
}
