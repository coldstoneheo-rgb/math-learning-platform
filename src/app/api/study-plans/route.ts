import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTeacherOrSuperAdmin } from '@/lib/api-auth';
import type { StudyPlanInput, StudyTaskInput } from '@/types';

/**
 * 학습 계획 목록 조회
 * GET /api/study-plans?student_id=1&status=active
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get('student_id');
  const status = searchParams.get('status');

  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let query = supabase
    .from('study_plans')
    .select(`
      *,
      students (id, name, student_id, grade)
    `)
    .order('created_at', { ascending: false });

  // 필터 적용
  if (studentId) {
    query = query.eq('student_id', parseInt(studentId));
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch study plans:', error);
    return NextResponse.json(
      { error: '학습 계획을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ plans: data });
}

/**
 * 학습 계획 생성
 * POST /api/study-plans
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const auth = await requireTeacherOrSuperAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { plan, tasks }: { plan: StudyPlanInput; tasks?: Omit<StudyTaskInput, 'study_plan_id'>[] } = body;

  if (plan.report_id) {
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, student_id')
      .eq('id', plan.report_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (report.student_id !== plan.student_id) {
      return NextResponse.json(
        { error: '리포트와 학생 정보가 일치하지 않습니다.' },
        { status: 400 }
      );
    }
  }

  // 학습 계획 생성
  const { data: createdPlan, error: planError } = await supabase
    .from('study_plans')
    .insert({
      student_id: plan.student_id,
      title: plan.title,
      description: plan.description,
      period_type: plan.period_type,
      start_date: plan.start_date,
      end_date: plan.end_date,
      status: plan.status || 'draft',
      report_id: plan.report_id,
      created_by: plan.created_by || 'teacher',
      total_tasks: tasks?.length || 0,
      completed_tasks: 0,
      progress_percentage: 0,
    })
    .select()
    .single();

  if (planError) {
    console.error('Failed to create study plan:', planError);
    return NextResponse.json(
      { error: '학습 계획 생성에 실패했습니다.' },
      { status: 500 }
    );
  }

  // 학습 항목 생성
  if (tasks && tasks.length > 0) {
    const tasksToInsert = tasks.map((task, index) => ({
      study_plan_id: createdPlan.id,
      student_id: plan.student_id,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      source: task.source,
      page_range: task.page_range,
      problem_numbers: task.problem_numbers,
      estimated_minutes: task.estimated_minutes,
      status: 'pending' as const,
      order_index: index,
    }));

    const { error: tasksError } = await supabase
      .from('study_tasks')
      .insert(tasksToInsert);

    if (tasksError) {
      console.error('Failed to create study tasks:', tasksError);
      // 계획은 생성되었으므로 부분 성공으로 처리
      return NextResponse.json({
        plan: createdPlan,
        warning: '학습 항목 생성 중 일부 오류가 발생했습니다.',
      });
    }
  }

  return NextResponse.json({
    success: true,
    plan: createdPlan,
  });
}
