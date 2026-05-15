import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAnalysisContext, retrieveRelevantMemories } from '@/lib/context-builder';
import { buildContextPrompt } from '@/lib/gemini';
import type { ReportType } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_REPORT_TYPES: ReportType[] = [
  'test',
  'level_test',
  'weekly',
  'monthly',
  'semi_annual',
  'annual',
  'self_analysis',
  'consolidated',
];

/**
 * POST /api/embeddings/query
 * 관리자용: 기억 검색 테스트
 *
 * body: { queryText: string, studentId: number, limit?: number, includeContextPreview?: boolean }
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

  const {
    queryText,
    studentId,
    limit = 5,
    includeContextPreview = false,
    reportType = 'test',
  } = await req.json();

  const safeQueryText = typeof queryText === 'string' ? queryText.trim().slice(0, 1000) : '';

  if (!safeQueryText || !studentId) {
    return NextResponse.json({ error: 'queryText, studentId 필수' }, { status: 400 });
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const safeReportType = VALID_REPORT_TYPES.includes(reportType as ReportType)
    ? reportType as ReportType
    : 'test';

  try {
    let memories = includeContextPreview
      ? []
      : await retrieveRelevantMemories(Number(studentId), safeQueryText, { limit: safeLimit });
    const response: {
      memories: typeof memories;
      diagnostics: {
        memoryCount: number;
        contextPreviewRequested: boolean;
        ragPromptInjected?: boolean;
        contextPromptExcerpt?: string;
      };
    } = {
      memories,
      diagnostics: {
        memoryCount: memories.length,
        contextPreviewRequested: Boolean(includeContextPreview),
      },
    };

    if (includeContextPreview) {
      const context = await buildAnalysisContext(Number(studentId), safeReportType, {
        queryText: safeQueryText,
      });
      memories = context.relevantMemories ?? memories;
      response.memories = memories;
      response.diagnostics.memoryCount = memories.length;
      const prompt = buildContextPrompt(context);
      response.diagnostics.ragPromptInjected = prompt.includes('과거 기억 서랍');
      response.diagnostics.contextPromptExcerpt = prompt.slice(0, 1200);
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('[Query] 기억 검색 실패:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '검색 실패' },
      { status: 500 }
    );
  }
}
