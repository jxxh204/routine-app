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

// Use CDP to get matched rules for padding
const client = await fp.context().newCDPSession(fp);
const doc = await client.send('DOM.getDocument');
const node = await client.send('DOM.querySelector', {
  nodeId: doc.root.nodeId,
  selector: '.py-ds-card-y'
});

await client.send('CSS.enable');
const matched = await client.send('CSS.getMatchedStylesForNode', { nodeId: node.nodeId });

// Find padding rules
const paddingRules = [];
for (const match of matched.matchedCSSRules || []) {
  for (const prop of match.rule.style.cssProperties || []) {
    if (prop.name.includes('padding')) {
      paddingRules.push({
        selector: match.rule.selectorList?.text,
        name: prop.name,
        value: prop.value,
        important: prop.important,
      });
    }
  }
}

console.log(JSON.stringify(paddingRules, null, 2));
await browser.close();
