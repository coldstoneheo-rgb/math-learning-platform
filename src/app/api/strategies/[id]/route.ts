import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 개별 전략 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: strategy, error } = await supabase
      .from('strategy_tracking')
      .select(`
        *,
        reports(id, test_name, test_date, report_type),
        students(id, name, student_id, grade)
      `)
      .eq('id', parseInt(id))
      .single();

    if (error) {
      console.error('Error fetching strategy:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, strategy });
  } catch (error) {
    console.error('Strategy GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch strategy' },
      { status: 500 }
    );
  }
}

// 전략 상태 및 효과 업데이트
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();

    const {
      execution_status,
      execution_notes,
      started_at,
      completed_at,
      pre_score,
      post_score,
      effectiveness_rating,
      difficulty_rating,
      feedback,
    } = body;

    // 업데이트할 필드 구성
    const updateData: Record<string, unknown> = {};

    if (execution_status !== undefined) {
      updateData.execution_status = execution_status;

      // 상태에 따라 시간 자동 설정
      if (execution_status === 'in_progress' && !started_at) {
        updateData.started_at = new Date().toISOString();
      }
      if (execution_status === 'completed' && !completed_at) {
        updateData.completed_at = new Date().toISOString();
      }
    }

    if (execution_notes !== undefined) updateData.execution_notes = execution_notes;
    if (started_at !== undefined) updateData.started_at = started_at;
    if (completed_at !== undefined) updateData.completed_at = completed_at;
    if (pre_score !== undefined) updateData.pre_score = pre_score;
    if (post_score !== undefined) updateData.post_score = post_score;
    if (effectiveness_rating !== undefined) updateData.effectiveness_rating = effectiveness_rating;
    if (difficulty_rating !== undefined) updateData.difficulty_rating = difficulty_rating;
    if (feedback !== undefined) updateData.feedback = feedback;

    // 개선율 자동 계산
    if (pre_score !== undefined && post_score !== undefined) {
      updateData.improvement_rate = post_score - pre_score;
    }

    const { data: strategy, error } = await supabase
      .from('strategy_tracking')
      .update(updateData)
      .eq('id', parseInt(id))
      .select(`
        *,
        reports(id, test_name, test_date),
        students(id, name)
      `)
      .single();

    if (error) {
      console.error('Error updating strategy:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Strategy updated successfully',
      strategy,
    });
  } catch (error) {
    console.error('Strategy PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update strategy' },
      { status: 500 }
    );
  }
}

// 전략 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { error } = await supabase
      .from('strategy_tracking')
      .delete()
      .eq('id', parseInt(id));

    if (error) {
      console.error('Error deleting strategy:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Strategy deleted successfully',
    });
  } catch (error) {
    console.error('Strategy DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete strategy' },
      { status: 500 }
    );
  }
}
