#!/usr/bin/env node
/**
 * Internal-link audit: every indexable PUBLIC_ROUTE should be reachable
 * from hub nav / related clusters (reduces orphan pages).
 *
 * Usage: node scripts/seo-link-audit.mjs
 */
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { PUBLIC_ROUTES } = await import(pathToFileURL(join(root, "src/site/seoConfig.js")).href);
const { SEO_PILLARS, SEO_NICHES, SEO_COMPANY, SEO_DEFAULT_RELATED } = await import(
  pathToFileURL(join(root, "src/site/seoHubLinks.js")).href
);
const { BLOG_RELATED } = await import(
  pathToFileURL(join(root, "src/site/content/discordSeoContent.js")).href
);
const { corePageBody } = await import(pathToFileURL(join(root, "src/site/seo/corePageBodies.js")).href);

const linked = new Set(
  [...SEO_PILLARS, ...SEO_NICHES, ...SEO_COMPANY, ...SEO_DEFAULT_RELATED, ...BLOG_RELATED].map((l) => l.to)
);
linked.add("/");
linked.add("/blog");
linked.add("/tr");

// Extract hrefs from prerender bodies
for (const route of PUBLIC_ROUTES) {
  const body = corePageBody(route.path) || "";
  for (const m of body.matchAll(/href="(\/[^"#?]*)"/g)) linked.add(m[1]);
}

const indexable = PUBLIC_ROUTES.filter((r) => !r.noindex);
const orphans = indexable.filter((r) => {
  if (linked.has(r.path)) return false;
  // /tr/* mirrors are linked via /tr hub + hreflang
  if (r.path.startsWith("/tr/")) return !linked.has("/tr");
  // blog posts are expected via /blog index
  if (r.path.startsWith("/blog/")) return !linked.has("/blog") && !linked.has(r.path);
  return true;
});

console.log(`Linked targets: ${linked.size}`);
console.log(`Indexable routes: ${indexable.length}`);
if (orphans.length) {
  console.error("Orphan (or weakly linked) routes:");
  for (const o of orphans) console.error(" -", o.path);
  process.exitCode = 1;
} else {
  console.log("seo-link-audit: ok — no orphans");
}
