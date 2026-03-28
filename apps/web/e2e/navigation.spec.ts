import { test, expect } from '@playwright/test';

test.describe('Auth page', () => {
  test('shows login UI', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByText('ROUTINE APP')).toBeVisible();
    await expect(page.getByText('오늘도 루틴 시작')).toBeVisible();
    await expect(page.getByText('로그인 없이 계속하기')).toBeVisible();
  });
});

test.describe('Today page', () => {
  test('shows routine list after mock login', async ({ page }) => {
    // Set mock login to bypass auth
    await page.goto('/auth');
    await page.evaluate(() => {
      window.localStorage.setItem('routine-auth-mock-login', '1');
    });
    await page.goto('/today');
    await expect(page.getByText('기상 인증')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('식사 인증')).toBeVisible();
    await expect(page.getByText('취침 인증')).toBeVisible();
  });
});

test.describe('Calendar page', () => {
  test('shows calendar grid after mock login', async ({ page }) => {
    await page.goto('/auth');
    await page.evaluate(() => {
      window.localStorage.setItem('routine-auth-mock-login', '1');
    });
    await page.goto('/calendar');
    await expect(page.getByText('캘린더')).toBeVisible({ timeout: 10_000 });
    for (const day of ['일', '월', '화', '수', '목', '금', '토']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible();
    }
  });
});

test.describe('Settings page', () => {
  test('shows settings cards after mock login', async ({ page }) => {
    await page.goto('/auth');
    await page.evaluate(() => {
      window.localStorage.setItem('routine-auth-mock-login', '1');
    });
    await page.goto('/settings');
    await expect(page.getByText('설정')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('알림')).toBeVisible();
    await expect(page.getByText('운영 정책')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('navigates between pages', async ({ page }) => {
    // Start with mock login
    await page.goto('/auth');
    await page.evaluate(() => {
      window.localStorage.setItem('routine-auth-mock-login', '1');
    });

    // Go to today
    await page.goto('/today');
    await expect(page.getByText('기상 인증')).toBeVisible({ timeout: 10_000 });

    // Navigate to calendar via bottom nav or link
    await page.goto('/calendar');
    await expect(page.getByText('캘린더')).toBeVisible({ timeout: 10_000 });

    // Navigate to settings
    await page.goto('/settings');
    await expect(page.getByText('설정')).toBeVisible({ timeout: 10_000 });

    // Navigate back to today via link
    await page.getByText('오늘으로').click();
    await expect(page.getByText('기상 인증')).toBeVisible({ timeout: 10_000 });
  });
});
