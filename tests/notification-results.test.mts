import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNotificationChannelLabel,
  summarizeNotificationSendResults,
} from '../src/lib/notifications/results.js';

test('summarizes fully successful notification channels', () => {
  const summary = summarizeNotificationSendResults([
    { channel: 'in_app', ok: true, status: 'sent' },
    { channel: 'email', ok: true, status: 'sent' },
  ], '찬빈 학부모');

  assert.equal(summary.tone, 'success');
  assert.equal(summary.successCount, 2);
  assert.equal(summary.failedCount, 0);
  assert.match(summary.message, /찬빈 학부모님께 인앱\/이메일 알림을 발송했습니다/);
});

test('summarizes partial notification failure with channel detail', () => {
  const summary = summarizeNotificationSendResults([
    { channel: 'in_app', ok: true, status: 'sent' },
    { channel: 'email', ok: false, status: 'failed', error: 'RESEND_API_KEY is not configured.' },
  ]);

  assert.equal(summary.tone, 'partial');
  assert.equal(summary.successCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.deepEqual(summary.failedLabels, ['이메일']);
  assert.match(summary.message, /알림 1건 성공, 1건 실패/);
  assert.match(summary.message, /이메일: RESEND_API_KEY is not configured/);
});

test('summarizes skipped email without treating in-app success as failure', () => {
  const summary = summarizeNotificationSendResults([
    { channel: 'in_app', ok: true, status: 'sent' },
  ], '학부모', ['학부모 이메일이 없어 이메일은 건너뛰었습니다.']);

  assert.equal(summary.tone, 'success');
  assert.equal(summary.successCount, 1);
  assert.equal(summary.failedCount, 0);
  assert.match(summary.message, /인앱 알림을 발송했습니다/);
  assert.match(summary.message, /이메일은 건너뛰었습니다/);
});

test('keeps kakao channel explicitly labeled as not production-ready', () => {
  assert.equal(getNotificationChannelLabel('kakao'), '카카오 알림톡');

  const summary = summarizeNotificationSendResults([
    {
      channel: 'kakao',
      ok: false,
      status: 'failed',
      error: '카카오 알림톡은 아직 실제 발송이 연결되지 않았습니다.',
    },
  ]);

  assert.equal(summary.tone, 'failed');
  assert.match(summary.message, /카카오 알림톡은 아직 실제 발송이 연결되지 않았습니다/);
});
