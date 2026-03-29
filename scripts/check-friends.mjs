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

const fp = await context.newPage();
await fp.goto('http://localhost:3018/friends', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await fp.waitForTimeout(1500);

const styles = await fp.evaluate(() => {
  const cards = document.querySelectorAll('.bg-ds-surface');
  const results = [];
  cards.forEach((card, i) => {
    const cs = getComputedStyle(card);
    results.push({
      index: i,
      text: card.textContent?.slice(0, 40),
      cls: card.className.slice(0, 80),
      paddingTop: cs.paddingTop,
      paddingLeft: cs.paddingLeft,
    });
  });
  return results;
});

console.log(JSON.stringify(styles, null, 2));
await browser.close();
