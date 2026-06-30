import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCriticLoop,
  formatCriticFeedback,
  type QaReport,
} from '../src/lib/report-critic.js';
import type { AnalysisData } from '../src/types/index.js';

// applyCriticLoop은 AnalysisData를 불투명하게 다루므로 최소 객체로 대체한다.
const draft = (id: string): AnalysisData => ({ id } as unknown as AnalysisData);
const qa = (score: number, verdict: QaReport['verdict'], issues: QaReport['issues'] = []): QaReport => ({
  score,
  verdict,
  issues,
  selfBiasNote: 'note',
});
const id = (a: AnalysisData): string => (a as unknown as { id: string }).id;

test('verdict가 PASS면 즉시 반환하고 보정하지 않는다', async () => {
  let regenCalls = 0;
  const result = await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async () => qa(8, 'PASS'),
    regenerate: async () => {
      regenCalls += 1;
      return draft('rev');
    },
  });
  assert.equal(id(result.analysis), 'orig');
  assert.equal(result.revisions, 0);
  assert.equal(regenCalls, 0);
  assert.equal(result.reports.length, 1);
});

test('NEEDS_REVISION이고 보정본 점수가 더 높으면 보정본을 채택한다', async () => {
  let regenCalls = 0;
  const result = await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async (d) => (id(d) === 'orig' ? qa(5, 'NEEDS_REVISION') : qa(8, 'PASS')),
    regenerate: async () => {
      regenCalls += 1;
      return draft('rev');
    },
  });
  assert.equal(id(result.analysis), 'rev');
  assert.equal(result.revisions, 1);
  assert.equal(regenCalls, 1);
  assert.equal(result.reports.length, 2);
});

test('보정본 점수가 더 낮으면 원본을 유지한다(best-of)', async () => {
  const result = await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async (d) => (id(d) === 'orig' ? qa(5, 'NEEDS_REVISION') : qa(4, 'NEEDS_REVISION')),
    regenerate: async () => draft('rev'),
  });
  assert.equal(id(result.analysis), 'orig');
  assert.equal(result.revisions, 1);
  assert.equal(result.finalReport.score, 5);
});

test('동점이라도 NEEDS_REVISION→PASS면 보정본을 채택한다', async () => {
  const result = await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async (d) => (id(d) === 'orig' ? qa(8, 'NEEDS_REVISION') : qa(8, 'PASS')),
    regenerate: async () => draft('rev'),
  });
  assert.equal(id(result.analysis), 'rev');
  assert.equal(result.finalReport.verdict, 'PASS');
});

test('동점이고 둘 다 NEEDS_REVISION이면 원본을 유지한다', async () => {
  const result = await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async () => qa(6, 'NEEDS_REVISION'),
    regenerate: async () => draft('rev'),
  });
  assert.equal(id(result.analysis), 'orig');
  assert.equal(result.revisions, 1);
});

test('점수가 계속 개선돼도 maxRevisions(기본 1)에서 멈춘다', async () => {
  // 점수가 매번 오르지만 계속 NEEDS_REVISION → break가 아니라 maxRevisions 게이트로 멈춰야 한다.
  const scores: Record<string, QaReport> = {
    orig: qa(3, 'NEEDS_REVISION'),
    rev1: qa(5, 'NEEDS_REVISION'),
    rev2: qa(7, 'NEEDS_REVISION'),
  };
  let regenCalls = 0;
  const result = await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async (d) => scores[id(d)],
    regenerate: async () => {
      regenCalls += 1;
      return draft('rev' + regenCalls);
    },
  });
  assert.equal(regenCalls, 1);
  assert.equal(result.revisions, 1);
  assert.equal(id(result.analysis), 'rev1'); // 개선된 보정본 채택
});

test('maxRevisions=2로 점수가 단계적으로 오르면 두 번 채택한다', async () => {
  const scores: Record<string, QaReport> = {
    orig: qa(3, 'NEEDS_REVISION'),
    rev1: qa(5, 'NEEDS_REVISION'),
    rev2: qa(9, 'PASS'),
  };
  let n = 0;
  const result = await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async (d) => scores[id(d)],
    regenerate: async () => {
      n += 1;
      return draft('rev' + n);
    },
    maxRevisions: 2,
  });
  assert.equal(id(result.analysis), 'rev2');
  assert.equal(result.revisions, 2);
  assert.equal(result.reports.length, 3);
});

test('evaluate가 throw하면 호출자가 처리하도록 reject한다', async () => {
  await assert.rejects(
    applyCriticLoop({
      draft: draft('orig'),
      evaluate: async () => {
        throw new Error('eval fail');
      },
      regenerate: async () => draft('rev'),
    }),
    /eval fail/
  );
});

test('regenerate는 Critic 피드백 문자열을 전달받는다', async () => {
  let received = '';
  await applyCriticLoop({
    draft: draft('orig'),
    evaluate: async (d) => (id(d) === 'orig' ? qa(4, 'NEEDS_REVISION', [{ severity: 'major', area: '실행가능성', detail: 'x' }]) : qa(9, 'PASS')),
    regenerate: async (feedback) => {
      received = feedback;
      return draft('rev');
    },
  });
  assert.match(received, /실행가능성/);
});

test('formatCriticFeedback은 결함을 심각도·영역과 함께 표기한다', () => {
  const text = formatCriticFeedback(qa(5, 'NEEDS_REVISION', [{ severity: 'critical', area: '안전성', detail: '근거 없음' }]));
  assert.match(text, /critical/);
  assert.match(text, /안전성/);
  assert.match(text, /근거 없음/);
});

test('formatCriticFeedback은 결함이 없으면 일반 안내를 반환한다', () => {
  const text = formatCriticFeedback(qa(6, 'NEEDS_REVISION', []));
  assert.match(text, /6\/10/);
});
