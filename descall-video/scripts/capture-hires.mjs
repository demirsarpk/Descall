import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const out = path.resolve('public/images/hires');
fs.mkdirSync(out, { recursive: true });

const pages = [
  { name: 'm-home', url: 'https://descall.com/' },
  { name: 'm-discord-alt', url: 'https://descall.com/discord-alternative' },
  { name: 'm-features', url: 'https://descall.com/features' },
  { name: 'm-compare', url: 'https://descall.com/compare' },
  { name: 'm-download', url: 'https://descall.com/download' },
  { name: 'm-login', url: 'https://descall.com/login' },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await context.newPage();
for (const p of pages) {
  await page.goto(p.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, `${p.name}.png`), type: 'png' });
  console.log('captured', p.name);
  // scroll mid
  await page.evaluate(() => window.scrollBy(0, 520));
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, `${p.name}-scroll.png`), type: 'png' });
}
await browser.close();
console.log('done');
