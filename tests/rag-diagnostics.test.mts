import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRagDiagnostics,
  getRagFailureReason,
  getRagDiagnosticsDisplay,
  getRagRetrievalSourceLabel,
  hasRagMemoryDrawer,
  normalizeRagQueryText,
} from '../src/lib/rag-diagnostics.js';
import type { RelevantMemory } from '../src/types/index.js';

const sampleMemories: RelevantMemory[] = [
  {
    reportId: 42,
    reportType: 'test',
    testDate: '2026-05-16',
    sourceType: 'weakness',
    text: '외각의 합 360도 개념은 알고 있으나 긴장 상황에서 회수 실패',
    similarity: 0.91,
  },
];

test('normalizes RAG query text without keeping empty queries', () => {
  assert.equal(normalizeRagQueryText('  기본도형 기말고사  '), '기본도형 기말고사');
  assert.equal(normalizeRagQueryText('   '), undefined);
  assert.equal(normalizeRagQueryText(undefined), undefined);
  // @ts-expect-error testing runtime safety at API boundaries
  assert.equal(normalizeRagQueryText(12345), undefined);
});

test('diagnostics record provided memories without marking retrieval attempted', () => {
  const diagnostics = buildRagDiagnostics({
    queryText: '기말고사 도형 분석',
    relevantMemories: sampleMemories,
    retrievalSource: 'provided',
    retrievalAttempted: false,
    promptInjected: true,
  });

  assert.equal(diagnostics.retrievalAttempted, false);
  assert.equal(diagnostics.retrievalSource, 'provided');
  assert.equal(diagnostics.queryTextPresent, true);
  assert.equal(diagnostics.memoryCount, 1);
  assert.equal(diagnostics.promptInjected, true);
});

test('diagnostics record retrieval failures without requiring memories', () => {
  const diagnostics = buildRagDiagnostics({
    queryText: '통계 약점 분석',
    retrievalSource: 'failed',
    failureReason: getRagFailureReason(new Error('RPC unavailable')),
  });

  assert.equal(diagnostics.retrievalAttempted, true);
  assert.equal(diagnostics.retrievalSource, 'failed');
  assert.equal(diagnostics.memoryCount, 0);
  assert.equal(diagnostics.failureReason, 'RPC unavailable');
});

test('normalizes non-Error failure reasons for client and RPC errors', () => {
  assert.equal(getRagFailureReason('string error'), 'string error');
  assert.equal(getRagFailureReason({ message: 'object message' }), 'object message');
  assert.equal(getRagFailureReason({ error: 'object error' }), 'object error');
  assert.equal(getRagFailureReason({ message: 404 }), 'unknown error');
  assert.equal(getRagFailureReason(null), 'unknown error');
});

test('detects whether the context prompt contains the RAG memory drawer', () => {
  assert.equal(hasRagMemoryDrawer('## 💭 과거 기억 서랍 (RAG Memory Drawer)'), true);
  assert.equal(hasRagMemoryDrawer('## 최근 리포트 요약'), false);
});

test('summarizes RAG diagnostics for teacher-facing operation checks', () => {
  assert.equal(getRagRetrievalSourceLabel('retrieved'), '과거 기억 찾음');
  assert.equal(getRagRetrievalSourceLabel('provided'), '참고 후보 전달');
  assert.equal(getRagRetrievalSourceLabel('failed'), '찾기 실패');
  assert.equal(getRagRetrievalSourceLabel('none'), '찾기 없음');

  const retrieved = getRagDiagnosticsDisplay(buildRagDiagnostics({
    queryText: '도형 약점',
    relevantMemories: sampleMemories,
    retrievalSource: 'retrieved',
  }));
  assert.equal(retrieved.tone, 'success');
  assert.equal(retrieved.sourceLabel, '과거 기억 찾음');
  assert.match(retrieved.detail, /1건/);

  const empty = getRagDiagnosticsDisplay(buildRagDiagnostics({
    queryText: '새로운 단원',
    retrievalSource: 'retrieved',
  }));
  assert.equal(empty.tone, 'warning');
  assert.match(empty.detail, /충분히 비슷한 과거 기억이 없습니다/);

  const failed = getRagDiagnosticsDisplay(buildRagDiagnostics({
    queryText: '통계',
    retrievalSource: 'failed',
    failureReason: 'RPC unavailable',
  }));
  assert.equal(failed.tone, 'danger');
  assert.match(failed.detail, /RPC unavailable/);
});
