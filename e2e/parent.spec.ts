import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

async function expectParentShell(page: Page) {
  await expect(page.getByRole('main')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible();
}

async function expectChildOrEmptyState(page: Page) {
  const emptyStateHeading = page.getByRole('heading', { name: '연결된 자녀가 없습니다' });
  const childStateIndicator = page.getByText('성장 판단').first();

  await expect(emptyStateHeading.or(childStateIndicator).first()).toBeVisible({ timeout: 15_000 });

  if (await emptyStateHeading.isVisible()) {
    await expect(page.getByText('선생님에게 자녀 연결을 요청해주세요.')).toBeVisible();
    return 'empty' as const;
  }

  await expect(childStateIndicator).toBeVisible();
  await expect(page.getByText('총 리포트')).toBeVisible();
  await expect(page.getByText('성장 여정 (Growth Loop)')).toBeVisible();
  await expect(page.getByRole('heading', { name: /리포트 목록/ })).toBeVisible();
  return 'child' as const;
}

function collectRechartsDimensionWarnings(page: Page) {
  const warnings: string[] = [];

  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('width(-1)') || text.includes('height(-1)')) {
      warnings.push(text);
    }
  });

  return warnings;
}

test.describe('학부모 대시보드', () => {
  test.beforeEach(async ({ loginAsParent }) => {
    await loginAsParent();
  });

  test.describe('메인 대시보드', () => {
    test('학부모 대시보드 shell이 올바르게 로드됨', async ({ page }) => {
      await page.goto('/parent');

      await expectParentShell(page);
      await expectChildOrEmptyState(page);
    });

    test('성장 판단 UX가 자녀 데이터 유무에 맞게 표시됨', async ({ page }) => {
      await page.goto('/parent');

      const state = await expectChildOrEmptyState(page);
      if (state === 'empty') return;

      const growthTruthPanel = page.getByText('성장 판단').first();
      await expect(growthTruthPanel).toBeVisible();
      await expect(page.getByText(/시험 분석 또는 레벨 테스트|최신 시험 데이터|점수와 문항 판정/).first()).toBeVisible();
    });
  });

  test.describe('리포트 조회', () => {
    test('리포트 목록이 상세 리포트 링크 또는 빈 상태를 명확히 보여줌', async ({ page }) => {
      await page.goto('/parent');

      const state = await expectChildOrEmptyState(page);
      if (state === 'empty') return;

      const firstReportLink = page.locator('a[href^="/parent/reports/"]').first();
      const emptyStateMessage = page.getByText('아직 생성된 리포트가 없습니다.');

      await expect(firstReportLink.or(emptyStateMessage).first()).toBeVisible({ timeout: 15_000 });

      if (await firstReportLink.isVisible()) {
        const href = await firstReportLink.getAttribute('href');
        expect(href).toMatch(/^\/parent\/reports\/\d+$/);
        return;
      }

      await expect(emptyStateMessage).toBeVisible();
    });

    test('상세 리포트가 성장 판단 화면으로 안정적으로 열림', async ({ page }) => {
      test.setTimeout(180_000);
      const chartWarnings = collectRechartsDimensionWarnings(page);

      await page.goto('/parent');

      const state = await expectChildOrEmptyState(page);
      if (state === 'empty') return;

      const firstReportLink = page.locator('a[href^="/parent/reports/"]').first();
      const emptyStateMessage = page.getByText('아직 생성된 리포트가 없습니다.');

      await expect(firstReportLink.or(emptyStateMessage).first()).toBeVisible({ timeout: 15_000 });

      if (!(await firstReportLink.isVisible())) {
        await expect(emptyStateMessage).toBeVisible();
        return;
      }

      const href = await firstReportLink.getAttribute('href');
      expect(href).toMatch(/^\/parent\/reports\/\d+$/);

      await page.goto(href!, { waitUntil: 'commit' });
      await expect(page).toHaveURL(/\/parent\/reports\/\d+/);
      await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText(/성장 판단 기준|이번 리포트의 핵심 분석 결과|성장 예측 그래프|월간 역량 분석/).first(),
      ).toBeVisible({ timeout: 30_000 });

      await expect(page.locator('.recharts-surface').first()).toBeVisible();
      expect(chartWarnings).toEqual([]);
    });
  });

  test.describe('반응형 디자인', () => {
    test('모바일 뷰에서 핵심 학부모 UX가 깨지지 않음', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/parent');

      await expectParentShell(page);
      await expectChildOrEmptyState(page);

      const hasHorizontalScroll = await page.evaluate(() => (
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      ));
      expect(hasHorizontalScroll).toBe(false);
    });

    test('태블릿 뷰에서 핵심 학부모 UX가 로드됨', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/parent');

      await expectParentShell(page);
      await expectChildOrEmptyState(page);
    });
  });
});
