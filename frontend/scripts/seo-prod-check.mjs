#!/usr/bin/env node
/**
 * Production SEO/CWV smoke checklist against the live origin.
 *
 * Usage:
 *   node scripts/seo-prod-check.mjs
 *   SITE_ORIGIN=https://descall.com node scripts/seo-prod-check.mjs
 */
const ORIGIN = String(process.env.SITE_ORIGIN || "https://descall.com").replace(/\/+$/, "");

async function get(path) {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { "user-agent": "DescallSeoProdCheck/1.0" },
  });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

const html = await get("/features");
if (html.status !== 200) fail(`/features status ${html.status}`);
else ok(`/features ${html.status}`);

if (/\bLoading\b/i.test(html.text.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, ""))) {
  fail("/features still contains Loading");
} else ok("/features has no Loading placeholder");

if (!/id="seo-static"[\s\S]*?<main/i.test(html.text)) fail("/features missing seo-static main");
else ok("/features has seo-static <main>");

if (!/<h1[\s\S]*?<\/h1>/i.test(html.text)) fail("/features missing h1");
else ok("/features has h1");

const home = await get("/");
if (home.status !== 200) fail(`/ status ${home.status}`);
else ok(`/ ${home.status}`);
if (/\bLoading\b/i.test(home.text.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, ""))) {
  fail("/ still contains Loading in body");
} else ok("/ has no Loading placeholder in body");
if (!/<h1[\s\S]*?Descall/i.test(home.text)) fail("home missing Descall h1");
else ok("home has Descall h1");
if (!/id="seo-static"[\s\S]*?<main/i.test(home.text)) fail("/ missing seo-static main");
else ok("/ has seo-static <main>");

for (const p of ["/about", "/contact", "/privacy"]) {
  const page = await get(p);
  if (page.status !== 200) fail(`${p} status ${page.status}`);
  else ok(`${p} ${page.status}`);
  const body = page.text.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  if (/\bLoading\b/i.test(body)) fail(`${p} contains Loading in body`);
  else ok(`${p} has no Loading placeholder in body`);
  if (!/<h1[\s\S]*?<\/h1>/i.test(page.text)) fail(`${p} missing h1`);
  else ok(`${p} has h1`);
}

const robots = await get("/robots.txt");
if (!/Sitemap:\s*https:\/\/descall\.com\/sitemap\.xml/i.test(robots.text)) fail("robots missing sitemap");
else ok("robots.txt sitemap present");

const sitemap = await get("/sitemap.xml");
if (!/sitemapindex/i.test(sitemap.text)) fail("sitemap index missing");
else ok("sitemap.xml index present");

const faq = await get("/faq");
const ldBlocks = [...faq.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map(
  (m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
);
const faqLd = ldBlocks.find((d) => d && d["@type"] === "FAQPage");
if (!faqLd) fail("FAQPage JSON-LD missing");
else if (!Array.isArray(faqLd.mainEntity) || faqLd.mainEntity.length < 5) fail("FAQPage mainEntity thin");
else ok(`FAQPage JSON-LD with ${faqLd.mainEntity.length} questions`);

if (!/id="mkt-consent-static"/i.test(html.text)) fail("/features missing cookie consent shell");
else ok("/features has cookie consent shell");

if (!/hreflang="en"/i.test(html.text) || !/hreflang="x-default"/i.test(html.text)) {
  fail("/features missing hreflang");
} else ok("/features has hreflang en + x-default");
if (!/hreflang="tr"/i.test(html.text)) fail("/features missing hreflang tr");
else ok("/features has hreflang tr");

const homeTitle = home.text.match(/<title>([^<]*)<\/title>/i)?.[1] || "";
if (/discord alternative/i.test(homeTitle)) fail("homepage title still cannibalizes Discord Alternative");
else ok(`homepage title brand-first: ${homeTitle}`);

for (const [p, needle] of [
  ["/alternatives", "Discord Alternatives Compared"],
  ["/compare/discord", "Discord vs Descall"],
  ["/discord-alternative", "Free Discord Alternative"],
  ["/discord-alternative-turkey", "Discord Alternatifi"],
]) {
  const page = await get(p);
  if (page.status !== 200) fail(`${p} status ${page.status}`);
  else ok(`${p} ${page.status}`);
  if (!page.text.includes(needle)) fail(`${p} missing title needle "${needle}"`);
  else ok(`${p} title contains "${needle}"`);
  if (["/alternatives", "/compare/discord", "/discord-alternative", "/discord-alternative-turkey"].includes(p)) {
    if (!/FAQPage/i.test(page.text)) fail(`${p} missing FAQPage JSON-LD`);
    else ok(`${p} has FAQPage JSON-LD`);
  }
}

const httpProbe = await fetch("http://descall.com/", { redirect: "manual", headers: { "user-agent": "DescallSeoProdCheck/1.0" } }).catch((err) => ({ ok: false, err }));
if (httpProbe?.status >= 300 && httpProbe?.status < 400) {
  const loc = httpProbe.headers.get("location") || "";
  if (!/^https:\/\/descall\.com/i.test(loc)) fail(`HTTP redirect location not https: ${loc}`);
  else ok(`HTTP → HTTPS 301/302 to ${loc}`);
} else if (httpProbe?.err) {
  console.warn("WARN: could not probe http://descall.com:", httpProbe.err.message || httpProbe.err);
} else {
  console.warn(`WARN: http://descall.com status ${httpProbe?.status} (expected 3xx)`);
}

if (!/fonts\.googleapis\.com/i.test(html.text)) ok("/features has no Google Fonts link");
else fail("/features still loads Google Fonts");

if (!/Marketing shell: consent/i.test(html.text) && !/data-consent/i.test(html.text)) {
  fail("/features missing consent markup");
} else ok("/features has consent markup");

if (!/Marketing shell: consent \+ hydrate/i.test(html.text)) {
  // Soft check — comment may minify away; require click handler source string instead.
  if (!/descall:cookie_consent_v1/i.test(html.text)) fail("/features missing static consent script");
  else ok("/features has static consent script");
} else ok("/features keeps marketing shell script after prerender");

if (!process.exitCode) console.log("\nseo-prod-check: all checks passed for", ORIGIN);
