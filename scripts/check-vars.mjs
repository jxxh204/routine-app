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

const result = await fp.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  const card = document.querySelector('.py-ds-card-y');
  const cardCs = card ? getComputedStyle(card) : null;
  
  return {
    // CSS vars
    dsSpaceCardY: root.getPropertyValue('--ds-space-card-y').trim(),
    dsSpaceCardX: root.getPropertyValue('--ds-space-card-x').trim(),
    spacingDsCardY: root.getPropertyValue('--spacing-ds-card-y').trim(),
    spacingDsCardX: root.getPropertyValue('--spacing-ds-card-x').trim(),
    // Card computed
    cardPaddingBlock: cardCs?.paddingBlockStart,
    cardPaddingInline: cardCs?.paddingInlineStart,
    cardClasses: card?.className,
    // Check if class is in stylesheet
    allStyleSheets: document.styleSheets.length,
    // Raw check
    rawPaddingTop: cardCs?.paddingTop,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
