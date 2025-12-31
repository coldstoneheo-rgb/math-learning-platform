/**
 * 성취 배지 서비스
 *
 * 학생의 성취 배지 획득 조건 확인 및 자동 수여
 */

import { createClient } from '@/lib/supabase/server';
import type { ReportType } from '@/types';

/**
 * 배지 정의 인터페이스
 */
export interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  category: 'milestone' | 'streak' | 'performance' | 'improvement' | 'consistency' | 'mastery' | 'special';
  icon: string;
  color: string;
  tier: number;
  condition_type: 'count' | 'streak' | 'score' | 'improvement' | 'completion' | 'custom';
  condition_value: number | null;
  condition_target: string | null;
  points: number;
  is_active: boolean;
  is_secret: boolean;
}

/**
 * 학생 배지 획득 기록
 */
export interface StudentAchievement {
  id: number;
  student_id: number;
  achievement_id: number;
  earned_at: string;
  earned_reason: string | null;
  reference_id: number | null;
  reference_type: string | null;
  is_notified: boolean;
  achievement?: Achievement;
}

/**
 * 배지 획득 결과
 */
export interface BadgeAwardResult {
  success: boolean;
  awarded: Achievement[];
  error?: string;
}

/**
 * 리포트 생성 후 배지 체크
 */
export async function checkBadgesAfterReport(
  studentId: number,
  reportId: number,
  reportType: ReportType,
  score?: number | null,
  previousScore?: number | null
): Promise<BadgeAwardResult> {
  const supabase = await createClient();
  const awarded: Achievement[] = [];

  try {
    // 모든 활성 배지 조회
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true);

    if (!achievements) {
      return { success: true, awarded: [] };
    }

    // 학생의 기존 배지 조회
    const { data: existingBadges } = await supabase
      .from('student_achievements')
      .select('achievement_id')
      .eq('student_id', studentId);

    const earnedBadgeIds = new Set((existingBadges || []).map(b => b.achievement_id));

    // 학생의 리포트 수 조회
    const { count: reportCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);

    // 각 배지 조건 체크
    for (const achievement of achievements) {
      // 이미 획득한 배지는 스킵
      if (earnedBadgeIds.has(achievement.id)) {
        continue;
      }

      let shouldAward = false;
      let reason = '';

      switch (achievement.code) {
        // 마일스톤 배지 - 리포트 수
        case 'FIRST_REPORT':
          if ((reportCount || 0) >= 1) {
            shouldAward = true;
            reason = '첫 번째 리포트 획득';
          }
          break;

        case 'FIFTH_REPORT':
          if ((reportCount || 0) >= 5) {
            shouldAward = true;
            reason = '5개 리포트 달성';
          }
          break;

        case 'TENTH_REPORT':
          if ((reportCount || 0) >= 10) {
            shouldAward = true;
            reason = '10개 리포트 달성';
          }
          break;

        case 'TWENTY_REPORT':
          if ((reportCount || 0) >= 20) {
            shouldAward = true;
            reason = '20개 리포트 달성';
          }
          break;

        // 성적 배지
        case 'SCORE_90':
          if (score != null && score >= 90) {
            shouldAward = true;
            reason = `${score}점 획득`;
          }
          break;

        case 'SCORE_100':
          if (score != null && score === 100) {
            shouldAward = true;
            reason = '만점 달성!';
          }
          break;

        // 개선 배지
        case 'IMPROVE_10':
          if (score != null && previousScore != null && score - previousScore >= 10) {
            shouldAward = true;
            reason = `${score - previousScore}점 향상`;
          }
          break;

        case 'IMPROVE_20':
          if (score != null && previousScore != null && score - previousScore >= 20) {
            shouldAward = true;
            reason = `${score - previousScore}점 향상`;
          }
          break;

        // 특별 배지
        case 'LEVEL_TEST_COMPLETE':
          if (reportType === 'level_test') {
            shouldAward = true;
            reason = '레벨 테스트 완료';
          }
          break;

        case 'ANNUAL_REVIEW':
          if (reportType === 'annual') {
            shouldAward = true;
            reason = '연간 리포트 획득';
          }
          break;
      }

      if (shouldAward) {
        // 배지 수여
        const { error: awardError } = await supabase
          .from('student_achievements')
          .insert({
            student_id: studentId,
            achievement_id: achievement.id,
            earned_reason: reason,
            reference_id: reportId,
            reference_type: 'report',
          });

        if (!awardError) {
          awarded.push(achievement);
        }
      }
    }

    return { success: true, awarded };
  } catch (error) {
    console.error('[BadgeService] Error checking badges:', error);
    return {
      success: false,
      awarded: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 학습 계획 완료 후 배지 체크
 */
export async function checkBadgesAfterPlanComplete(
  studentId: number,
  planId: number
): Promise<BadgeAwardResult> {
  const supabase = await createClient();
  const awarded: Achievement[] = [];

  try {
    // 모든 활성 배지 조회
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .eq('is_active', true)
      .in('code', ['PLAN_COMPLETE', 'PLAN_COMPLETE_3']);

    if (!achievements) {
      return { success: true, awarded: [] };
    }

    // 학생의 기존 배지 조회
    const { data: existingBadges } = await supabase
      .from('student_achievements')
      .select('achievement_id')
      .eq('student_id', studentId);

    const earnedBadgeIds = new Set((existingBadges || []).map(b => b.achievement_id));

    // 완료된 학습 계획 수 조회
    const { count: completedPlans } = await supabase
      .from('study_plans')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .eq('status', 'completed');

    for (const achievement of achievements) {
      if (earnedBadgeIds.has(achievement.id)) {
        continue;
      }

      let shouldAward = false;
      let reason = '';

      switch (achievement.code) {
        case 'PLAN_COMPLETE':
          shouldAward = true;
          reason = '학습 계획 100% 완료';
          break;

        case 'PLAN_COMPLETE_3':
          if ((completedPlans || 0) >= 3) {
            shouldAward = true;
            reason = '3개 학습 계획 완료';
          }
          break;
      }

      if (shouldAward) {
        const { error: awardError } = await supabase
          .from('student_achievements')
          .insert({
            student_id: studentId,
            achievement_id: achievement.id,
            earned_reason: reason,
            reference_id: planId,
            reference_type: 'study_plan',
          });

        if (!awardError) {
          awarded.push(achievement);
        }
      }
    }

    return { success: true, awarded };
  } catch (error) {
    console.error('[BadgeService] Error checking plan badges:', error);
    return {
      success: false,
      awarded: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 학생의 모든 배지 조회
 */
export async function getStudentAchievements(studentId: number): Promise<StudentAchievement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('student_achievements')
    .select(`
      *,
      achievement:achievements (*)
    `)
    .eq('student_id', studentId)
    .order('earned_at', { ascending: false });

  if (error) {
    console.error('[BadgeService] Error fetching student achievements:', error);
    return [];
  }

  return data || [];
}

/**
 * 새로 획득한 배지 알림 조회 (미알림)
 */
export async function getUnnotifiedAchievements(studentId: number): Promise<StudentAchievement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('student_achievements')
    .select(`
      *,
      achievement:achievements (*)
    `)
    .eq('student_id', studentId)
    .eq('is_notified', false)
    .order('earned_at', { ascending: false });

  if (error) {
    console.error('[BadgeService] Error fetching unnotified achievements:', error);
    return [];
  }

  return data || [];
}

/**
 * 배지 알림 완료 표시
 */
export async function markAchievementsNotified(achievementIds: number[]): Promise<void> {
  if (achievementIds.length === 0) return;

  const supabase = await createClient();

  await supabase
    .from('student_achievements')
    .update({
      is_notified: true,
      notified_at: new Date().toISOString(),
    })
    .in('id', achievementIds);
}

/**
 * 학생의 총 포인트 계산
 */
export async function getStudentTotalPoints(studentId: number): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('student_achievements')
    .select(`
      achievement:achievements (points)
    `)
    .eq('student_id', studentId);

  if (!data) return 0;

  return data.reduce((sum, item) => {
    const points = (item.achievement as { points?: number } | null)?.points || 0;
    return sum + points;
  }, 0);
}
