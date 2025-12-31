import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 학습 계획 상세 조회
 * GET /api/study-plans/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 계획과 항목 조회
  const { data: plan, error: planError } = await supabase
    .from('study_plans')
    .select(`
      *,
      students (id, name, student_id, grade),
      study_tasks (*)
    `)
    .eq('id', parseInt(id))
    .single();

  if (planError) {
    console.error('Failed to fetch study plan:', planError);
    return NextResponse.json(
      { error: '학습 계획을 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  // 항목을 순서대로 정렬
  if (plan.study_tasks) {
    plan.study_tasks.sort((a: { order_index: number }, b: { order_index: number }) =>
      a.order_index - b.order_index
    );
  }

  return NextResponse.json({ plan });
}

/**
 * 학습 계획 수정
 * PATCH /api/study-plans/[id]
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, status, start_date, end_date } = body;

  // 업데이트할 필드 구성
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (start_date !== undefined) updateData.start_date = start_date;
  if (end_date !== undefined) updateData.end_date = end_date;

  // 상태가 completed로 변경되면 완료 시간 기록
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('study_plans')
    .update(updateData)
    .eq('id', parseInt(id))
    .select()
    .single();

  if (error) {
    console.error('Failed to update study plan:', error);
    return NextResponse.json(
      { error: '학습 계획 수정에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, plan: data });
}

/**
 * 학습 계획 삭제
 * DELETE /api/study-plans/[id]
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 먼저 연관된 학습 항목 삭제
  await supabase
    .from('study_tasks')
    .delete()
    .eq('study_plan_id', parseInt(id));

  // 계획 삭제
  const { error } = await supabase
    .from('study_plans')
    .delete()
    .eq('id', parseInt(id));

  if (error) {
    console.error('Failed to delete study plan:', error);
    return NextResponse.json(
      { error: '학습 계획 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
