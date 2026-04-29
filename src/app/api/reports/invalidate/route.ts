/**
 * Cache Invalidation Endpoint
 *
 * 리포트 저장/수정 후 Next.js 서버 캐시 무효화
 * POST /api/reports/invalidate
 *
 * 클라이언트 컴포넌트에서 Supabase에 직접 저장한 후 이 엔드포인트를 호출하여
 * report-cache.ts의 unstable_cache를 무효화합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { invalidateReportCache } from '@/lib/report-cache';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    invalidateReportCache();
    return NextResponse.json({ success: true, message: '캐시가 무효화되었습니다.' });
  } catch (error) {
    console.error('[CacheInvalidation] 캐시 무효화 실패:', error);
    return NextResponse.json({ success: false, error: '캐시 무효화 실패' }, { status: 500 });
  }
}
