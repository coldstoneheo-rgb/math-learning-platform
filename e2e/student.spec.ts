import { test, expect } from './fixtures';

test.describe('학생 대시보드', () => {
  test.skip(
    !process.env.TEST_STUDENT_EMAIL || !process.env.TEST_STUDENT_PASSWORD,
    'Student E2E requires TEST_STUDENT_EMAIL and TEST_STUDENT_PASSWORD for a real student account.'
  );

  test.beforeEach(async ({ loginAsStudent }) => {
    await loginAsStudent();
  });

  test('학생 대시보드가 연결 안내 또는 학습 현황을 명확히 보여줌', async ({ page }) => {
    await page.goto('/student');

    const unlinkedState = page.getByRole('heading', { name: '아직 학생 정보가 연결되지 않았어요' });
    const linkedMain = page.getByRole('main');
    const linkedState = page.getByText('내 성장 방향').first();

    await expect(unlinkedState.or(linkedMain).first()).toBeVisible({ timeout: 15_000 });

    if (await unlinkedState.isVisible()) {
      await expect(page.getByText('학생 계정 연결')).toBeVisible();
      await expect(page.getByPlaceholder('예: STU-12AB34')).toBeVisible();
      return;
    }

    await expect(linkedMain).toBeVisible();
    await expect(linkedState).toBeVisible();
    await expect(page.getByText('총 리포트')).toBeVisible();
    await expect(page.getByRole('heading', { name: /내 리포트/ })).toBeVisible();
  });

  test('모바일 뷰에서 학생 핵심 화면이 가로 스크롤 없이 표시됨', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/student');

    const unlinkedState = page.getByRole('heading', { name: '아직 학생 정보가 연결되지 않았어요' });
    const linkedMain = page.getByRole('main');
    await expect(unlinkedState.or(linkedMain).first()).toBeVisible({ timeout: 15_000 });

    const hasHorizontalScroll = await page.evaluate(() => (
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    ));
    expect(hasHorizontalScroll).toBe(false);
  });
});
