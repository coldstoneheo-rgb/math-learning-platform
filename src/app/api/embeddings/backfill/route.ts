import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { generateEmbeddingsBatch } from '@/lib/embedding-service';
import { extractEmbeddableTextsFromAny } from '@/lib/embedding-extractor';
import { requireTeacherOrSuperAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

const CHUNK_SIZE = 50;

async function markIndexStatus(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
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

  const auth = await requireTeacherOrSuperAdmin(supabase);
  if (!auth.ok) return auth.response;
  const db = auth.user.role === 'super_admin' ? createAdminClient() : supabase;

  const body = await req.json().catch(() => ({}));
  const { studentId } = body as { studentId?: number };

  // 임베딩 없는 리포트 조회 (LEFT JOIN)
  let query = db
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
  const { data: existingEmbeds } = await db
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
      await markIndexStatus(db, {
        reportId: report.id,
        studentId: report.student_id,
        status: 'skipped',
        lastError: 'analysis_data 없음',
      });
      continue;
    }

    const chunks = extractEmbeddableTextsFromAny(analysisData);
    if (chunks.length === 0) {
      await markIndexStatus(db, {
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

      const { error } = await db.from('report_embeddings').insert(rows);
      if (error) {
        console.error(`[Backfill] report ${report.id} 저장 실패:`, error.message);
        await markIndexStatus(db, {
          reportId: report.id,
          studentId: report.student_id,
          status: 'failed',
          lastError: error.message,
        });
        errorCount++;
      } else {
        await markIndexStatus(db, {
          reportId: report.id,
          studentId: report.student_id,
          status: 'indexed',
          indexedChunks: rows.length,
        });
        successCount++;
      }
    } catch (err) {
      console.error(`[Backfill] report ${report.id} 임베딩 실패:`, err);
      await markIndexStatus(db, {
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
