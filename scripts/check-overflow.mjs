import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('../apps/web/node_modules/playwright');

const iPhone = devices['iPhone 12'];
const browser = await chromium.launch();
const context = await browser.newContext({ ...iPhone, colorScheme: 'dark' });
const page = await context.newPage();
await page.goto('http://localhost:3018/auth');
await page.evaluate(() => localStorage.setItem('routine-auth-mock-login', '1'));
await page.close();

const tp = await context.newPage();
await tp.goto('http://localhost:3018/today', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await tp.waitForTimeout(1500);

const result = await tp.evaluate(() => {
  const wrapper = document.querySelector('.routine-card-surface.relative.overflow-hidden');
  if (!wrapper) return { error: 'wrapper not found' };
  const cs = getComputedStyle(wrapper);
  return {
    overflow: cs.overflow,
    overflowX: cs.overflowX,
    overflowY: cs.overflowY,
    classes: wrapper.className,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
