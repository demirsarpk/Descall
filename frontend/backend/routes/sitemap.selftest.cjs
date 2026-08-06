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

const pages = staticPages("https://des-call.onrender.com");
const locs = pages.map((p) => p.loc);
assert.ok(locs.includes("https://des-call.onrender.com/"));
assert.ok(locs.includes("https://des-call.onrender.com/download"));
assert.ok(locs.includes("https://des-call.onrender.com/faq"));
assert.ok(locs.includes("https://des-call.onrender.com/privacy"));
assert.ok(locs.includes("https://des-call.onrender.com/compare/discord"));
// Fictional locale alternates and invite spam must stay out of the default pages set
assert.ok(!pages.some((p) => p.alternates?.length));
assert.ok(!locs.some((l) => l.includes("invite=") || l.includes("announcement=")));

const fakeReq = {
  protocol: "https",
  get: (h) => (h === "host" ? "example.test" : null),
};
assert.strictEqual(siteOrigin(fakeReq), "https://example.test");

console.log("sitemap.selftest.cjs: ok");
