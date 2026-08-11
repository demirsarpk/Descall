import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const auth = JSON.parse(fs.readFileSync('/tmp/auth_payload.json', 'utf8'));
const out = path.resolve('public/images/hires');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

async function shot(page, name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `${name}.png`), type: 'png' });
  console.log('shot', name, page.url());
}

// Marketing - no auth
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  for (const [n,u] of [
    ['m-home','https://descall.com/'],
    ['m-discord-alt','https://descall.com/discord-alternative'],
    ['m-features','https://descall.com/features'],
    ['m-compare','https://descall.com/compare/discord'],
    ['m-download','https://descall.com/download'],
  ]) {
    await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1800);
    await shot(page, n);
    await page.evaluate(() => window.scrollBy(0, 560));
    await page.waitForTimeout(800);
    await shot(page, `${n}-mid`);
  }
  await ctx.close();
}

// App with auth - richer moments
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(({ token, user }) => {
    localStorage.setItem('descall_token', token);
    localStorage.setItem('descall_user', JSON.stringify(user));
    localStorage.setItem('descall_language', 'en');
  }, auth);
  const page = await ctx.newPage();

  await page.goto('https://descall.com/direct/samdemo', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  await shot(page, 'app-dm-samdemo');
  // scroll chat up a bit
  await page.evaluate(() => {
    const sc = document.querySelector('[class*="message"], main, [data-scroll]') || document.scrollingElement;
    if (sc) sc.scrollTop = Math.max(0, (sc.scrollHeight || 0) - 800);
  });
  await page.waitForTimeout(600);
  await shot(page, 'app-dm-samdemo-scroll');

  // Try friends of alexdemo - list usernames via page text
  await page.goto('https://descall.com/direct', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const hrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/direct/"]')).map(a => a.getAttribute('href')));
  console.log('dm hrefs', hrefs);
  for (const href of hrefs.slice(0, 4)) {
    const slug = href.split('/').pop();
    await page.goto(`https://descall.com${href}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    await shot(page, `app-dm-${slug}`);
  }

  await page.goto('https://descall.com/groups', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const ghrefs = await page.evaluate(() => Array.from(document.querySelectorAll('a[href^="/groups/"]')).map(a => a.getAttribute('href')));
  console.log('group hrefs', ghrefs);
  if (ghrefs[0]) {
    await page.goto(`https://descall.com${ghrefs[0]}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await shot(page, 'app-group-chat');
  }

  await page.goto('https://descall.com/settings/appearance', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(page, 'app-appearance');
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(600);
  await shot(page, 'app-appearance-mid');

  await page.goto('https://descall.com/settings/profile', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(page, 'app-profile');

  await page.goto('https://descall.com/play', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(page, 'app-play-2');

  await page.goto('https://descall.com/friends', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  await shot(page, 'app-friends-2');

  await ctx.close();
}
await browser.close();
console.log('PASS2 DONE');
