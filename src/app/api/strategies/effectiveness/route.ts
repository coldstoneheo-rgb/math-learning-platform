import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface StrategyTracking {
  id: number;
  strategy_content: {
    type?: string;
    title?: string;
    priority?: number;
  };
  target_concept: string | null;
  execution_status: string;
  improvement_rate: number | null;
  effectiveness_rating: number | null;
  completed_at: string | null;
}

// 전략 효과 분석 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const studentId = searchParams.get('studentId');

    // 1. 모든 완료된 전략 데이터 조회
    let query = supabase
      .from('strategy_tracking')
      .select('*')
      .eq('execution_status', 'completed')
      .order('completed_at', { ascending: false });

    if (studentId) {
      query = query.eq('student_id', parseInt(studentId));
    }

    const { data: strategies, error } = await query;

    if (error) {
      console.error('Error fetching strategies:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // 2. 전략 유형별 효과 분석
    const effectivenessByType = analyzeByType(strategies || []);

    // 3. 개념별 개선 추이
    const improvementByConcept = analyzeByConcept(strategies || []);

    // 4. 가장 효과적인 전략 패턴 추출
    const bestPatterns = extractBestPatterns(strategies || []);

    // 5. 비효과적 전략 분석 (다른 접근 필요)
    const ineffectiveStrategies = (strategies || [])
      .filter(s => (s.improvement_rate || 0) < 5 && s.execution_status === 'completed')
      .map(s => ({
        type: s.strategy_content?.type,
        title: s.strategy_content?.title,
        concept: s.target_concept,
        improvement: s.improvement_rate,
        feedback: s.feedback,
      }));

    // 6. 전체 통계
    const completedStrategies = strategies || [];
    const totalStats = {
      totalStrategies: completedStrategies.length,
      avgImprovement: completedStrategies.length > 0
        ? completedStrategies.reduce((sum, s) => sum + (s.improvement_rate || 0), 0) / completedStrategies.length
        : 0,
      avgRating: completedStrategies.filter(s => s.effectiveness_rating).length > 0
        ? completedStrategies.reduce((sum, s) => sum + (s.effectiveness_rating || 0), 0) /
          completedStrategies.filter(s => s.effectiveness_rating).length
        : 0,
      successRate: completedStrategies.length > 0
        ? completedStrategies.filter(s => (s.improvement_rate || 0) >= 10).length / completedStrategies.length * 100
        : 0,
    };

    // 7. AI 프롬프트용 컨텍스트 생성
    const aiContext = generateAIContext(bestPatterns, ineffectiveStrategies);

    return NextResponse.json({
      success: true,
      totalStats,
      effectivenessByType,
      improvementByConcept,
      bestPatterns,
      ineffectiveStrategies,
      aiContext,
    });
  } catch (error) {
    console.error('Effectiveness analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze strategy effectiveness' },
      { status: 500 }
    );
  }
}

function analyzeByType(strategies: StrategyTracking[]) {
  const types = ['개념 교정', '습관 교정', '전략 개선'];

  return types.map(type => {
    const typeStrategies = strategies.filter(s =>
      s.strategy_content?.type === type
    );

    const completed = typeStrategies.filter(s => s.execution_status === 'completed');
    const withImprovement = completed.filter(s => s.improvement_rate !== null);
    const withRating = completed.filter(s => s.effectiveness_rating !== null);

    return {
      type,
      totalCount: typeStrategies.length,
      completedCount: completed.length,
      completionRate: typeStrategies.length > 0
        ? Math.round(completed.length / typeStrategies.length * 100)
        : 0,
      avgImprovement: withImprovement.length > 0
        ? Math.round(withImprovement.reduce((sum, s) => sum + (s.improvement_rate || 0), 0) / withImprovement.length * 10) / 10
        : 0,
      avgRating: withRating.length > 0
        ? Math.round(withRating.reduce((sum, s) => sum + (s.effectiveness_rating || 0), 0) / withRating.length * 10) / 10
        : 0,
      successRate: withImprovement.length > 0
        ? Math.round(withImprovement.filter(s => (s.improvement_rate || 0) >= 10).length / withImprovement.length * 100)
        : 0,
    };
  });
}

function analyzeByConcept(strategies: StrategyTracking[]) {
  const conceptMap = new Map<string, {
    count: number;
    improvements: number[];
    firstScore: number | null;
    latestScore: number | null;
  }>();

  // 개념별로 그룹화
  strategies.forEach(s => {
    if (!s.target_concept) return;

    const existing = conceptMap.get(s.target_concept) || {
      count: 0,
      improvements: [],
      firstScore: null,
      latestScore: null,
    };

    existing.count++;
    if (s.improvement_rate !== null) {
      existing.improvements.push(s.improvement_rate);
    }

    conceptMap.set(s.target_concept, existing);
  });

  // 결과 변환
  return Array.from(conceptMap.entries())
    .map(([concept, data]) => ({
      concept,
      occurrenceCount: data.count,
      avgImprovement: data.improvements.length > 0
        ? Math.round(data.improvements.reduce((a, b) => a + b, 0) / data.improvements.length * 10) / 10
        : 0,
      totalImprovement: data.improvements.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.totalImprovement - a.totalImprovement);
}

function extractBestPatterns(strategies: StrategyTracking[]) {
  // 전략 제목과 유형별로 그룹화
  const patternMap = new Map<string, {
    type: string;
    title: string;
    concept: string | null;
    count: number;
    improvements: number[];
    ratings: number[];
  }>();

  strategies.forEach(s => {
    const key = `${s.strategy_content?.type}|${s.strategy_content?.title}`;

    const existing = patternMap.get(key) || {
      type: s.strategy_content?.type || 'unknown',
      title: s.strategy_content?.title || 'unknown',
      concept: s.target_concept,
      count: 0,
      improvements: [],
      ratings: [],
    };

    existing.count++;
    if (s.improvement_rate !== null) {
      existing.improvements.push(s.improvement_rate);
    }
    if (s.effectiveness_rating !== null) {
      existing.ratings.push(s.effectiveness_rating);
    }

    patternMap.set(key, existing);
  });

  // 효과적인 패턴 추출 (최소 2회 이상 사용, 평균 개선율 기준 정렬)
  return Array.from(patternMap.values())
    .filter(p => p.count >= 2 && p.improvements.length > 0)
    .map(p => ({
      type: p.type,
      title: p.title,
      concept: p.concept,
      usageCount: p.count,
      avgImprovement: Math.round(p.improvements.reduce((a, b) => a + b, 0) / p.improvements.length * 10) / 10,
      avgRating: p.ratings.length > 0
        ? Math.round(p.ratings.reduce((a, b) => a + b, 0) / p.ratings.length * 10) / 10
        : null,
      successRate: Math.round(p.improvements.filter(i => i >= 10).length / p.improvements.length * 100),
    }))
    .sort((a, b) => b.avgImprovement - a.avgImprovement)
    .slice(0, 10);
}

function generateAIContext(
  bestPatterns: ReturnType<typeof extractBestPatterns>,
  ineffectiveStrategies: Array<{
    type: unknown;
    title: unknown;
    concept: string | null;
    improvement: number | null;
    feedback: unknown;
  }>
) {
  let context = '';

  if (bestPatterns.length > 0) {
    context += '## 효과적이었던 전략 (유사한 방식 권장)\n';
    bestPatterns.slice(0, 5).forEach(p => {
      context += `- ${p.type}: ${p.title} (평균 개선율: ${p.avgImprovement}%, 성공률: ${p.successRate}%)\n`;
    });
    context += '\n';
  }

  if (ineffectiveStrategies.length > 0) {
    context += '## 효과 없었던 전략 (다른 접근 필요)\n';
    ineffectiveStrategies.slice(0, 5).forEach(s => {
      context += `- ${s.type}: ${s.title} (개선율: ${s.improvement}%)\n`;
    });
    context += '\n';
  }

  if (context) {
    context = '# 이전 전략 효과 분석 (중요!)\n\n' + context;
    context += '위 피드백을 반영하여:\n';
    context += '1. 효과적이었던 전략과 유사한 방식의 새 전략 제안\n';
    context += '2. 효과 없었던 전략은 완전히 다른 접근법으로 대체\n';
    context += '3. 이 학생에게 맞는 개인화된 전략 수립\n';
  }

  return context;
}
