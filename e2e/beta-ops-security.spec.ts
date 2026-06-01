import { test, expect } from '@playwright/test';

test.describe('베타 운영 보안 표면', () => {
  test('전체 Feature Flag 조회 API는 비로그인 접근을 차단함', async ({ request }) => {
    const response = await request.get('/api/feature-flags/all');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toMatch(/application\/json/);

    const body = await response.json();
    expect(body).toMatchObject({ success: false, error: 'Unauthorized' });
  });

  test('Sentry 예제 라우트는 공개되지 않음', async ({ request }) => {
    const pageResponse = await request.get('/sentry-example-page', { maxRedirects: 0 });
    const apiResponse = await request.get('/api/sentry-example-api');

    expect([307, 308, 404]).toContain(pageResponse.status());
    expect(apiResponse.status()).toBe(404);
  });
});
