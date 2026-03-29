import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('../apps/web/node_modules/playwright');

const iPhone = devices['iPhone 12'];
const browser = await chromium.launch();
const context = await browser.newContext({ ...iPhone, colorScheme: 'dark' });

const setupPage = await context.newPage();
await setupPage.goto('http://localhost:3018/auth');
await setupPage.evaluate(() => localStorage.setItem('routine-auth-mock-login', '1'));
await setupPage.close();

const page = await context.newPage();
await page.goto('http://localhost:3018/settings', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'docs/screenshots/2026-03-29-settings.png', fullPage: true });
await page.close();
await browser.close();
console.log('Done');
