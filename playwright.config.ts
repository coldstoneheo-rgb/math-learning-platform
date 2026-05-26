import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// .env.local 파일 로드
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * Playwright E2E 테스트 설정
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  /* 전체 테스트 타임아웃 */
  timeout: 60 * 1000,

  /* expect() 타임아웃 */
  expect: {
    timeout: 10 * 1000,
  },

  /* 인증/라우팅 smoke test는 공유 테스트 계정을 사용하므로 기본은 직렬 실행 */
  fullyParallel: false,

  /* CI에서 재시도 횟수 */
  retries: process.env.CI ? 2 : 0,

  /* 병렬 워커 수 */
  workers: process.env.PLAYWRIGHT_WORKERS
    ? Number(process.env.PLAYWRIGHT_WORKERS)
    : 1,

  /* 리포터 설정 */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  /* 공통 설정 */
  use: {
    /* 기본 URL */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    /* 실패 시 스크린샷 캡처 */
    screenshot: 'only-on-failure',

    /* 실패 시 트레이스 캡처 */
    trace: 'on-first-retry',

    /* 비디오 녹화 (CI에서만) */
    video: process.env.CI ? 'on-first-retry' : 'off',
  },

  /* 테스트할 브라우저/디바이스 */
  projects: [
    /* 데스크톱 Chrome */
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    /* 데스크톱 Firefox (선택적) */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    /* 모바일 Chrome */
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* 로컬 개발 서버 설정 */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
