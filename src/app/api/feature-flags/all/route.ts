import { NextResponse } from 'next/server';
import { getAllFlags } from '@/lib/feature-flags';
import { requireTeacherOrSuperAdmin } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

/**
 * 모든 Feature Flag 조회 API (관리자용)
 *
 * GET /api/feature-flags/all
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireTeacherOrSuperAdmin(supabase);
  if (!auth.ok) return auth.response;

  const flags = getAllFlags();

  return NextResponse.json({
    flags,
    timestamp: new Date().toISOString(),
  });
}
