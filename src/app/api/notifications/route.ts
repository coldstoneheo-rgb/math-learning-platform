import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  sendReportNotification,
  sendStudyPlanNotification,
  sendWeeklyReminder,
  isEmailConfigured,
} from '@/lib/email';
import type { ReportType } from '@/types';

/**
 * 알림 발송 API
 * POST /api/notifications
 *
 * Body:
 * - type: 'report' | 'study_plan' | 'weekly_reminder'
 * - data: 알림별 필수 데이터
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 이메일 설정 확인
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: '이메일 서비스가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { type, data } = body;

  if (!type || !data) {
    return NextResponse.json(
      { error: 'type과 data는 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    switch (type) {
      case 'report':
        return await handleReportNotification(supabase, data);

      case 'study_plan':
        return await handleStudyPlanNotification(supabase, data);

      case 'weekly_reminder':
        return await handleWeeklyReminder(supabase, data);

      default:
        return NextResponse.json(
          { error: `알 수 없는 알림 유형: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Notification API] Error:', error);
    return NextResponse.json(
      { error: '알림 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 리포트 알림 처리
 */
async function handleReportNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: { reportId: number; studentId: number }
) {
  const { reportId, studentId } = data;

  // 리포트 정보 조회
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (reportError || !report) {
    return NextResponse.json(
      { error: '리포트를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 학생 정보 조회 (학부모 ID 포함)
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*, parent_id')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    return NextResponse.json(
      { error: '학생 정보를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 학부모가 없는 경우
  if (!student.parent_id) {
    return NextResponse.json({
      success: false,
      message: '등록된 학부모가 없습니다.',
      skipped: true,
    });
  }

  // 학부모 정보 조회
  const { data: parent, error: parentError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', student.parent_id)
    .single();

  if (parentError || !parent) {
    return NextResponse.json(
      { error: '학부모 정보를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 리포트 요약 추출
  let summary: string | undefined;
  const analysisData = report.analysis_data;
  if (analysisData?.macroAnalysis?.oneLineSummary) {
    summary = analysisData.macroAnalysis.oneLineSummary;
  } else if (analysisData?.macroAnalysis?.summary) {
    summary = analysisData.macroAnalysis.summary.slice(0, 100) + '...';
  }

  // 이메일 발송
  const result = await sendReportNotification({
    parentEmail: parent.email,
    parentName: parent.name || '학부모',
    studentName: student.name,
    reportType: report.report_type as ReportType,
    reportId,
    reportTitle: report.test_name,
    reportDate: report.test_date,
    summary,
  });

  if (result.success) {
    // 알림 로그 저장 (선택적)
    try {
      await supabase.from('notification_logs').insert({
        user_id: parent.id,
        student_id: studentId,
        notification_type: 'report',
        reference_id: reportId,
        channel: 'email',
        status: 'sent',
        message_id: result.messageId,
      });
    } catch {
      // notification_logs 테이블이 없어도 무시
    }

    return NextResponse.json({
      success: true,
      message: '리포트 알림이 발송되었습니다.',
      messageId: result.messageId,
    });
  } else {
    return NextResponse.json(
      { error: result.error || '알림 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 학습 계획 알림 처리
 */
async function handleStudyPlanNotification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: { planId: number; studentId: number }
) {
  const { planId, studentId } = data;

  // 학습 계획 정보 조회
  const { data: plan, error: planError } = await supabase
    .from('study_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (planError || !plan) {
    return NextResponse.json(
      { error: '학습 계획을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 학생 정보 조회
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*, parent_id')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    return NextResponse.json(
      { error: '학생 정보를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (!student.parent_id) {
    return NextResponse.json({
      success: false,
      message: '등록된 학부모가 없습니다.',
      skipped: true,
    });
  }

  // 학부모 정보 조회
  const { data: parent, error: parentError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', student.parent_id)
    .single();

  if (parentError || !parent) {
    return NextResponse.json(
      { error: '학부모 정보를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 이메일 발송
  const result = await sendStudyPlanNotification({
    parentEmail: parent.email,
    parentName: parent.name || '학부모',
    studentName: student.name,
    planTitle: plan.title,
    planId,
    startDate: plan.start_date,
    endDate: plan.end_date,
    taskCount: plan.total_tasks || 0,
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: '학습 계획 알림이 발송되었습니다.',
      messageId: result.messageId,
    });
  } else {
    return NextResponse.json(
      { error: result.error || '알림 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 주간 리마인더 처리
 */
async function handleWeeklyReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  data: { studentId: number }
) {
  const { studentId } = data;

  // 학생 정보 조회
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('*, parent_id')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    return NextResponse.json(
      { error: '학생 정보를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (!student.parent_id) {
    return NextResponse.json({
      success: false,
      message: '등록된 학부모가 없습니다.',
      skipped: true,
    });
  }

  // 학부모 정보 조회
  const { data: parent, error: parentError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('id', student.parent_id)
    .single();

  if (parentError || !parent) {
    return NextResponse.json(
      { error: '학부모 정보를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 이번 주 학습 계획 조회
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const { data: activePlans } = await supabase
    .from('study_plans')
    .select('id, total_tasks, completed_tasks, progress_percentage')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .lte('start_date', endOfWeek.toISOString().split('T')[0])
    .gte('end_date', startOfWeek.toISOString().split('T')[0]);

  // 남은 태스크 조회
  const planIds = (activePlans || []).map(p => p.id);
  let upcomingTasks: string[] = [];

  if (planIds.length > 0) {
    const { data: tasks } = await supabase
      .from('study_tasks')
      .select('title')
      .in('study_plan_id', planIds)
      .neq('status', 'completed')
      .order('order_index', { ascending: true })
      .limit(10);

    upcomingTasks = (tasks || []).map(t => t.title);
  }

  // 진도 집계
  const totalTasks = (activePlans || []).reduce((sum, p) => sum + (p.total_tasks || 0), 0);
  const completedTasks = (activePlans || []).reduce((sum, p) => sum + (p.completed_tasks || 0), 0);
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 이메일 발송
  const result = await sendWeeklyReminder({
    parentEmail: parent.email,
    parentName: parent.name || '학부모',
    studentName: student.name,
    completedTasks,
    totalTasks,
    progressPercentage,
    upcomingTasks,
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: '주간 리마인더가 발송되었습니다.',
      messageId: result.messageId,
    });
  } else {
    return NextResponse.json(
      { error: result.error || '알림 발송에 실패했습니다.' },
      { status: 500 }
    );
  }
}
