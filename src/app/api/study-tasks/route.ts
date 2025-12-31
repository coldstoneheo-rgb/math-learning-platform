import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { StudyTaskInput } from '@/types';

/**
 * 학습 항목 목록 조회
 * GET /api/study-tasks?plan_id=1&student_id=1&status=pending
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const planId = searchParams.get('plan_id');
  const studentId = searchParams.get('student_id');
  const status = searchParams.get('status');

  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('study_tasks')
    .select('*')
    .order('order_index', { ascending: true });

  // 필터 적용
  if (planId) {
    query = query.eq('study_plan_id', parseInt(planId));
  }
  if (studentId) {
    query = query.eq('student_id', parseInt(studentId));
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch study tasks:', error);
    return NextResponse.json(
      { error: '학습 항목을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ tasks: data });
}

/**
 * 학습 항목 생성
 * POST /api/study-tasks
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const task: StudyTaskInput = body;

  // 순서 인덱스 계산 (해당 계획의 마지막 순서 + 1)
  const { data: lastTask } = await supabase
    .from('study_tasks')
    .select('order_index')
    .eq('study_plan_id', task.study_plan_id)
    .order('order_index', { ascending: false })
    .limit(1)
    .single();

  const orderIndex = lastTask ? lastTask.order_index + 1 : 0;

  const { data, error } = await supabase
    .from('study_tasks')
    .insert({
      study_plan_id: task.study_plan_id,
      student_id: task.student_id,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      source: task.source,
      page_range: task.page_range,
      problem_numbers: task.problem_numbers,
      estimated_minutes: task.estimated_minutes,
      status: task.status || 'pending',
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create study task:', error);
    return NextResponse.json(
      { error: '학습 항목 생성에 실패했습니다.' },
      { status: 500 }
    );
  }

  // 계획의 total_tasks 업데이트
  await updatePlanProgress(supabase, task.study_plan_id);

  return NextResponse.json({ success: true, task: data });
}

/**
 * 학습 계획의 진행률 업데이트
 */
async function updatePlanProgress(supabase: Awaited<ReturnType<typeof createClient>>, planId: number) {
  // 해당 계획의 모든 항목 조회
  const { data: tasks } = await supabase
    .from('study_tasks')
    .select('status')
    .eq('study_plan_id', planId);

  if (!tasks) return;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 계획 업데이트
  await supabase
    .from('study_plans')
    .update({
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString(),
      // 모든 항목이 완료되면 계획도 완료 처리
      ...(completedTasks === totalTasks && totalTasks > 0
        ? { status: 'completed', completed_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', planId);
}
