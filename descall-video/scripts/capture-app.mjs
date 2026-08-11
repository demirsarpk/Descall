import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const auth = JSON.parse(fs.readFileSync('/tmp/auth_payload.json', 'utf8'));
const out = path.resolve('public/images/hires');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

async function shot(page, name) {
  await page.waitForTimeout(800);
  const p = path.join(out, `${name}.png`);
  await page.screenshot({ path: p, type: 'png', animations: 'disabled' });
  console.log('shot', name, fs.statSync(p).size, 'url', page.url());
}

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
});

await context.addInitScript(({ token, user }) => {
  localStorage.setItem('descall_token', token);
  localStorage.setItem('descall_user', JSON.stringify(user));
  localStorage.setItem('descall_language', 'en');
}, auth);

const page = await context.newPage();

// Marketing
for (const [name, url] of [
  ['m-home', 'https://descall.com/'],
  ['m-discord-alt', 'https://descall.com/discord-alternative'],
  ['m-features', 'https://descall.com/features'],
  ['m-compare', 'https://descall.com/compare/discord'],
  ['m-download', 'https://descall.com/download'],
]) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  });
  await page.waitForTimeout(1600);
  await shot(page, name);
  await page.evaluate(() => window.scrollBy(0, 520));
  await page.waitForTimeout(700);
  await shot(page, `${name}-mid`);
}

// Authenticated app views
for (const [name, url] of [
  ['app-direct', 'https://descall.com/direct'],
  ['app-friends', 'https://descall.com/friends'],
  ['app-groups', 'https://descall.com/groups'],
  ['app-calls', 'https://descall.com/calls'],
  ['app-activity', 'https://descall.com/activity'],
  ['app-settings', 'https://descall.com/settings/appearance'],
  ['app-settings-profile', 'https://descall.com/settings/profile'],
  ['app-play', 'https://descall.com/play'],
]) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2800);
  await shot(page, name);
}

// Try open first DM / conversation in list
await page.goto('https://descall.com/direct', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(2500);
await shot(page, 'app-direct-2');

// Click likely conversation rows
const clicked = await page.evaluate(() => {
  const candidates = Array.from(document.querySelectorAll('a,button,[role="button"],[role="listitem"],li'));
  for (const el of candidates) {
    const t = (el.innerText || '').toLowerCase();
    if (t.includes('sam') || t.includes('nova') || t.includes('@') || t.includes('design')) {
      el.click();
      return t.slice(0, 80);
    }
  }
  // fallback: first link under /direct/
  const link = document.querySelector('a[href^="/direct/"]');
  if (link) { link.click(); return link.getAttribute('href'); }
  return null;
});
console.log('clicked', clicked);
await page.waitForTimeout(2500);
await shot(page, 'app-open-dm');

// If still on list, try known usernames from scene
for (const u of ['sam', 'nova', 'Sam', 'Nova']) {
  await page.goto(`https://descall.com/direct/${u}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2200);
  await shot(page, `app-dm-${u.toLowerCase()}`);
}

// Groups list click
await page.goto('https://descall.com/groups', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const link = document.querySelector('a[href^="/groups/"]');
  if (link) link.click();
});
await page.waitForTimeout(2200);
await shot(page, 'app-group-open');

await browser.close();
console.log('DONE');
