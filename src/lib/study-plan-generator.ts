import { createClient } from '@/lib/supabase/client';
import type {
  ActionablePrescriptionItem,
  StudyTaskCategory,
  StudyTaskPriority,
} from '@/types';

function mapPrescriptionCategory(type: ActionablePrescriptionItem['type']): StudyTaskCategory {
  switch (type) {
    case '개념 교정': return 'concept_review';
    case '습관 교정': return 'weakness_practice';
    case '전략 개선': return 'problem_solving';
    default: return 'custom';
  }
}

function mapPriorityLevel(priority: number): StudyTaskPriority {
  if (priority === 1) return 'high';
  if (priority === 2) return 'medium';
  return 'low';
}

function parseEstimatedMinutes(howMuch: string): number {
  const hourMatch = howMuch.match(/(\d+)\s*시간/);
  const minMatch = howMuch.match(/(\d+)\s*분/);
  const countMatch = howMuch.match(/(\d+)\s*문제/);

  if (hourMatch) return parseInt(hourMatch[1]) * 60;
  if (minMatch) return parseInt(minMatch[1]);
  if (countMatch) return Math.min(parseInt(countMatch[1]) * 3, 90);
  return 30;
}

function getStudyPeriodDates(): { start: string; end: string } {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * AI 처방 → 학습 계획 자동 생성
 * 리포트 저장 후 호출. 실패해도 리포트 저장에 영향 없음.
 */
export async function generateStudyPlanFromPrescription(
  studentId: number,
  reportId: number,
  prescriptions: ActionablePrescriptionItem[],
  testName?: string
): Promise<{ success: boolean; planId?: number; error?: string }> {
  if (!prescriptions || prescriptions.length === 0) {
    return { success: false, error: 'No prescriptions provided' };
  }

  const supabase = createClient();
  const { start, end } = getStudyPeriodDates();
  const planTitle = testName
    ? `[AI 처방] ${testName} 학습 계획`
    : `[AI 처방] ${new Date().toLocaleDateString('ko-KR')} 학습 계획`;

  const sorted = [...prescriptions].sort((a, b) => a.priority - b.priority);

  const tasks = sorted.map((rx, index) => ({
    title: rx.whatToDo || rx.title,
    description: [rx.howTo, rx.measurementMethod ? `측정: ${rx.measurementMethod}` : ''].filter(Boolean).join('\n'),
    category: mapPrescriptionCategory(rx.type),
    priority: mapPriorityLevel(rx.priority),
    source: rx.where ? rx.where.split(' ')[0] : undefined,
    page_range: rx.where || undefined,
    estimated_minutes: parseEstimatedMinutes(rx.howMuch),
    order_index: index,
  }));

  const response = await fetch('/api/study-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan: {
        student_id: studentId,
        title: planTitle,
        description: `AI 시험 분석 결과에서 자동 생성된 학습 계획 (${sorted.length}개 처방)`,
        period_type: 'weekly',
        start_date: start,
        end_date: end,
        status: 'active',
        report_id: reportId,
        created_by: 'ai',
      },
      tasks,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return { success: false, error: err.error || 'API error' };
  }

  const result = await response.json();
  return { success: true, planId: result.plan?.id };
}

/**
 * 특정 학생의 활성 학습 계획 + 태스크 조회
 */
export async function getActiveStudyPlan(studentId: number) {
  const supabase = createClient();
  const { data } = await supabase
    .from('study_plans')
    .select('*, study_tasks(*)')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}
