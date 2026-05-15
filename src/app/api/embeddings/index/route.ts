import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbeddingsBatch } from '@/lib/embedding-service';
import { extractEmbeddableTextsFromAny } from '@/lib/embedding-extractor';

export const dynamic = 'force-dynamic';

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
    console.warn('[Embedding] 상태 기록 실패:', error.message);
  }
}

/**
 * POST /api/embeddings/index
 * 단일 리포트를 임베딩하여 report_embeddings에 저장
 *
 * body: { reportId: number, studentId: number }
 */
export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!userData || userData.role !== 'teacher') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { reportId, studentId } = await req.json();
  if (!reportId || !studentId) {
    return NextResponse.json({ error: 'reportId, studentId 필수' }, { status: 400 });
  }

  // 이미 임베딩이 존재하면 스킵 (중복 방지)
  const { count } = await supabase
    .from('report_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', reportId);

  if ((count ?? 0) > 0) {
    await markIndexStatus(supabase, {
      reportId,
      studentId,
      status: 'skipped',
      lastError: '이미 인덱싱됨',
    });
    return NextResponse.json({ success: true, skipped: true, message: '이미 인덱싱됨' });
  }

  // 리포트 조회
  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, student_id, report_type, test_date, analysis_data')
    .eq('id', reportId)
    .single();

  if (reportErr || !report) {
    return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (report.student_id !== studentId) {
    await markIndexStatus(supabase, {
      reportId,
      studentId,
      status: 'failed',
      lastError: '요청 studentId와 리포트 student_id가 일치하지 않음',
    });
    return NextResponse.json({ error: 'studentId가 리포트 소유 학생과 일치하지 않습니다.' }, { status: 400 });
  }

  const analysisData = report.analysis_data as Record<string, unknown>;
  if (!analysisData) {
    await markIndexStatus(supabase, {
      reportId,
      studentId,
      status: 'skipped',
      lastError: 'analysis_data 없음',
    });
    return NextResponse.json({ success: true, skipped: true, message: 'analysis_data 없음' });
  }

  // 텍스트 추출
  const chunks = extractEmbeddableTextsFromAny(analysisData);
  if (chunks.length === 0) {
    await markIndexStatus(supabase, {
      reportId,
      studentId,
      status: 'skipped',
      lastError: '추출 가능한 텍스트 없음',
    });
    return NextResponse.json({ success: true, skipped: true, message: '추출 가능한 텍스트 없음' });
  }

  // 임베딩 생성
  const texts = chunks.map((c) => c.text);
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddingsBatch(texts);
  } catch (err) {
    console.error('[Embedding] 생성 실패:', err);
    await markIndexStatus(supabase, {
      reportId,
      studentId,
      status: 'failed',
      lastError: err instanceof Error ? err.message : '임베딩 생성 실패',
    });
    return NextResponse.json({ error: '임베딩 생성 실패' }, { status: 500 });
  }

  // DB 저장
  const rows = chunks.map((chunk, i) => ({
    report_id: reportId,
    student_id: studentId,
    source_text: chunk.text,
    source_type: chunk.sourceType,
    embedding: `[${embeddings[i].join(',')}]`,
    report_type: report.report_type,
    test_date: report.test_date ?? null,
  }));

  const { error: insertErr } = await supabase.from('report_embeddings').insert(rows);
  if (insertErr) {
    console.error('[Embedding] 저장 실패:', insertErr);
    await markIndexStatus(supabase, {
      reportId,
      studentId,
      status: 'failed',
      lastError: insertErr.message,
    });
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await markIndexStatus(supabase, {
    reportId,
    studentId,
    status: 'indexed',
    indexedChunks: rows.length,
  });

  return NextResponse.json({ success: true, indexedChunks: rows.length });
}
