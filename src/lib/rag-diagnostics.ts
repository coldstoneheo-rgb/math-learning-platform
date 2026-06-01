import type { RagDiagnostics, RelevantMemory } from '@/types';

export type RagDiagnosticsTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface RagDiagnosticsDisplay {
  title: string;
  detail: string;
  sourceLabel: string;
  attemptLabel: string;
  tone: RagDiagnosticsTone;
}

export function normalizeRagQueryText(queryText?: string): string | undefined {
  if (typeof queryText !== 'string') return undefined;
  const normalized = queryText?.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 1000);
}

export function getRagFailureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 300);
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim().slice(0, 300);
  }
  if (error && typeof error === 'object') {
    const maybeError = error as { message?: unknown; error?: unknown };
    const message = maybeError.message ?? maybeError.error;
    if (typeof message === 'string' && message.trim()) {
      return message.trim().slice(0, 300);
    }
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
    retrievalAttempted:
      args.retrievalAttempted ?? (retrievalSource === 'retrieved' || retrievalSource === 'failed'),
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

export function getRagRetrievalSourceLabel(
  source: RagDiagnostics['retrievalSource'] | undefined
): string {
  switch (source) {
    case 'retrieved':
      return '과거 기억 찾음';
    case 'provided':
      return '참고 후보 전달';
    case 'failed':
      return '찾기 실패';
    case 'none':
    default:
      return '찾기 없음';
  }
}

export function getRagDiagnosticsDisplay(
  diagnostics: RagDiagnostics | undefined
): RagDiagnosticsDisplay {
  if (!diagnostics) {
    return {
      title: '진단 정보 없음',
      detail: '검색 테스트 응답에 AI 기억 확인 정보가 포함되지 않았습니다.',
      sourceLabel: '미확인',
      attemptLabel: '미확인',
      tone: 'neutral',
    };
  }

  const sourceLabel = getRagRetrievalSourceLabel(diagnostics.retrievalSource);
  const attemptLabel = diagnostics.retrievalAttempted ? '시도됨' : '시도 안 함';

  if (diagnostics.retrievalSource === 'failed') {
    return {
      title: '과거 기억 찾기 실패',
      detail: diagnostics.failureReason
        ? `검색 시도 중 오류가 발생했습니다: ${diagnostics.failureReason}`
        : '검색 시도 중 오류가 발생했습니다.',
      sourceLabel,
      attemptLabel,
      tone: 'danger',
    };
  }

  if (diagnostics.retrievalSource === 'retrieved') {
    return {
      title: diagnostics.memoryCount > 0 ? '과거 기억 찾기 성공' : '과거 기억 찾기 결과 없음',
      detail: diagnostics.memoryCount > 0
        ? `과거 기억 ${diagnostics.memoryCount}건을 찾았습니다.`
        : '찾기는 실행됐지만 현재 검색어와 충분히 비슷한 과거 기억이 없습니다.',
      sourceLabel,
      attemptLabel,
      tone: diagnostics.memoryCount > 0 ? 'success' : 'warning',
    };
  }

  if (diagnostics.retrievalSource === 'provided') {
    return {
      title: diagnostics.memoryCount > 0 ? '분석 참고 후보 확인' : '제공된 기억 없음',
      detail: diagnostics.memoryCount > 0
        ? `검색된 기억 ${diagnostics.memoryCount}건을 분석 미리보기에 전달했습니다.`
        : '분석 미리보기에 전달된 과거 기억이 없습니다.',
      sourceLabel,
      attemptLabel,
      tone: diagnostics.memoryCount > 0 ? 'success' : 'neutral',
    };
  }

  return {
    title: '과거 기억 찾기 미실행',
    detail: diagnostics.queryTextPresent
      ? '검색 조건은 있지만 이 경로에서는 과거 기억 찾기가 실행되지 않았습니다.'
      : '검색어가 없어 과거 기억 찾기를 실행하지 않았습니다.',
    sourceLabel,
    attemptLabel,
    tone: 'neutral',
  };
}
