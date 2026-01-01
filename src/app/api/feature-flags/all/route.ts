import { NextResponse } from 'next/server';
import { getAllFlags } from '@/lib/feature-flags';

/**
 * 모든 Feature Flag 조회 API (관리자용)
 *
 * GET /api/feature-flags/all
 */
export async function GET() {
  // TODO: 관리자 인증 확인
  // const supabase = await createClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user || user.role !== 'teacher') {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const flags = getAllFlags();

  return NextResponse.json({
    flags,
    timestamp: new Date().toISOString(),
  });
}
