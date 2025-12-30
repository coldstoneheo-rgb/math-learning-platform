import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateMonthlyReport, MonthlyReportInput } from '@/lib/gemini';
import { buildAnalysisContext } from '@/lib/context-builder';
import type { MonthlyReportAnalysis } from '@/types';

interface GenerateMonthlyReportRequest {
  studentId: number;
  year: number;
  month: number;
  teacherNotes?: string;
}

interface GenerateMonthlyReportResponse {
  success: boolean;
  analysis?: MonthlyReportAnalysis;
  error?: string;
}

/**
 * POST /api/monthly-report/generate
 *
 * 월간 리포트 AI 분석을 생성합니다.
 * DB에서 해당 월의 수업 기록, 시험 결과, 숙제 데이터를 수집하여
 * Gemini AI를 통해 종합 분석을 생성합니다.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateMonthlyReportResponse>> {
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

    // 교사만 AI 분석 생성 가능
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
    const body: GenerateMonthlyReportRequest = await request.json();
    const { studentId, year, month, teacherNotes } = body;

    if (!studentId || !year || !month) {
      return NextResponse.json(
        { success: false, error: '학생 ID, 연도, 월이 필요합니다.' },
        { status: 400 }
      );
    }

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

    // 4. 해당 월의 날짜 범위 계산
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // 해당 월의 마지막 날

    console.log(`[Monthly Report] Generating for ${student.name}, ${year}년 ${month}월 (${startDate} ~ ${endDate})`);

    // 5. 수업 기록 조회
    const { data: classSessions } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('student_id', studentId)
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date');

    // 6. 해당 월 시험 리포트 조회
    const { data: testReports } = await supabase
      .from('reports')
      .select('test_name, total_score, max_score, test_date')
      .eq('student_id', studentId)
      .eq('report_type', 'test')
      .gte('test_date', startDate)
      .lte('test_date', endDate);

    // 7. 숙제 데이터 조회
    const { data: assignments } = await supabase
      .from('assignments')
      .select('*')
      .eq('student_id', studentId)
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59`);

    // 8. 주간 리포트 조회 (해당 월)
    const { data: weeklyReports } = await supabase
      .from('reports')
      .select('analysis_data, test_date')
      .eq('student_id', studentId)
      .eq('report_type', 'weekly')
      .gte('test_date', startDate)
      .lte('test_date', endDate)
      .order('test_date');

    // 9. 수업 세션 통계 계산
    const sessionStats = calculateSessionStats(classSessions || []);

    // 10. 주간 리포트 요약 생성
    const weeklyReportsSummary = (weeklyReports || []).map((wr, index) => {
      const data = wr.analysis_data as Record<string, unknown> || {};
      return {
        weekNumber: index + 1,
        continuityScore: (data.microLoopFeedback as Record<string, number>)?.continuityScore || 70,
        achievements: (data.weeklyAchievements as string[]) || [],
        challenges: (data.areasForImprovement as string[]) || [],
      };
    });

    // 11. 시험 결과 변환
    const testResults = (testReports || []).map(tr => ({
      testName: tr.test_name || '시험',
      score: tr.total_score || 0,
      maxScore: tr.max_score || 100,
    }));

    // 12. 숙제 통계 계산
    const assignmentStats = calculateAssignmentStats(assignments || []);

    // 13. MonthlyReportInput 구성
    const monthlyInput: MonthlyReportInput = {
      studentName: student.name,
      month: { year, month },
      period: `${year}년 ${month}월`,
      classSessionsSummary: sessionStats,
      weeklyReports: weeklyReportsSummary.length > 0 ? weeklyReportsSummary : [
        {
          weekNumber: 1,
          continuityScore: 75,
          achievements: ['데이터 수집 중'],
          challenges: ['주간 리포트 미생성'],
        }
      ],
      testResults: testResults.length > 0 ? testResults : undefined,
      assignmentSummary: assignmentStats,
      teacherNotes: teacherNotes || '월간 종합 평가 요청',
    };

    // 14. 컨텍스트 데이터 구성 (메타프로필 기반)
    let context;
    try {
      context = await buildAnalysisContext(studentId, 'monthly');
    } catch (contextError) {
      console.warn('[Monthly Report] Context building failed:', contextError);
      // 컨텍스트 실패해도 진행
    }

    // 15. AI 분석 생성
    console.log('[Monthly Report] Calling Gemini AI...');
    const analysis = await generateMonthlyReport(monthlyInput, context);

    console.log('[Monthly Report] AI analysis generated successfully');

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('[Monthly Report] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '월간 리포트 AI 분석 생성 중 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * 수업 세션 통계 계산
 */
function calculateSessionStats(sessions: Array<{
  start_time?: string;
  end_time?: string;
  understanding_level?: number;
  attention_level?: number;
}>): MonthlyReportInput['classSessionsSummary'] {
  if (sessions.length === 0) {
    return {
      totalClasses: 0,
      totalHours: 0,
      attendanceRate: 0,
      averageUnderstanding: 0,
      averageAttention: 0,
    };
  }

  let totalMinutes = 0;
  let totalUnderstanding = 0;
  let totalAttention = 0;

  for (const session of sessions) {
    // 수업 시간 계산
    if (session.start_time && session.end_time) {
      const start = parseTime(session.start_time);
      const end = parseTime(session.end_time);
      totalMinutes += end - start;
    } else {
      // 기본 90분 수업 가정
      totalMinutes += 90;
    }

    totalUnderstanding += session.understanding_level || 3;
    totalAttention += session.attention_level || 3;
  }

  return {
    totalClasses: sessions.length,
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    attendanceRate: 100, // 기록된 수업은 모두 출석으로 가정
    averageUnderstanding: Math.round(totalUnderstanding / sessions.length * 10) / 10,
    averageAttention: Math.round(totalAttention / sessions.length * 10) / 10,
  };
}

/**
 * 시간 문자열을 분 단위로 변환
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * 숙제 통계 계산
 */
function calculateAssignmentStats(assignments: Array<{
  status?: string;
}>): MonthlyReportInput['assignmentSummary'] {
  if (assignments.length === 0) {
    return {
      totalAssigned: 0,
      completed: 0,
      averageQuality: 0,
    };
  }

  const completed = assignments.filter(a => a.status === 'completed').length;

  return {
    totalAssigned: assignments.length,
    completed,
    averageQuality: completed > 0 ? 4 : 0, // 기본값 4 (완료된 경우)
  };
}
