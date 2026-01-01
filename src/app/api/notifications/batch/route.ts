import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendWeeklyReminder, isEmailConfigured } from '@/lib/email';

/**
 * 배치 알림 발송 API
 * POST /api/notifications/batch
 *
 * 모든 학생의 학부모에게 주간 리마인더 등 일괄 발송
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 인증 확인 (교사만 가능)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 교사 권한 확인
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 이메일 설정 확인
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: '이메일 서비스가 설정되지 않았습니다.' },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { type, studentIds } = body;

  if (!type) {
    return NextResponse.json(
      { error: 'type은 필수입니다.' },
      { status: 400 }
    );
  }

  try {
    switch (type) {
      case 'weekly_reminder':
        return await handleBatchWeeklyReminder(supabase, studentIds);

      default:
        return NextResponse.json(
          { error: `지원하지 않는 배치 유형: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Batch Notification API] Error:', error);
    return NextResponse.json(
      { error: '배치 알림 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 주간 리마인더 일괄 발송
 */
async function handleBatchWeeklyReminder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentIds?: number[]
) {
  // 학생 목록 조회 (학부모가 있는 학생만)
  let query = supabase
    .from('students')
    .select('id, name, parent_id')
    .not('parent_id', 'is', null);

  if (studentIds && studentIds.length > 0) {
    query = query.in('id', studentIds);
  }

  const { data: students, error: studentsError } = await query;

  if (studentsError) {
    console.error('[Batch] Failed to fetch students:', studentsError);
    return NextResponse.json(
      { error: '학생 목록 조회에 실패했습니다.' },
      { status: 500 }
    );
  }

  if (!students || students.length === 0) {
    return NextResponse.json({
      success: true,
      message: '발송할 대상이 없습니다.',
      sent: 0,
      failed: 0,
      skipped: 0,
    });
  }

  // 학부모 정보 일괄 조회
  const parentIds = [...new Set(students.map(s => s.parent_id).filter(Boolean))];
  const { data: parents } = await supabase
    .from('users')
    .select('id, email, name')
    .in('id', parentIds);

  const parentMap = new Map((parents || []).map(p => [p.id, p]));

  // 알림 설정 조회
  const { data: preferences } = await supabase
    .from('notification_preferences')
    .select('user_id, email_weekly_reminder')
    .in('user_id', parentIds);

  const prefMap = new Map((preferences || []).map(p => [p.user_id, p]));

  // 이번 주 학습 계획 조회
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const studentIdList = students.map(s => s.id);
  const { data: allPlans } = await supabase
    .from('study_plans')
    .select('id, student_id, total_tasks, completed_tasks, progress_percentage')
    .in('student_id', studentIdList)
    .eq('status', 'active')
    .lte('start_date', endOfWeek.toISOString().split('T')[0])
    .gte('end_date', startOfWeek.toISOString().split('T')[0]);

  // 학생별 플랜 맵
  const plansByStudent = new Map<number, typeof allPlans>();
  for (const plan of allPlans || []) {
    if (!plansByStudent.has(plan.student_id)) {
      plansByStudent.set(plan.student_id, []);
    }
    plansByStudent.get(plan.student_id)!.push(plan);
  }

  // 남은 태스크 조회
  const allPlanIds = (allPlans || []).map(p => p.id);
  const { data: allTasks } = await supabase
    .from('study_tasks')
    .select('title, study_plan_id')
    .in('study_plan_id', allPlanIds.length > 0 ? allPlanIds : [-1])
    .neq('status', 'completed')
    .order('order_index', { ascending: true });

  const tasksByPlan = new Map<number, string[]>();
  for (const task of allTasks || []) {
    if (!tasksByPlan.has(task.study_plan_id)) {
      tasksByPlan.set(task.study_plan_id, []);
    }
    tasksByPlan.get(task.study_plan_id)!.push(task.title);
  }

  // 발송 결과 집계
  const results = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // 각 학생에 대해 발송
  for (const student of students) {
    const parent = parentMap.get(student.parent_id);
    if (!parent) {
      results.skipped++;
      continue;
    }

    // 알림 설정 확인
    const pref = prefMap.get(parent.id);
    if (pref && pref.email_weekly_reminder === false) {
      results.skipped++;
      continue;
    }

    // 진도 계산
    const plans = plansByStudent.get(student.id) || [];
    const totalTasks = plans.reduce((sum, p) => sum + (p.total_tasks || 0), 0);
    const completedTasks = plans.reduce((sum, p) => sum + (p.completed_tasks || 0), 0);
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 남은 태스크 수집
    const upcomingTasks: string[] = [];
    for (const plan of plans) {
      const tasks = tasksByPlan.get(plan.id) || [];
      upcomingTasks.push(...tasks);
    }

    try {
      const result = await sendWeeklyReminder({
        parentEmail: parent.email,
        parentName: parent.name || '학부모',
        studentName: student.name,
        completedTasks,
        totalTasks,
        progressPercentage,
        upcomingTasks: upcomingTasks.slice(0, 10),
      });

      if (result.success) {
        results.sent++;

        // 로그 저장 (실패해도 무시)
        try {
          await supabase.from('notification_logs').insert({
            user_id: parent.id,
            student_id: student.id,
            notification_type: 'weekly_reminder',
            channel: 'email',
            status: 'sent',
            message_id: result.messageId,
            metadata: { totalTasks, completedTasks, progressPercentage },
          });
        } catch {
          // notification_logs 테이블이 없어도 무시
        }
      } else {
        results.failed++;
        results.errors.push(`${student.name}: ${result.error}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`${student.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({
    success: true,
    message: `주간 리마인더 발송 완료: 성공 ${results.sent}, 실패 ${results.failed}, 건너뜀 ${results.skipped}`,
    ...results,
  });
}
