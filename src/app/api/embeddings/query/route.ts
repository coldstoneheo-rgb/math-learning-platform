import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { retrieveRelevantMemories } from '@/lib/context-builder';

export const dynamic = 'force-dynamic';

/**
 * POST /api/embeddings/query
 * 관리자용: 기억 검색 테스트
 *
 * body: { queryText: string, studentId: number, limit?: number }
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { queryText, studentId, limit = 5 } = await req.json();

  if (!queryText || !studentId) {
    return NextResponse.json({ error: 'queryText, studentId 필수' }, { status: 400 });
  }

  try {
    const memories = await retrieveRelevantMemories(Number(studentId), queryText, { limit });
    return NextResponse.json({ memories });
  } catch (err) {
    console.error('[Query] 기억 검색 실패:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '검색 실패' },
      { status: 500 }
    );
  }
}
