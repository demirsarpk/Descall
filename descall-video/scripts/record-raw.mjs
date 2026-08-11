import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const auth = JSON.parse(fs.readFileSync('/tmp/auth_payload.json', 'utf8'));
const outDir = path.resolve('public/video');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
});
await context.addInitScript(({ token, user }) => {
  localStorage.setItem('descall_token', token);
  localStorage.setItem('descall_user', JSON.stringify(user));
  localStorage.setItem('descall_language', 'en');
}, auth);
const page = await context.newPage();

await page.goto('https://descall.com/direct', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.goto('https://descall.com/direct/samdemo', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
// try click attachment / scroll messages
await page.mouse.wheel(0, -300);
await page.waitForTimeout(800);
await page.goto('https://descall.com/groups', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.goto('https://descall.com/friends', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.goto('https://descall.com/play', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.goto('https://descall.com/settings/appearance', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
// click Appearance row if present
await page.getByText('Appearance', { exact: true }).first().click({ timeout: 3000 }).catch(()=>{});
await page.waitForTimeout(2000);
await page.goto('https://descall.com/calls', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
await page.goto('https://descall.com/discord-alternative', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await context.close();
await browser.close();
// rename video
const vids = fs.readdirSync(outDir).filter(f => f.endsWith('.webm'));
console.log('vids', vids);
if (vids[0]) {
  fs.renameSync(path.join(outDir, vids[0]), path.join(outDir, 'raw-source.webm'));
}
console.log('done');
