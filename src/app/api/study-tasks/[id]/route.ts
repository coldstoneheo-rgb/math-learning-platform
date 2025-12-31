import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { StudyTaskUpdate } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 학습 항목 상세 조회
 * GET /api/study-tasks/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('study_tasks')
    .select('*')
    .eq('id', parseInt(id))
    .single();

  if (error) {
    console.error('Failed to fetch study task:', error);
    return NextResponse.json(
      { error: '학습 항목을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ task: data });
}

/**
 * 학습 항목 수정 (체크 완료 등)
 * PATCH /api/study-tasks/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 사용자 역할 확인
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = userData?.role || 'student';

  const body: StudyTaskUpdate & {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    source?: string;
    page_range?: string;
    problem_numbers?: string;
    estimated_minutes?: number;
  } = await request.json();

  // 현재 항목 정보 조회
  const { data: currentTask } = await supabase
    .from('study_tasks')
    .select('study_plan_id, status')
    .eq('id', parseInt(id))
    .single();

  if (!currentTask) {
    return NextResponse.json(
      { error: '학습 항목을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 업데이트할 필드 구성
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // 기본 필드
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.priority !== undefined) updateData.priority = body.priority;
  if (body.source !== undefined) updateData.source = body.source;
  if (body.page_range !== undefined) updateData.page_range = body.page_range;
  if (body.problem_numbers !== undefined) updateData.problem_numbers = body.problem_numbers;
  if (body.estimated_minutes !== undefined) updateData.estimated_minutes = body.estimated_minutes;

  // 상태 변경
  if (body.status !== undefined) {
    updateData.status = body.status;

    // 완료 상태로 변경 시
    if (body.status === 'completed' && currentTask.status !== 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.completed_by = userRole as 'student' | 'parent' | 'teacher';
    }

    // 완료에서 다른 상태로 변경 시
    if (body.status !== 'completed' && currentTask.status === 'completed') {
      updateData.completed_at = null;
      updateData.completed_by = null;
    }
  }

  // 완료 관련 추가 정보
  if (body.completion_note !== undefined) updateData.completion_note = body.completion_note;
  if (body.actual_minutes !== undefined) updateData.actual_minutes = body.actual_minutes;
  if (body.difficulty_feedback !== undefined) updateData.difficulty_feedback = body.difficulty_feedback;

  const { data, error } = await supabase
    .from('study_tasks')
    .update(updateData)
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) {
    console.error('Failed to update study task:', error);
    return NextResponse.json(
      { error: '학습 항목 수정에 실패했습니다.' },
      { status: 500 }
    );
  }

  // 계획의 진행률 업데이트
  await updatePlanProgress(supabase, currentTask.study_plan_id);

  return NextResponse.json({ success: true, task: data });
}

/**
 * 학습 항목 삭제
 * DELETE /api/study-tasks/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 현재 항목 정보 조회 (계획 ID 필요)
  const { data: currentTask } = await supabase
    .from('study_tasks')
    .select('study_plan_id')
    .eq('id', parseInt(id))
    .single();

  if (!currentTask) {
    return NextResponse.json(
      { error: '학습 항목을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from('study_tasks')
    .delete()
    .eq('id', parseInt(id));

  if (error) {
    console.error('Failed to delete study task:', error);
    return NextResponse.json(
      { error: '학습 항목 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }

  // 계획의 진행률 업데이트
  await updatePlanProgress(supabase, currentTask.study_plan_id);

  return NextResponse.json({ success: true });
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
  const updateData: Record<string, unknown> = {
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    progress_percentage: progressPercentage,
    updated_at: new Date().toISOString(),
  };

  // 모든 항목이 완료되면 계획도 완료 처리
  if (completedTasks === totalTasks && totalTasks > 0) {
    updateData.status = 'completed';
    updateData.completed_at = new Date().toISOString();
  }

  await supabase
    .from('study_plans')
    .update(updateData)
    .eq('id', planId);
}
