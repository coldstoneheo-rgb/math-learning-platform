import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getStudentAchievements,
  getUnnotifiedAchievements,
  markAchievementsNotified,
  getStudentTotalPoints,
} from '@/lib/badge-service';

/**
 * 학생 배지 목록 조회
 * GET /api/achievements?studentId=123
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studentIdParam = searchParams.get('studentId');
  const includeUnnotified = searchParams.get('unnotified') === 'true';

  // 사용자 정보 조회
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  let studentId: number | null = null;

  // 학생인 경우 본인 ID 조회
  if (userData?.role === 'student') {
    const { data: studentData } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!studentData) {
      return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }
    studentId = studentData.id;
  } else if (studentIdParam) {
    studentId = parseInt(studentIdParam);
  }

  if (!studentId) {
    return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
  }

  // 배지 목록 조회
  const achievements = await getStudentAchievements(studentId);
  const totalPoints = await getStudentTotalPoints(studentId);

  // 미알림 배지 조회 (선택적)
  let unnotifiedAchievements: unknown[] = [];
  if (includeUnnotified) {
    unnotifiedAchievements = await getUnnotifiedAchievements(studentId);
  }

  return NextResponse.json({
    achievements,
    totalPoints,
    unnotifiedAchievements,
    totalCount: achievements.length,
  });
}

/**
 * 배지 알림 완료 표시
 * POST /api/achievements/mark-notified
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { achievementIds } = body;

  if (!achievementIds || !Array.isArray(achievementIds)) {
    return NextResponse.json({ error: 'achievementIds 배열이 필요합니다.' }, { status: 400 });
  }

  await markAchievementsNotified(achievementIds);

  return NextResponse.json({ success: true });
}
