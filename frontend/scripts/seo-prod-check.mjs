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

if (/\bLoading\b/i.test(html.text)) fail("/features still contains Loading");
else ok("/features has no Loading placeholder");

if (!/id="seo-static"[\s\S]*?<main/i.test(html.text)) fail("/features missing seo-static main");
else ok("/features has seo-static <main>");

if (!/<h1[\s\S]*?<\/h1>/i.test(html.text)) fail("/features missing h1");
else ok("/features has h1");

const home = await get("/");
if (!/<h1[\s\S]*?Descall/i.test(home.text)) fail("home missing Descall h1");
else ok("home has Descall h1");

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

if (!/fonts\.googleapis\.com/i.test(html.text)) ok("/features has no Google Fonts link");
else fail("/features still loads Google Fonts");

if (!process.exitCode) console.log("\nseo-prod-check: all checks passed for", ORIGIN);
