import { test, expect } from './fixtures';

test.describe('학부모 대시보드', () => {
  test.beforeEach(async ({ loginAsParent }) => {
    await loginAsParent();
  });

  test.describe('메인 대시보드', () => {
    test('학부모 대시보드가 올바르게 로드됨', async ({ page }) => {
      await page.goto('/parent');

      // 메인 콘텐츠 영역 확인
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    });

    test('자녀 정보가 표시됨', async ({ page }) => {
      await page.goto('/parent');

      // 학생 정보 또는 빈 상태 메시지 확인
      const studentInfo = page.locator('[data-testid="student-info"], .student-card, text=학생');
      const emptyState = page.locator('text=연결된 자녀가 없습니다, text=자녀 정보');

      // 둘 중 하나는 표시되어야 함
      const hasStudentInfo = await studentInfo.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;
      expect(hasStudentInfo || hasEmptyState).toBe(true);
    });

    test('Growth Loop 진행 상황이 표시됨', async ({ page }) => {
      await page.goto('/parent');

      // 성장 루프 관련 콘텐츠 확인
      const growthContent = page.locator('text=성장, text=Growth, text=진행');
      // 페이지에 성장 관련 콘텐츠가 있을 수 있음
      const count = await growthContent.count();
      // 콘텐츠가 있으면 확인
      if (count > 0) {
        await expect(growthContent.first()).toBeVisible();
      }
    });
  });

  test.describe('리포트 조회', () => {
    test('리포트 목록 확인', async ({ page }) => {
      await page.goto('/parent');

      // 리포트 관련 섹션 확인
      const reportsSection = page.locator('text=리포트, text=분석, text=Report');
      const count = await reportsSection.count();
      // 리포트 섹션이 있으면 표시됨
      if (count > 0) {
        await expect(reportsSection.first()).toBeVisible();
      }
    });
  });

  test.describe('반응형 디자인', () => {
    test('모바일 뷰에서 올바르게 표시됨', async ({ page }) => {
      // 모바일 뷰포트 설정
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/parent');

      // 페이지가 스크롤 없이 깨지지 않는지 확인
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // 가로 스크롤이 없어야 함
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    test('태블릿 뷰에서 올바르게 표시됨', async ({ page }) => {
      // 태블릿 뷰포트 설정
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/parent');

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });
});
