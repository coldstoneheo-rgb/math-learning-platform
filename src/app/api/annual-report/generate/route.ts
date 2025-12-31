import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAnnualReport, AnnualReportInput } from '@/lib/gemini';
import { buildAnalysisContext } from '@/lib/context-builder';
import { applyRateLimit } from '@/lib/rate-limiter';
import { annualReportRequestSchema, validateRequest } from '@/lib/validations';
import type { AnnualReportAnalysis, StudentMetaProfile } from '@/types';

// Route Segment Config: 2분 타임아웃 (Vercel Pro/Enterprise)
export const maxDuration = 120;

interface GenerateAnnualReportRequest {
  studentId: number;
  year: number;
}

interface GenerateAnnualReportResponse {
  success: boolean;
  analysis?: AnnualReportAnalysis;
  error?: string;
}

/**
 * POST /api/annual-report/generate
 *
 * 연간 리포트 AI 분석을 생성합니다.
 * 1년간의 학습 데이터를 종합하여 성장 스토리와 다음 학년 준비 분석을 생성합니다.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateAnnualReportResponse>> {
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
    const validation = validateRequest(annualReportRequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { studentId, year } = validation.data;

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

    // 4. 연간 날짜 범위 계산
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    console.log(`[Annual Report] Generating for ${student.name}, ${year}년`);

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

    // 7. 반기 리포트 조회
    const { data: semiAnnualReports } = await supabase
      .from('reports')
      .select('analysis_data, test_date')
      .eq('student_id', studentId)
      .eq('report_type', 'semi_annual')
      .gte('test_date', startDate)
      .lte('test_date', endDate)
      .order('test_date');

    // 8. 모든 리포트 수 조회
    const { count: totalReportsCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .gte('test_date', startDate)
      .lte('test_date', endDate);

    // 9. 통계 계산
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

    // 출석률 계산 (예: 52주 중 수업이 있었던 주 비율)
    const attendanceRate = totalClasses > 0 ? Math.min(100, Math.round((totalClasses / 52) * 100 * 2)) : 0;

    // 10. 반기 리포트 요약 생성
    const semiAnnualReportsSummary = (semiAnnualReports || []).map((sr) => {
      const data = sr.analysis_data as Record<string, unknown> || {};
      const testDateMonth = sr.test_date ? new Date(sr.test_date).getMonth() + 1 : 1;
      const halfYear = testDateMonth <= 6 ? '상반기' : '하반기';
      const growthTrajectory = data.growthTrajectory as Record<string, unknown> | undefined;
      return {
        halfYear: halfYear as '상반기' | '하반기',
        summary: (data.teacherAssessment as string) || `${halfYear} 학습 완료`,
        growthRate: (growthTrajectory?.growthRate as number) || 0,
      };
    });

    // 11. 학년 변화 계산 (연초 학년 vs 현재 학년)
    const startGrade = Math.max(1, student.grade - 1); // 연초 학년 추정
    const endGrade = student.grade;

    // 12. 메타프로필에서 baseline 정보 추출
    const metaProfile = student.meta_profile as StudentMetaProfile | undefined;
    let baselineData;
    if (metaProfile?.baseline) {
      baselineData = {
        assessmentDate: metaProfile.baseline.assessmentDate || '',
        initialScores: metaProfile.baseline.domainScores?.reduce((acc, d) => {
          acc[d.domain] = d.score;
          return acc;
        }, {} as Record<string, number>) || {},
      };
    }

    // 13. AnnualReportInput 구성
    const annualInput: AnnualReportInput = {
      studentName: student.name,
      year,
      startGrade,
      endGrade,
      annualStatistics: {
        totalClasses,
        totalHours,
        totalTests,
        totalReports: totalReportsCount || 0,
        averageScore,
        scoreImprovement,
        attendanceRate,
      },
      semiAnnualReports: semiAnnualReportsSummary.length > 0 ? semiAnnualReportsSummary : [
        { halfYear: '상반기', summary: '데이터 수집 중', growthRate: 0 },
        { halfYear: '하반기', summary: '데이터 수집 중', growthRate: 0 },
      ],
      metaProfile,
      baseline: baselineData,
    };

    // 14. 컨텍스트 데이터 구성
    let context;
    try {
      context = await buildAnalysisContext(studentId, 'annual');
    } catch (contextError) {
      console.warn('[Annual Report] Context building failed:', contextError);
    }

    // 15. AI 분석 생성
    console.log('[Annual Report] Calling Gemini AI...');
    const analysis = await generateAnnualReport(annualInput, context);

    console.log('[Annual Report] AI analysis generated successfully');

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('[Annual Report] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '연간 리포트 AI 분석 생성 중 오류',
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
