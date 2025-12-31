import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWeeklyReport, WeeklyReportInput } from '@/lib/gemini';
import { buildAnalysisContext } from '@/lib/context-builder';
import { applyRateLimit } from '@/lib/rate-limiter';
import { weeklyReportRequestSchema, validateRequest } from '@/lib/validations';
import type { WeeklyReportAnalysis } from '@/types';

// Route Segment Config: 2분 타임아웃 (Vercel Pro/Enterprise)
export const maxDuration = 120;

interface GenerateWeeklyReportRequest {
  studentId: number;
  year: number;
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  teacherNotes?: string;
}

interface GenerateWeeklyReportResponse {
  success: boolean;
  analysis?: WeeklyReportAnalysis;
  error?: string;
}

/**
 * POST /api/weekly-report/generate
 *
 * 주간 리포트 AI 분석을 생성합니다.
 * DB에서 해당 주의 수업 기록, 숙제 데이터를 수집하여
 * Gemini AI를 통해 Micro Loop 분석을 생성합니다.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateWeeklyReportResponse>> {
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

    // 2. 입력 데이터 검증 (Zod)
    const rawBody = await request.json();
    const validation = validateRequest(weeklyReportRequestSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { studentId, year, weekNumber, startDate, endDate, teacherNotes } = validation.data;

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

    console.log(`[Weekly Report] Generating for ${student.name}, ${year}년 ${weekNumber}주차 (${startDate} ~ ${endDate})`);

    // 4. 수업 기록 조회
    const { data: classSessions } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('student_id', studentId)
      .gte('session_date', startDate)
      .lte('session_date', endDate)
      .order('session_date');

    // 5. 숙제 데이터 조회
    const { data: assignments } = await supabase
      .from('assignments')
      .select('*')
      .eq('student_id', studentId)
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59`);

    // 6. 지난주 리포트 조회 (목표 달성 확인용)
    const lastWeekEnd = new Date(startDate);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekStart.getDate() - 6);

    const { data: lastWeekReport } = await supabase
      .from('reports')
      .select('analysis_data')
      .eq('student_id', studentId)
      .eq('report_type', 'weekly')
      .gte('test_date', lastWeekStart.toISOString().split('T')[0])
      .lte('test_date', lastWeekEnd.toISOString().split('T')[0])
      .order('test_date', { ascending: false })
      .limit(1)
      .single();

    // 7. 수업 세션 변환
    const classSessionsData = (classSessions || []).map(session => ({
      date: session.session_date,
      duration: calculateDuration(session.start_time, session.end_time),
      keywords: session.learning_keywords || [],
      understandingLevel: session.understanding_level || 3,
      attentionLevel: session.attention_level || 3,
    }));

    // 8. 숙제 통계 계산
    const completedAssignments = (assignments || []).filter(a => a.status === 'completed').length;
    const totalAssignments = (assignments || []).length;

    // 9. 학년 레이블 생성
    const gradeLabel = getGradeLabel(student.grade);

    // 10. WeeklyReportInput 구성
    const weeklyInput: WeeklyReportInput = {
      studentName: student.name,
      studentGrade: gradeLabel,
      period: `${startDate} ~ ${endDate}`,
      weekNumber,
      classSessions: classSessionsData.length > 0 ? classSessionsData : [
        {
          date: startDate,
          duration: 90,
          keywords: ['데이터 수집 중'],
          understandingLevel: 3,
          attentionLevel: 3,
        }
      ],
      assignments: {
        total: totalAssignments || 1,
        completed: completedAssignments,
      },
      teacherNotes: teacherNotes || '주간 종합 평가 요청',
    };

    // 11. 컨텍스트 데이터 구성
    let context;
    try {
      context = await buildAnalysisContext(studentId, 'weekly');

      // 지난주 목표 추가
      if (lastWeekReport?.analysis_data) {
        const lastData = lastWeekReport.analysis_data as Record<string, unknown>;
        const nextWeekPlan = lastData.nextWeekPlan as Record<string, unknown> | undefined;
        if (nextWeekPlan?.goals && context) {
          context.currentMicroLoop = {
            loopType: 'weekly',
            cycleNumber: weekNumber,
            previousGoals: (nextWeekPlan.goals as string[]).map(goal => ({
              goal,
              achieved: false, // AI가 판단
              achievementRate: 0,
              notes: '', // AI가 판단
            })),
            currentPerformance: [],
            adjustments: [],
            nextCycleGoals: [],
            continuityScore: 70,
            momentum: 'maintaining',
          };
        }
      }
    } catch (contextError) {
      console.warn('[Weekly Report] Context building failed:', contextError);
    }

    // 12. AI 분석 생성
    console.log('[Weekly Report] Calling Gemini AI...');
    const analysis = await generateWeeklyReport(weeklyInput, context);

    console.log('[Weekly Report] AI analysis generated successfully');

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('[Weekly Report] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '주간 리포트 AI 분석 생성 중 오류',
      },
      { status: 500 }
    );
  }
}

/**
 * 수업 시간 계산 (분 단위)
 */
function calculateDuration(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 90; // 기본 90분

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  return (endH * 60 + endM) - (startH * 60 + startM);
}

/**
 * 학년 레이블 생성
 */
function getGradeLabel(grade: number): string {
  if (grade <= 6) return `초${grade}`;
  if (grade <= 9) return `중${grade - 6}`;
  return `고${grade - 9}`;
}
