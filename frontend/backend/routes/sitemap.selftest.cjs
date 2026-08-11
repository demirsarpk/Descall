/**
 * Lightweight self-test for sitemap helpers (no HTTP / DB).
 * Run: node frontend/backend/routes/sitemap.selftest.cjs
 */
const assert = require("assert");

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

assert.strictEqual(xmlEscape(`a&b<"'>`), "a&amp;b&lt;&quot;&apos;&gt;");

const { staticPages, siteOrigin } = require("./sitemap.js");

const ORIGIN = "https://descall.com";
const pages = staticPages(ORIGIN);
const locs = pages.map((p) => p.loc);

assert.ok(locs.includes(`${ORIGIN}/`));
assert.ok(locs.includes(`${ORIGIN}/download`));
assert.ok(locs.includes(`${ORIGIN}/faq`));
assert.ok(locs.includes(`${ORIGIN}/privacy`));
assert.ok(locs.includes(`${ORIGIN}/compare/discord`));
assert.ok(locs.includes(`${ORIGIN}/discord-alternative`));
assert.ok(locs.includes(`${ORIGIN}/alternatives`));
assert.ok(locs.includes(`${ORIGIN}/best-discord-alternative-for-gamers`));
assert.ok(locs.includes(`${ORIGIN}/discord-alternative-turkey`));
assert.ok(locs.includes(`${ORIGIN}/blog`));
assert.ok(locs.includes(`${ORIGIN}/blog/discord-vs-descall`));
assert.ok(locs.includes(`${ORIGIN}/apps-like-discord`));
assert.ok(locs.includes(`${ORIGIN}/discord-replacement`));
assert.ok(locs.includes(`${ORIGIN}/discord-alternative-for-lfg`));

// No invite spam / locale alternates
assert.ok(!pages.some((p) => p.alternates?.length));
assert.ok(!locs.some((l) => l.includes("invite=") || l.includes("announcement=")));

// Hard SEO invariants
assert.ok(pages.length >= 28);
assert.ok(locs.every((l) => l.startsWith("https://descall.com")));
assert.ok(!locs.some((l) => l.startsWith("http://")));
assert.ok(!locs.some((l) => /onrender\.com|vercel\.app|localhost/i.test(l)));

// siteOrigin ignores request host — always canonical HTTPS apex
const fakeReq = {
  protocol: "http",
  get: (h) => {
    if (h === "host") return "des-call.onrender.com";
    if (h === "x-forwarded-proto") return "http";
    if (h === "x-forwarded-host") return "des-call.onrender.com";
    return null;
  },
};
assert.strictEqual(siteOrigin(fakeReq), "https://descall.com");

// Bad env must not win
const prev = process.env.PUBLIC_APP_URL;
process.env.PUBLIC_APP_URL = "http://des-call.onrender.com";
assert.strictEqual(siteOrigin(fakeReq), "https://descall.com");
process.env.PUBLIC_APP_URL = prev;

console.log("sitemap.selftest.cjs: ok");
