import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireTeacherOrSuperAdmin } from '@/lib/api-auth';

async function assertReportBelongsToStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportId: number,
  studentId: number
): Promise<NextResponse | null> {
  const { data: report, error } = await supabase
    .from('reports')
    .select('id, student_id')
    .eq('id', reportId)
    .single();

  if (error || !report) {
    return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
  }

  if (report.student_id !== studentId) {
    return NextResponse.json(
      { success: false, error: 'reportId does not belong to studentId' },
      { status: 400 }
    );
  }

  return null;
}

// 전략 추적 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireTeacherOrSuperAdmin(supabase);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);

    const studentId = searchParams.get('studentId');
    const reportId = searchParams.get('reportId');
    const status = searchParams.get('status');

    let query = supabase
      .from('strategy_tracking')
      .select(`
        *,
        reports!inner(
          id,
          test_name,
          test_date,
          report_type
        ),
        students!inner(
          id,
          name,
          student_id,
          grade
        )
      `)
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', parseInt(studentId));
    }

    if (reportId) {
      query = query.eq('report_id', parseInt(reportId));
    }

    if (status) {
      query = query.eq('execution_status', status);
    }

    const { data: strategies, error } = await query;

    if (error) {
      console.error('Error fetching strategies:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, strategies });
  } catch (error) {
    console.error('Strategies GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}

// 리포트에서 전략 추출하여 추적 시작
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireTeacherOrSuperAdmin(supabase);
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const { reportId, studentId, strategies } = body;

    if (!reportId || !studentId || !strategies || !Array.isArray(strategies)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const ownershipError = await assertReportBelongsToStudent(supabase, Number(reportId), Number(studentId));
    if (ownershipError) return ownershipError;

    // 기존 전략 데이터가 있는지 확인
    const { data: existingStrategies } = await supabase
      .from('strategy_tracking')
      .select('id')
      .eq('report_id', reportId);

    if (existingStrategies && existingStrategies.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Strategies already tracked for this report' },
        { status: 400 }
      );
    }

    // 전략 데이터 생성
    const strategyRecords = strategies.map((strategy, index) => ({
      report_id: reportId,
      student_id: studentId,
      strategy_index: index,
      strategy_content: strategy,
      target_concept: strategy.title || null,
      execution_status: 'pending',
    }));

    const { data: insertedStrategies, error } = await supabase
      .from('strategy_tracking')
      .insert(strategyRecords)
      .select();

    if (error) {
      console.error('Error inserting strategies:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${insertedStrategies.length} strategies tracked`,
      strategies: insertedStrategies,
    });
  } catch (error) {
    console.error('Strategies POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create strategy tracking' },
      { status: 500 }
    );
  }
}
