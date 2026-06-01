import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * E2E 테스트용 공통 Fixtures
 * 테스트에서 자주 사용하는 설정과 헬퍼 함수 정의
 */

// 테스트 계정 정보 (환경변수로 설정 권장)
export const TEST_ACCOUNTS = {
  teacher: {
    email: process.env.TEST_TEACHER_EMAIL,
    password: process.env.TEST_TEACHER_PASSWORD,
  },
  parent: {
    email: process.env.TEST_PARENT_EMAIL,
    password: process.env.TEST_PARENT_PASSWORD,
  },
  student: {
    email: process.env.TEST_STUDENT_EMAIL,
    password: process.env.TEST_STUDENT_PASSWORD,
  },
};

function requireTestAccount(
  role: keyof typeof TEST_ACCOUNTS,
): { email: string; password: string } {
  const account = TEST_ACCOUNTS[role];

  if (!account.email || !account.password) {
    throw new Error(
      `Missing ${role} E2E credentials. Set TEST_${role.toUpperCase()}_EMAIL and TEST_${role.toUpperCase()}_PASSWORD before running authenticated E2E tests.`,
    );
  }

  return { email: account.email, password: account.password };
}

async function readVisibleAuthError(page: Page): Promise<string | null> {
  const errorMessage = page.locator('[role="alert"], .bg-red-50, .text-red-600').first();

  if (await errorMessage.isVisible().catch(() => false)) {
    const text = await errorMessage.textContent();
    return text?.trim() || null;
  }

  return null;
}

async function submitLoginAndWaitForURL(
  page: Page,
  expectedURL: string | RegExp,
  role: keyof typeof TEST_ACCOUNTS,
) {
  try {
    await Promise.all([
      page.waitForURL(expectedURL, { timeout: 30_000, waitUntil: 'commit' }),
      page.click('button[type="submit"]'),
    ]);
  } catch (error) {
    const authError = await readVisibleAuthError(page);
    const detail = authError ? ` Auth error: ${authError}` : '';
    throw new Error(
      `Login as ${role} did not reach ${String(expectedURL)}. Current URL: ${page.url()}.${detail}`,
      { cause: error },
    );
  }
}

// 확장된 테스트 fixture
export const test = base.extend<{
  loginAsTeacher: () => Promise<void>;
  loginAsParent: () => Promise<void>;
  loginAsStudent: () => Promise<void>;
}>({
  // 교사로 로그인
  loginAsTeacher: async ({ page }, use) => {
    const login = async () => {
      const account = requireTestAccount('teacher');

      await page.goto('/login');
      await page.fill('input[type="email"]', account.email);
      await page.fill('input[type="password"]', account.password);
      await submitLoginAndWaitForURL(page, /\/(teacher|super-admin)\/?$/, 'teacher');

      const pathname = new URL(page.url()).pathname.replace(/\/$/, '');
      if (pathname === '/super-admin') {
        await page.goto('/teacher');
        await page.waitForURL('/teacher');
      }
    };
    await use(login);
  },

  // 학부모로 로그인
  loginAsParent: async ({ page }, use) => {
    const login = async () => {
      const account = requireTestAccount('parent');

      await page.goto('/login');
      await page.fill('input[type="email"]', account.email);
      await page.fill('input[type="password"]', account.password);
      await submitLoginAndWaitForURL(page, /\/parent\/?$/, 'parent');
    };
    await use(login);
  },

  // 학생으로 로그인
  loginAsStudent: async ({ page }, use) => {
    const login = async () => {
      const account = requireTestAccount('student');

      await page.goto('/login');
      await page.fill('input[type="email"]', account.email);
      await page.fill('input[type="password"]', account.password);
      await submitLoginAndWaitForURL(page, /\/student\/?$/, 'student');
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
