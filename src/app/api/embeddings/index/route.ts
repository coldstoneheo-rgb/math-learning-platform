import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmbeddingsBatch } from '@/lib/embedding-service';
import { extractEmbeddableTextsFromAny } from '@/lib/embedding-extractor';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json({ success: true, skipped: true, message: '이미 인덱싱됨' });
  }

  // 리포트 조회
  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .select('id, report_type, test_date, analysis_data')
    .eq('id', reportId)
    .single();

  if (reportErr || !report) {
    return NextResponse.json({ error: '리포트를 찾을 수 없습니다.' }, { status: 404 });
  }

  const analysisData = report.analysis_data as Record<string, unknown>;
  if (!analysisData) {
    return NextResponse.json({ success: true, skipped: true, message: 'analysis_data 없음' });
  }

  // 텍스트 추출
  const chunks = extractEmbeddableTextsFromAny(analysisData);
  if (chunks.length === 0) {
    return NextResponse.json({ success: true, skipped: true, message: '추출 가능한 텍스트 없음' });
  }

  // 임베딩 생성
  const texts = chunks.map((c) => c.text);
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddingsBatch(texts);
  } catch (err) {
    console.error('[Embedding] 생성 실패:', err);
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
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, indexedChunks: rows.length });
}
