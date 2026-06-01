import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRagDiagnostics,
  getRagFailureReason,
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
    retrievalAttempted: true,
    failureReason: getRagFailureReason(new Error('RPC unavailable')),
  });

  assert.equal(diagnostics.retrievalAttempted, true);
  assert.equal(diagnostics.retrievalSource, 'failed');
  assert.equal(diagnostics.memoryCount, 0);
  assert.equal(diagnostics.failureReason, 'RPC unavailable');
});

test('detects whether the context prompt contains the RAG memory drawer', () => {
  assert.equal(hasRagMemoryDrawer('## 💭 과거 기억 서랍 (RAG Memory Drawer)'), true);
  assert.equal(hasRagMemoryDrawer('## 최근 리포트 요약'), false);
});
