import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 예측 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const studentId = searchParams.get('studentId');
    const verified = searchParams.get('verified');

    let query = supabase
      .from('prediction_verification')
      .select(`
        *,
        reports!prediction_verification_report_id_fkey(
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
      .order('target_date', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', parseInt(studentId));
    }

    if (verified === 'true') {
      query = query.not('actual_score', 'is', null);
    } else if (verified === 'false') {
      query = query.is('actual_score', null);
    }

    const { data: predictions, error } = await query;

    if (error) {
      console.error('Error fetching predictions:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, predictions });
  } catch (error) {
    console.error('Predictions GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

// 예측 데이터 생성 (리포트 저장 시 자동 호출)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { reportId, studentId, predictions } = body;

    if (!reportId || !studentId || !predictions || !Array.isArray(predictions)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const predictionDate = new Date();

    // 예측 데이터 생성
    const predictionRecords = predictions.map(prediction => {
      // timeframe에 따라 target_date 계산
      let monthsToAdd = 1;
      switch (prediction.timeframe) {
        case '1개월': monthsToAdd = 1; break;
        case '3개월': monthsToAdd = 3; break;
        case '6개월': monthsToAdd = 6; break;
        case '1년': monthsToAdd = 12; break;
      }

      const targetDate = new Date(predictionDate);
      targetDate.setMonth(targetDate.getMonth() + monthsToAdd);

      return {
        report_id: reportId,
        student_id: studentId,
        prediction_date: predictionDate.toISOString().split('T')[0],
        target_date: targetDate.toISOString().split('T')[0],
        timeframe: prediction.timeframe,
        predicted_score: prediction.predictedScore,
        confidence_level: prediction.confidenceLevel,
        assumptions: prediction.assumptions,
      };
    });

    const { data: insertedPredictions, error } = await supabase
      .from('prediction_verification')
      .insert(predictionRecords)
      .select();

    if (error) {
      console.error('Error inserting predictions:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${insertedPredictions.length} predictions created`,
      predictions: insertedPredictions,
    });
  } catch (error) {
    console.error('Predictions POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create predictions' },
      { status: 500 }
    );
  }
}
