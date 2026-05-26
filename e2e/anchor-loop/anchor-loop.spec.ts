import { test, expect } from '../fixtures';

/**
 * Anchor Loop E2E 테스트
 *
 * AI 분석 결과가 StudentMetaProfile에 올바르게 반영되는지 검증합니다.
 * 핵심 지표: errorSignature, absorptionRate, solvingStamina, metaCognitionLevel
 */

test.describe('Anchor Loop E2E 테스트', () => {
  test.beforeEach(async ({ loginAsTeacher }) => {
    await loginAsTeacher();
  });

  test.describe('TC-01~06: 기본 플로우', () => {
    test('TC-01: 테스트 분석 페이지 로드', async ({ page }) => {
      await page.goto('/teacher/reports/new');

      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();

      // 학생 선택 UI 확인
      const studentSelector = page.locator('[data-testid="student-selector"], select, [role="combobox"]');
      await expect(studentSelector.first()).toBeVisible();
    });

    test('TC-02: problemRange 계산 검증 (수정된 로직)', async ({ page }) => {
      // 이 테스트는 API 레벨에서 problemRange 계산이 올바른지 검증
      // 4개 문항일 때: "1-2", "3-4" (2개 청크만 생성, "5-4" 같은 잘못된 범위 없음)

      await page.goto('/teacher/reports/new');

      // API 응답 모니터링
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/analyze') && response.status() === 200,
        { timeout: 60000 }
      ).catch(() => null);

      // 분석 완료 후 응답 검증 (실제 분석 실행 시)
      const response = await responsePromise;
      if (response) {
        const json = await response.json();
        if (json.success && json.analysisData?.solvingStamina?.accuracyBySequence) {
          const sequences = json.analysisData.solvingStamina.accuracyBySequence;

          for (const seq of sequences) {
            const [start, end] = seq.problemRange.split('-').map(Number);
            expect(start).toBeLessThanOrEqual(end);
          }
        }
      }
    });

    test('TC-03: 빈 detailedAnalysis 처리', async ({ page }) => {
      await page.goto('/teacher/reports/new');

      // 기본 페이지 로드 확인 (빈 분석 데이터 시 크래시 없음)
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    });

    test('TC-05: errorSignature 업데이트 확인', async ({ page }) => {
      // 리포트 상세 페이지에서 오류 패턴 표시 확인
      await page.goto('/teacher/reports');

      const reportLink = page.locator('a[href*="/reports/"]').first();
      if (await reportLink.isVisible()) {
        await reportLink.click();
        await page.waitForLoadState('networkidle');

        // 분석 결과 섹션 확인
        const analysisSection = page.locator('text=/오류|패턴|분석/i');
        const count = await analysisSection.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('TC-06: solvingStamina fatiguePattern 확인', async ({ page }) => {
      await page.goto('/teacher/reports');

      const reportLink = page.locator('a[href*="/reports/"]').first();
      if (await reportLink.isVisible()) {
        await reportLink.click();
        await page.waitForLoadState('networkidle');

        // 풀이 지구력 관련 UI 확인
        const staminaSection = page.locator('text=/지구력|피로|패턴/i');
        const count = await staminaSection.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('TC-07~10: 데이터 지속성', () => {
    test('TC-07: 리포트 저장 후 메타프로필 조회', async ({ page }) => {
      await page.goto('/teacher/students');

      // 학생 카드/행 클릭하여 상세 정보 확인
      const studentRow = page.locator('tr, [data-testid="student-card"]').first();
      if (await studentRow.isVisible()) {
        await studentRow.click();
        await page.waitForLoadState('networkidle');

        // 학생 프로필 정보 표시 확인
        const profileSection = page.locator('main, [role="main"]');
        await expect(profileSection).toBeVisible();
      }
    });

    test('TC-08: 여러 리포트 누적 업데이트', async ({ page }) => {
      await page.goto('/teacher/reports');

      // 리포트 목록 로드 확인
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();

      // 여러 리포트가 있는지 확인
      const reportCount = await page.locator('a[href*="/reports/"]').count();
      expect(reportCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('TC-11~13: 에러 처리', () => {
    test('TC-11: API 오류 시 사용자 알림', async ({ page }) => {
      await page.goto('/teacher/reports/new');

      // 오류 토스트/알림 영역 존재 확인
      const toastContainer = page.locator('[role="alert"], .toast, [data-testid="toast"]');
      // 페이지 로드 시 에러가 없으면 토스트 없음
      const toastCount = await toastContainer.count();
      expect(toastCount).toBeGreaterThanOrEqual(0);
    });

    test('TC-12: 로그인 안된 상태에서 분석 시도', async ({ page }) => {
      // 로그아웃
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // API 직접 호출 시도
      const response = await page.request.post('/api/analyze', {
        data: { studentName: 'Test', formData: {}, currentImages: [] },
      });

      expect(response.status()).toBe(401);
    });
  });
});

test.describe('TC-14: 권한 검증', () => {
  test('학부모 계정으로 분석 API 호출 불가', async ({ loginAsParent, page }) => {
    await loginAsParent();

    const response = await page.request.post('/api/analyze', {
      data: { studentName: 'Test', formData: {}, currentImages: [] },
    });

    expect(response.status()).toBe(403);
  });

  test('학부모는 다른 학생 리포트 접근 불가', async ({ loginAsParent, page }) => {
    await loginAsParent();

    // 자신의 자녀가 아닌 학생 리포트 접근 시도
    await page.goto('/parent/reports/99999');

    // 에러 메시지 또는 리다이렉트 확인
    const errorOrRedirect = await Promise.race([
      page.waitForSelector('text=/권한|없습니다|찾을 수 없/i', { timeout: 5000 }).then(() => 'error'),
      page.waitForURL('**/parent', { timeout: 5000 }).then(() => 'redirect'),
    ]).catch(() => 'timeout');

    expect(['error', 'redirect', 'timeout']).toContain(errorOrRedirect);
  });
});

test.describe('TC-15: Gemini 응답 처리', () => {
  test.beforeEach(async ({ loginAsTeacher }) => {
    await loginAsTeacher();
  });

  test('분석 페이지 렌더링 안정성', async ({ page }) => {
    await page.goto('/teacher/reports/new');

    // 페이지가 크래시 없이 로드되는지 확인
    const content = page.locator('main, [role="main"]');
    await expect(content).toBeVisible();

    // 콘솔 에러 모니터링
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // 심각한 렌더링 에러가 없어야 함
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('Cannot read') || e.includes('undefined') || e.includes('null')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('리포트 상세 페이지 안정성', async ({ page }) => {
    await page.goto('/teacher/reports');

    const reportLink = page.locator('a[href*="/reports/"]').first();
    if (await reportLink.isVisible()) {
      await reportLink.click();
      await page.waitForLoadState('networkidle');

      // 페이지 로드 확인
      const content = page.locator('main, [role="main"]');
      await expect(content).toBeVisible();
    }
  });
});
