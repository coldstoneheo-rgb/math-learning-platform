import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E 테스트용 공통 Fixtures
 * 테스트에서 자주 사용하는 설정과 헬퍼 함수 정의
 */

// 테스트 계정 정보 (환경변수로 설정 권장)
export const TEST_ACCOUNTS = {
  teacher: {
    email: process.env.TEST_TEACHER_EMAIL || 'teacher@test.com',
    password: process.env.TEST_TEACHER_PASSWORD || 'test1234',
  },
  parent: {
    email: process.env.TEST_PARENT_EMAIL || 'parent@test.com',
    password: process.env.TEST_PARENT_PASSWORD || 'test1234',
  },
};

// 확장된 테스트 fixture
export const test = base.extend<{
  loginAsTeacher: () => Promise<void>;
  loginAsParent: () => Promise<void>;
}>({
  // 교사로 로그인
  loginAsTeacher: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/login');
      await page.fill('input[type="email"]', TEST_ACCOUNTS.teacher.email);
      await page.fill('input[type="password"]', TEST_ACCOUNTS.teacher.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/admin');
    };
    await use(login);
  },

  // 학부모로 로그인
  loginAsParent: async ({ page }, use) => {
    const login = async () => {
      await page.goto('/login');
      await page.fill('input[type="email"]', TEST_ACCOUNTS.parent.email);
      await page.fill('input[type="password"]', TEST_ACCOUNTS.parent.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/parent');
    };
    await use(login);
  },
});

export { expect };

// 공통 헬퍼 함수
export async function waitForToast(page: Page) {
  // 토스트 메시지 대기 (일반적인 패턴)
  await page.waitForSelector('[role="alert"], .toast, [data-testid="toast"]', {
    timeout: 5000,
  }).catch(() => {
    // 토스트가 없어도 계속 진행
  });
}

export async function dismissModal(page: Page) {
  // ESC 키로 모달 닫기
  await page.keyboard.press('Escape');
}
