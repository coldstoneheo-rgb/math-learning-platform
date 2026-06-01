import type { RagDiagnostics, RelevantMemory } from '@/types';

export function normalizeRagQueryText(queryText?: string): string | undefined {
  const normalized = queryText?.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 1000);
}

export function getRagFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 300);
  }
  return 'unknown error';
}

export function buildRagDiagnostics(args: {
  queryText?: string;
  relevantMemories?: RelevantMemory[];
  retrievalSource?: RagDiagnostics['retrievalSource'];
  retrievalAttempted?: boolean;
  failureReason?: string;
  promptInjected?: boolean;
}): RagDiagnostics {
  const normalizedQueryText = normalizeRagQueryText(args.queryText);
  const memoryCount = args.relevantMemories?.length ?? 0;
  const retrievalSource = args.retrievalSource ?? (
    memoryCount > 0 ? 'provided' : 'none'
  );

  return {
    retrievalAttempted: args.retrievalAttempted ?? retrievalSource === 'retrieved',
    retrievalSource,
    queryTextPresent: Boolean(normalizedQueryText),
    queryTextLength: normalizedQueryText?.length ?? 0,
    memoryCount,
    promptInjected: args.promptInjected,
    failureReason: args.failureReason,
  };
}

export function hasRagMemoryDrawer(prompt: string): boolean {
  return prompt.includes('과거 기억 서랍');
}
