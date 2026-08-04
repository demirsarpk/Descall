/**
 * Lightweight self-test for sitemap helpers (no HTTP / DB).
 * Run: node frontend/backend/routes/sitemap.selftest.cjs
 */
const assert = require("assert");

// Minimal inline copies of pure helpers to avoid loading express/supabase in isolation
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
assert.ok(pages.some((p) => p.loc.endsWith("/")));
assert.ok(pages.some((p) => p.loc.endsWith("/download")));
assert.ok(pages[0].alternates?.some((a) => a.hreflang === "tr"));

const fakeReq = {
  protocol: "https",
  get: (h) => (h === "host" ? "example.test" : null),
};
assert.strictEqual(siteOrigin(fakeReq), "https://example.test");

console.log("sitemap.selftest.cjs: ok");
