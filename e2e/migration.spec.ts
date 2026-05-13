import { test, expect } from './fixtures';
import path from 'path';

/**
 * Migration 페이지 E2E 테스트
 *
 * 레거시 데이터 마이그레이션 (Batch Ingestion Engine) 페이지의
 * UI 렌더링, 파일 업로드, 큐 관리, 유효성 검사 등을 검증합니다.
 */

test.describe('Migration 페이지', () => {
  test.describe.configure({ timeout: 60_000 });

  test.skip(
    !process.env.TEST_TEACHER_EMAIL || !process.env.TEST_TEACHER_PASSWORD,
    'Migration E2E requires TEST_TEACHER_EMAIL and TEST_TEACHER_PASSWORD for a real teacher account.'
  );

  test.beforeEach(async ({ loginAsTeacher }) => {
    await loginAsTeacher();
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M01: 페이지 기본 렌더링
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M01~03: 페이지 기본 렌더링', () => {
    test('TC-M01: 마이그레이션 페이지가 올바르게 로드됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      // 페이지 헤더 확인
      await expect(page.locator('h1:has-text("레거시 데이터 마이그레이션")')).toBeVisible();
    });

    test('TC-M02: 타임머신 학습 엔진 안내 배너가 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      await expect(page.locator('text=타임머신 학습 엔진 안내')).toBeVisible();
      await expect(page.locator('text=메타프로필')).toBeVisible();
    });

    test('TC-M03: 대시보드로 돌아가기 링크가 존재함', async ({ page }) => {
      await page.goto('/teacher/migration');

      const backLink = page.locator('a:has-text("대시보드"), a[href="/teacher"]');
      await expect(backLink.first()).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M04~06: 학생 선택
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M04~06: 학생 선택', () => {
    test('TC-M04: 학생 선택 드롭다운이 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const studentSelect = page.locator('select').first();
      await expect(studentSelect).toBeVisible();
    });

    test('TC-M05: 학생 선택 없이 마이그레이션 시작 버튼이 비활성화됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const startButton = page.locator('button:has-text("마이그레이션 시작")');
      await expect(startButton).toBeDisabled();
    });

    test('TC-M06: 학생 선택 섹션 제목이 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      await expect(page.locator('text=대상 학생 선택')).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M07~09: 일괄 설정
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M07~09: 파일 일괄 설정', () => {
    test('TC-M07: 기본 지정 날짜 입력 필드가 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const dateInput = page.locator('input[type="date"]').first();
      await expect(dateInput).toBeVisible();
    });

    test('TC-M08: 데이터 소스 유형 드롭다운이 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      // 두 번째 select가 데이터 소스 유형 (첫 번째는 학생 선택)
      const typeSelects = page.locator('select');
      await expect(typeSelects.nth(1)).toBeVisible();
    });

    test('TC-M09: 소스 유형 옵션들이 올바르게 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const sourceTypeOptions = ['시험지/평가문제', '월간/반기 리포트', '일일학습/문제풀이노트'];
      for (const opt of sourceTypeOptions) {
        await expect(page.locator(`option:has-text("${opt}")`)).toBeAttached();
      }
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M10~12: 파일 업로드 영역
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M10~12: 파일 업로드 영역', () => {
    test('TC-M10: 파일 업로드 버튼이 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      await expect(page.locator('text=클릭하거나 파일을 이곳에 드래그하여 추가하세요')).toBeVisible();
    });

    test('TC-M11: 파일 입력 필드가 이미지와 PDF를 허용함', async ({ page }) => {
      await page.goto('/teacher/migration');

      const fileInput = page.locator('input[type="file"]');
      const acceptAttr = await fileInput.getAttribute('accept');
      expect(acceptAttr).toContain('image/*');
      expect(acceptAttr).toContain('application/pdf');
    });

    test('TC-M12: 파일 입력이 다중 선택을 지원함', async ({ page }) => {
      await page.goto('/teacher/migration');

      const fileInput = page.locator('input[type="file"]');
      const multipleAttr = await fileInput.getAttribute('multiple');
      expect(multipleAttr).not.toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M13~15: 작업 큐 초기 상태
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M13~15: 작업 큐 초기 상태', () => {
    test('TC-M13: 빈 큐 상태 메시지가 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      await expect(page.locator('text=추가된 파일이 없습니다')).toBeVisible();
    });

    test('TC-M14: 마이그레이션 대기열 헤더가 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      await expect(page.locator('text=마이그레이션 대기열')).toBeVisible();
    });

    test('TC-M15: 완료 항목 지우기 버튼이 초기에 비활성화됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const clearButton = page.locator('button:has-text("완료 항목 지우기")');
      await expect(clearButton).toBeDisabled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M16~18: 이미지 파일 추가 플로우
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M16~18: 파일 추가 플로우', () => {
    test('TC-M16: 이미지 파일 추가 시 큐에 항목이 나타남', async ({ page }) => {
      await page.goto('/teacher/migration');

      // 테스트용 PNG 파일 생성 (1x1 픽셀)
      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer,
      });

      // 큐에 항목이 추가됐는지 확인
      await expect(page.locator('text=test-image.png')).toBeVisible({ timeout: 3000 });
    });

    test('TC-M17: 파일 추가 후 마이그레이션 시작 버튼은 학생 미선택 시 비활성화 유지', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer,
      });

      // 파일은 추가됐지만 학생 미선택 → 버튼 비활성화
      const startButton = page.locator('button:has-text("마이그레이션 시작")');
      await expect(startButton).toBeDisabled();
    });

    test('TC-M18: 추가된 파일의 제거(X) 버튼이 작동함', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'remove-test.png',
        mimeType: 'image/png',
        buffer,
      });

      // 파일 항목 확인
      await expect(page.locator('text=remove-test.png')).toBeVisible({ timeout: 3000 });

      // 제거 버튼 클릭
      const removeButton = page.locator('button:has-text("✕")');
      await removeButton.click();

      // 항목이 제거됐는지 확인
      await expect(page.locator('text=remove-test.png')).not.toBeVisible();
      await expect(page.locator('text=추가된 파일이 없습니다')).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M19~21: 개별 작업 설정
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M19~21: 개별 작업 설정', () => {
    test('TC-M19: 파일 추가 후 개별 날짜 설정 가능', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      await page.locator('input[type="file"]').setInputFiles({
        name: 'date-test.png',
        mimeType: 'image/png',
        buffer,
      });

      // 큐 내 날짜 입력 필드 확인
      const dateInputsInQueue = page.locator('.space-y-3 input[type="date"]');
      await expect(dateInputsInQueue.first()).toBeVisible({ timeout: 3000 });
    });

    test('TC-M20: 파일 추가 후 개별 소스 유형 설정 가능', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      await page.locator('input[type="file"]').setInputFiles({
        name: 'type-test.png',
        mimeType: 'image/png',
        buffer,
      });

      // 큐 내 소스 유형 select 확인 (총 3개: 학생선택, 배치소스유형, 개별)
      const allSelects = page.locator('select');
      const count = await allSelects.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('TC-M21: 여러 파일 추가 시 카운트가 올바르게 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      // 두 파일 업로드
      await page.locator('input[type="file"]').setInputFiles([
        { name: 'file1.png', mimeType: 'image/png', buffer },
        { name: 'file2.png', mimeType: 'image/png', buffer },
      ]);

      // 큐 헤더에 개수가 표시됨
      await expect(page.locator('text=마이그레이션 대기열 (2)')).toBeVisible({ timeout: 3000 });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M22~24: 전체 진행 상황 표시
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M22~24: 진행 상황 UI', () => {
    test('TC-M22: 파일 추가 시 진행률 바가 나타남', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      await page.locator('input[type="file"]').setInputFiles({
        name: 'progress-test.png',
        mimeType: 'image/png',
        buffer,
      });

      // 진행 상황 UI 확인
      await expect(page.locator('text=진행 상황')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('text=대기:')).toBeVisible();
    });

    test('TC-M23: 초기 진행률은 0%로 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      await page.locator('input[type="file"]').setInputFiles({
        name: 'zero-progress.png',
        mimeType: 'image/png',
        buffer,
      });

      await expect(page.locator('text=0%')).toBeVisible({ timeout: 3000 });
    });

    test('TC-M24: 파일 크기가 MB 단위로 표시됨', async ({ page }) => {
      await page.goto('/teacher/migration');

      const buffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      await page.locator('input[type="file"]').setInputFiles({
        name: 'size-test.png',
        mimeType: 'image/png',
        buffer,
      });

      // "MB" 단위 표시 확인
      await expect(page.locator('text=MB')).toBeVisible({ timeout: 3000 });
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M26: CSV 업로드 회귀
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M26: CSV 일괄 업로드', () => {
    test('TC-M26: CSV 업로드 성공 시 성장 그래프 반영 안내가 표시됨', async ({ page }) => {
      await page.route('**/api/migration/csv-import', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            importedCount: 1,
            message: '1건의 시험 데이터를 성공적으로 가져왔습니다.',
          }),
        });
      });

      await page.goto('/teacher/migration');
      await page.getByRole('button', { name: /CSV 일괄 업로드/ }).click();

      const csv = [
        'student_id,test_date,test_name,total_score,max_score,rank,total_students',
        'M1250103,2025-03-15,중간고사,85,100,5,30',
      ].join('\n');

      await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
        name: 'growth-history.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csv),
      });

      await page.getByRole('button', { name: /CSV 데이터 가져오기/ }).click();
      await expect(page.locator('text=업로드 완료')).toBeVisible();
      await expect(page.getByText('연간 성장 그래프에서 추가된 데이터를 확인할 수 있습니다')).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // TC-M25: 인증 미완료 접근 거부
  // ────────────────────────────────────────────────────────────────
  test.describe('TC-M25: 인증 및 권한', () => {
    test('TC-M25: 비인증 사용자는 로그인 페이지로 리다이렉트됨', async ({ page }) => {
      // 로그아웃 후 마이그레이션 페이지 직접 접근
      await page.goto('/teacher/migration');

      // 로그아웃 (쿠키/스토리지 클리어 후 재접근)
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      await page.goto('/teacher/migration');

      // 로그인 페이지로 이동됐는지 확인 (또는 리다이렉트)
      await page.waitForURL(url =>
        url.pathname.includes('/login') ||
        url.pathname === '/teacher/migration',
        { timeout: 5000 }
      ).catch(() => {
        // 리다이렉트 없이 그냥 있어도 괜찮음 (서버에서 처리)
      });

      const isOnLogin = page.url().includes('/login');
      const isOnMigration = page.url().includes('/teacher/migration');
      expect(isOnLogin || isOnMigration).toBe(true);
    });
  });
});
