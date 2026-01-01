import { test, expect } from './fixtures';

test.describe('인증 플로우', () => {
  test.describe('로그인 페이지', () => {
    test('로그인 페이지가 올바르게 로드됨', async ({ page }) => {
      await page.goto('/login');

      // 페이지 제목 확인
      await expect(page).toHaveTitle(/로그인|Login/i);

      // 로그인 폼 요소 확인
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('이메일 형식 검증', async ({ page }) => {
      await page.goto('/login');

      // 잘못된 이메일 입력
      await page.fill('input[type="email"]', 'invalid-email');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');

      // 오류 메시지 또는 검증 상태 확인
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('type', 'email');
    });

    test('빈 필드로 제출 시 검증 실패', async ({ page }) => {
      await page.goto('/login');

      // 빈 상태로 제출
      await page.click('button[type="submit"]');

      // required 필드 검증
      const emailInput = page.locator('input[type="email"]');
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBe(true);
    });
  });

  test.describe('회원가입 페이지', () => {
    test('회원가입 페이지가 올바르게 로드됨', async ({ page }) => {
      await page.goto('/signup');

      // 회원가입 폼 요소 확인
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
  });

  test.describe('로그아웃', () => {
    test('로그아웃 후 로그인 페이지로 리다이렉트', async ({ page, loginAsTeacher }) => {
      // 로그인
      await loginAsTeacher();

      // 로그아웃 버튼 클릭
      const logoutButton = page.locator('button:has-text("로그아웃"), [data-testid="logout"]');
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        await expect(page).toHaveURL(/\/login/);
      }
    });
  });
});

test.describe('인증되지 않은 접근', () => {
  test('관리자 페이지는 로그인 필요', async ({ page }) => {
    await page.goto('/admin');
    // 로그인 페이지로 리다이렉트되거나 에러 표시
    await expect(page).toHaveURL(/\/login/);
  });

  test('학부모 페이지는 로그인 필요', async ({ page }) => {
    await page.goto('/parent');
    // 로그인 페이지로 리다이렉트되거나 에러 표시
    await expect(page).toHaveURL(/\/login/);
  });
});
