import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildAnalysisContext, retrieveRelevantMemories } from '@/lib/context-builder';
import { buildContextPrompt } from '@/lib/gemini';
import { requireTeacherOrSuperAdmin } from '@/lib/api-auth';
import { buildRagDiagnostics, hasRagMemoryDrawer } from '@/lib/rag-diagnostics';
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

  const auth = await requireTeacherOrSuperAdmin(supabase);
  if (!auth.ok) return auth.response;

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
    const memories = await retrieveRelevantMemories(Number(studentId), safeQueryText, {
      limit: safeLimit,
    });
    const response: {
      memories: typeof memories;
      diagnostics: {
        memoryCount: number;
        ragDiagnostics: ReturnType<typeof buildRagDiagnostics>;
        contextRagDiagnostics?: ReturnType<typeof buildRagDiagnostics>;
        contextPreviewRequested: boolean;
        ragPromptInjected?: boolean;
        contextPromptExcerpt?: string;
      };
    } = {
      memories,
      diagnostics: {
        memoryCount: memories.length,
        ragDiagnostics: buildRagDiagnostics({
          queryText: safeQueryText,
          relevantMemories: memories,
          retrievalSource: 'retrieved',
          retrievalAttempted: true,
        }),
        contextPreviewRequested: Boolean(includeContextPreview),
      },
    };

    if (includeContextPreview) {
      const context = await buildAnalysisContext(Number(studentId), safeReportType, {
        queryText: safeQueryText,
        relevantMemories: memories,
      });
      const prompt = buildContextPrompt(context);
      response.diagnostics.ragPromptInjected = hasRagMemoryDrawer(prompt);
      response.diagnostics.ragDiagnostics = {
        ...response.diagnostics.ragDiagnostics,
        promptInjected: response.diagnostics.ragPromptInjected,
      };
      response.diagnostics.contextRagDiagnostics = context.ragDiagnostics
        ? {
            ...context.ragDiagnostics,
            promptInjected: response.diagnostics.ragPromptInjected,
          }
        : undefined;
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
