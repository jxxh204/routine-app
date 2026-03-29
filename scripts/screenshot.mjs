import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('../apps/web/node_modules/playwright');

const iPhone = devices['iPhone 12'];
const pages = [
  { path: '/today', name: 'today' },
  { path: '/calendar', name: 'calendar' },
  { path: '/friends', name: 'friends' },
  { path: '/settings', name: 'settings' },
  { path: '/auth', name: 'auth' },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  ...iPhone,
  colorScheme: 'dark',
});

// Set mock login in localStorage before navigating
const setupPage = await context.newPage();
await setupPage.goto('http://localhost:3018/auth');
await setupPage.evaluate(() => {
  localStorage.setItem('routine-auth-mock-login', '1');
});
await setupPage.close();

for (const { path, name } of pages) {
  const page = await context.newPage();
  await page.goto(`http://localhost:3018${path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `docs/screenshots/2026-03-29-${name}.png`, fullPage: true });
  await page.close();
}

await browser.close();
console.log('Done');
