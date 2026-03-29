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

// Check today page
const todayPage = await context.newPage();
await todayPage.goto('http://localhost:3018/today', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
await todayPage.waitForTimeout(1500);

const styles = await todayPage.evaluate(() => {
  // Find routine cards
  const cards = document.querySelectorAll('.routine-card-surface article');
  const results = [];
  cards.forEach((card, i) => {
    const cs = getComputedStyle(card);
    results.push({
      index: i,
      text: card.textContent?.slice(0, 30),
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
    });
  });

  // Check CSS variable
  const root = getComputedStyle(document.documentElement);
  return {
    cardY: root.getPropertyValue('--ds-space-card-y'),
    cardX: root.getPropertyValue('--ds-space-card-x'),
    spacingCardY: root.getPropertyValue('--spacing-ds-card-y'),
    cards: results,
  };
});

console.log(JSON.stringify(styles, null, 2));
await browser.close();
