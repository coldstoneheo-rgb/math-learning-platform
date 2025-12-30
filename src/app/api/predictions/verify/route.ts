import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 예측 검증 실행 (자동 또는 수동)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { studentId } = body;
    const today = new Date().toISOString().split('T')[0];

    // 검증 대상 예측 조회 (target_date가 지났고 아직 검증 안 된 것)
    let query = supabase
      .from('prediction_verification')
      .select(`
        *,
        students(id, name, student_id)
      `)
      .lte('target_date', today)
      .is('actual_score', null);

    if (studentId) {
      query = query.eq('student_id', parseInt(studentId));
    }

    const { data: pendingPredictions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching predictions:', fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!pendingPredictions || pendingPredictions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No predictions to verify',
        verified: 0,
        results: [],
      });
    }

    const results = [];

    for (const prediction of pendingPredictions) {
      // 해당 학생의 target_date 이후 가장 가까운 시험 결과 찾기
      const { data: nearbyTests, error: testError } = await supabase
        .from('reports')
        .select('id, test_date, total_score, max_score, test_name')
        .eq('student_id', prediction.student_id)
        .eq('report_type', 'test')
        .gte('test_date', prediction.target_date)
        .not('total_score', 'is', null)
        .order('test_date', { ascending: true })
        .limit(1);

      if (testError) {
        console.error('Error finding nearby tests:', testError);
        continue;
      }

      if (nearbyTests && nearbyTests.length > 0) {
        const actualTest = nearbyTests[0];

        // 100점 만점 기준으로 환산
        const actualScore = actualTest.max_score && actualTest.max_score !== 100
          ? Math.round((actualTest.total_score / actualTest.max_score) * 100)
          : actualTest.total_score;

        const errorAmount = actualScore - prediction.predicted_score;
        const errorPercentage = Math.abs(errorAmount) / prediction.predicted_score * 100;
        const isAccurate = errorPercentage <= 10;

        // 예측 검증 결과 업데이트
        const { error: updateError } = await supabase
          .from('prediction_verification')
          .update({
            actual_score: actualScore,
            actual_test_id: actualTest.id,
            error_amount: errorAmount,
            error_percentage: Math.round(errorPercentage * 100) / 100,
            is_accurate: isAccurate,
            verified_at: new Date().toISOString(),
            verification_notes: `Test: ${actualTest.test_name || actualTest.id}, Date: ${actualTest.test_date}`,
          })
          .eq('id', prediction.id);

        if (updateError) {
          console.error('Error updating prediction:', updateError);
          continue;
        }

        results.push({
          predictionId: prediction.id,
          studentName: prediction.students?.name,
          timeframe: prediction.timeframe,
          predicted: prediction.predicted_score,
          actual: actualScore,
          error: errorAmount,
          errorPercentage: Math.round(errorPercentage * 100) / 100,
          isAccurate,
          testName: actualTest.test_name,
          testDate: actualTest.test_date,
        });
      }
    }

    // 전체 정확도 통계 계산
    const verifiedCount = results.length;
    const accurateCount = results.filter(r => r.isAccurate).length;
    const avgErrorPercentage = verifiedCount > 0
      ? Math.round(results.reduce((sum, r) => sum + r.errorPercentage, 0) / verifiedCount * 100) / 100
      : 0;

    return NextResponse.json({
      success: true,
      message: `${verifiedCount} predictions verified`,
      verified: verifiedCount,
      accurate: accurateCount,
      accuracyRate: verifiedCount > 0 ? Math.round(accurateCount / verifiedCount * 100) : 0,
      avgErrorPercentage,
      results,
    });
  } catch (error) {
    console.error('Prediction verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify predictions' },
      { status: 500 }
    );
  }
}

// 예측 정확도 통계 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const studentId = searchParams.get('studentId');

    // RPC 함수 호출 (마이그레이션에서 생성)
    const { data: stats, error } = await supabase.rpc(
      'get_prediction_accuracy_stats',
      studentId ? { p_student_id: parseInt(studentId) } : {}
    );

    if (error) {
      // RPC 함수가 없는 경우 직접 계산
      let query = supabase
        .from('prediction_verification')
        .select('*')
        .not('actual_score', 'is', null);

      if (studentId) {
        query = query.eq('student_id', parseInt(studentId));
      }

      const { data: predictions, error: fetchError } = await query;

      if (fetchError) {
        return NextResponse.json(
          { success: false, error: fetchError.message },
          { status: 500 }
        );
      }

      // 수동 통계 계산
      const timeframes = ['1개월', '3개월', '6개월', '1년'];
      const manualStats = timeframes.map(tf => {
        const tfPredictions = (predictions || []).filter(p => p.timeframe === tf);
        const verified = tfPredictions.filter(p => p.actual_score !== null);
        const accurate = verified.filter(p => p.is_accurate);

        return {
          timeframe: tf,
          total_predictions: tfPredictions.length,
          verified_count: verified.length,
          accurate_count: accurate.length,
          accuracy_rate: verified.length > 0
            ? Math.round(accurate.length / verified.length * 100)
            : null,
          avg_error_percentage: verified.length > 0
            ? Math.round(verified.reduce((sum, p) => sum + (p.error_percentage || 0), 0) / verified.length * 100) / 100
            : null,
        };
      });

      return NextResponse.json({ success: true, stats: manualStats });
    }

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Prediction stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get prediction stats' },
      { status: 500 }
    );
  }
}
