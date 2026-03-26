import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('capture dashboard screen', async ({ page }) => {
  await page.goto('http://127.0.0.1:3018/auth', { waitUntil: 'networkidle' });

  const skipButton = page.getByRole('button', { name: '로그인 없이 계속하기 (임시)' });
  if (await skipButton.isVisible()) {
    await skipButton.click();
  }

  await page.waitForURL('**/today');
  await expect(page.getByText('루틴 실행 대시보드')).toBeVisible();
  await expect(page.getByText(/프로그레스\s*\d+\/\d+/)).toBeVisible();

  await page.screenshot({
    path: 'docs/screenshots/2026-03-23-dashboard-progress-mobile-webview.png',
    fullPage: true,
  });
});
