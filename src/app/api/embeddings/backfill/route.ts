import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbeddingsBatch } from '@/lib/embedding-service';
import { extractEmbeddableTextsFromAny } from '@/lib/embedding-extractor';

export const dynamic = 'force-dynamic';

const CHUNK_SIZE = 50;

async function markIndexStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    reportId: number;
    studentId: number;
    status: 'indexed' | 'skipped' | 'failed';
    indexedChunks?: number;
    lastError?: string | null;
  }
) {
  const { error } = await supabase.from('embedding_index_status').upsert({
    report_id: params.reportId,
    student_id: params.studentId,
    status: params.status,
    indexed_chunks: params.indexedChunks ?? 0,
    last_error: params.lastError ?? null,
    last_attempted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('[Backfill] 상태 기록 실패:', error.message);
  }
}

/**
 * POST /api/embeddings/backfill
 * 임베딩이 없는 리포트를 일괄 인덱싱
 *
 * body: { studentId?: number }  // 없으면 전체 학생
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // teacher 권한 확인
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || userData.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { studentId } = body as { studentId?: number };

  // 임베딩 없는 리포트 조회 (LEFT JOIN)
  let query = supabase
    .from('reports')
    .select('id, student_id, report_type, test_date, analysis_data')
    .limit(CHUNK_SIZE);

  if (studentId) {
    query = query.eq('student_id', studentId);
  }

  const { data: allReports, error: reportErr } = await query;
  if (reportErr) {
    return NextResponse.json({ error: reportErr.message }, { status: 500 });
  }

  if (!allReports || allReports.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  // 이미 인덱싱된 report_id 목록
  const reportIds = allReports.map((r) => r.id);
  const { data: existingEmbeds } = await supabase
    .from('report_embeddings')
    .select('report_id')
    .in('report_id', reportIds);

  const embeddedSet = new Set((existingEmbeds ?? []).map((e) => e.report_id));
  const toProcess = allReports.filter((r) => !embeddedSet.has(r.id));

  if (toProcess.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: '모두 인덱싱 완료' });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const report of toProcess) {
    const analysisData = report.analysis_data as Record<string, unknown>;
    if (!analysisData) {
      await markIndexStatus(supabase, {
        reportId: report.id,
        studentId: report.student_id,
        status: 'skipped',
        lastError: 'analysis_data 없음',
      });
      continue;
    }

    const chunks = extractEmbeddableTextsFromAny(analysisData);
    if (chunks.length === 0) {
      await markIndexStatus(supabase, {
        reportId: report.id,
        studentId: report.student_id,
        status: 'skipped',
        lastError: '추출 가능한 텍스트 없음',
      });
      continue;
    }

    try {
      const texts = chunks.map((c) => c.text);
      const embeddings = await generateEmbeddingsBatch(texts, 100);

      const rows = chunks.map((chunk, i) => ({
        report_id: report.id,
        student_id: report.student_id,
        source_text: chunk.text,
        source_type: chunk.sourceType,
        embedding: `[${embeddings[i].join(',')}]`,
        report_type: report.report_type,
        test_date: report.test_date ?? null,
      }));

      const { error } = await supabase.from('report_embeddings').insert(rows);
      if (error) {
        console.error(`[Backfill] report ${report.id} 저장 실패:`, error.message);
        await markIndexStatus(supabase, {
          reportId: report.id,
          studentId: report.student_id,
          status: 'failed',
          lastError: error.message,
        });
        errorCount++;
      } else {
        await markIndexStatus(supabase, {
          reportId: report.id,
          studentId: report.student_id,
          status: 'indexed',
          indexedChunks: rows.length,
        });
        successCount++;
      }
    } catch (err) {
      console.error(`[Backfill] report ${report.id} 임베딩 실패:`, err);
      await markIndexStatus(supabase, {
        reportId: report.id,
        studentId: report.student_id,
        status: 'failed',
        lastError: err instanceof Error ? err.message : '임베딩 실패',
      });
      errorCount++;
    }

    // rate limit 보호
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({
    success: true,
    processed: successCount,
    errors: errorCount,
    total: toProcess.length,
  });
}
