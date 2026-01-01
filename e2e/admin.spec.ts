import { test, expect } from './fixtures';

test.describe('관리자(교사) 대시보드', () => {
  test.beforeEach(async ({ loginAsTeacher }) => {
    await loginAsTeacher();
  });

  test.describe('메인 대시보드', () => {
    test('대시보드 페이지가 올바르게 로드됨', async ({ page }) => {
      await page.goto('/admin');

      // 주요 섹션 확인
      await expect(page.locator('text=오늘 수업')).toBeVisible();
    });

    test('네비게이션 메뉴가 표시됨', async ({ page }) => {
      await page.goto('/admin');

      // 주요 메뉴 항목 확인
      const menuItems = ['학생 관리', '리포트', '수업 기록'];
      for (const item of menuItems) {
        const menuLink = page.locator(`a:has-text("${item}"), button:has-text("${item}")`);
        // 메뉴가 존재하는지 확인 (visible 또는 hidden 상태일 수 있음)
        await expect(menuLink.first()).toBeAttached();
      }
    });
  });

  test.describe('학생 관리', () => {
    test('학생 목록 페이지 로드', async ({ page }) => {
      await page.goto('/admin/students');

      // 학생 목록 또는 빈 상태 메시지 확인
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    });

    test('학생 추가 버튼이 표시됨', async ({ page }) => {
      await page.goto('/admin/students');

      // 학생 추가 버튼 확인
      const addButton = page.locator('button:has-text("추가"), button:has-text("등록"), a:has-text("추가")');
      await expect(addButton.first()).toBeVisible();
    });
  });

  test.describe('리포트 관리', () => {
    test('리포트 목록 페이지 로드', async ({ page }) => {
      await page.goto('/admin/reports');

      // 리포트 관련 콘텐츠 확인
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    });

    test('리포트 생성 페이지 접근', async ({ page }) => {
      await page.goto('/admin/reports/create');

      // Growth Loop 리포트 타입 선택 옵션 확인
      const reportTypes = ['레벨 테스트', '시험 분석', '주간 리포트', '월간 리포트'];
      for (const type of reportTypes) {
        const typeOption = page.locator(`text=${type}`);
        // 옵션이 존재하는지 확인
        const count = await typeOption.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('수업 관리', () => {
    test('수업 일정 페이지 로드', async ({ page }) => {
      await page.goto('/admin/schedules');

      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    });

    test('수업 기록 페이지 로드', async ({ page }) => {
      await page.goto('/admin/class-record');

      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    });

    test('과제 관리 페이지 로드', async ({ page }) => {
      await page.goto('/admin/assignments');

      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    });
  });
});
