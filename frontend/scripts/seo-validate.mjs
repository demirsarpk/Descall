/**
 * SEO health checks — run after build or in CI.
 * Validates route registry integrity, prerender shells, and basic meta quality.
 *
 * Usage:
 *   node scripts/seo-validate.mjs
 *   node scripts/seo-validate.mjs --dist   (also check dist shells)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const checkDist = process.argv.includes("--dist");

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

const { PUBLIC_ROUTES } = await import(pathToFileURL(path.join(root, "src/site/seoConfig.js")).href);
const { KEYWORD_STRATEGY } = await import(
  pathToFileURL(path.join(root, "src/site/seo/keywordStrategy.js")).href
);
const { NICHE_LANDINGS } = await import(pathToFileURL(path.join(root, "src/site/seo/nicheLandings.js")).href);
const { BLOG_POSTS } = await import(
  pathToFileURL(path.join(root, "src/site/content/discordSeoContent.js")).href
);
const { BLOG_BODIES } = await import(pathToFileURL(path.join(root, "src/site/seo/blogBodies.js")).href);

const marketingApp = fs.readFileSync(path.join(root, "src/site/MarketingApp.jsx"), "utf8");
const sitemapJs = fs.readFileSync(path.join(root, "backend/routes/sitemap.js"), "utf8");
const robotsTxt = fs.readFileSync(path.join(root, "public/robots.txt"), "utf8");

const paths = PUBLIC_ROUTES.map((r) => r.path);
const titles = new Map();
const descriptions = new Map();

for (const route of PUBLIC_ROUTES) {
  if (!route.path?.startsWith("/")) fail(`Invalid path: ${route.path}`);
  if (!route.title) fail(`Missing title: ${route.path}`);
  if (!route.description) fail(`Missing description: ${route.path}`);
  if (route.title.length > 70) warn(`Title long (${route.title.length}): ${route.path}`);
  if (route.title.length < 20) warn(`Title short (${route.title.length}): ${route.path}`);
  if (route.description.length > 170) warn(`Description long (${route.description.length}): ${route.path}`);
  if (route.description.length < 70) warn(`Description short (${route.description.length}): ${route.path}`);

  if (titles.has(route.title)) fail(`Duplicate title: "${route.title}" (${titles.get(route.title)} & ${route.path})`);
  else titles.set(route.title, route.path);

  if (descriptions.has(route.description)) {
    fail(`Duplicate description: ${route.path} & ${descriptions.get(route.description)}`);
  } else descriptions.set(route.description, route.path);

  // Route should be registered in MarketingApp (blog/:slug covers posts)
  if (route.path.startsWith("/blog/") && route.path !== "/blog") {
    const slug = route.path.slice("/blog/".length);
    if (!marketingApp.includes('path="/blog/:slug"')) fail("MarketingApp missing /blog/:slug");
    if (!BLOG_POSTS.some((p) => p.slug === slug)) fail(`Blog slug missing from BLOG_POSTS: ${slug}`);
    if (!BLOG_BODIES[slug]) fail(`Blog body missing: ${slug}`);
  } else if (NICHE_LANDINGS[route.path]) {
    if (!marketingApp.includes("DiscordAlternativeNichePage")) {
      fail("MarketingApp missing DiscordAlternativeNichePage");
    }
  } else if (route.path !== "/download" && route.path !== "/") {
    // soft check — path string appears in MarketingApp or is niche/blog
    const needle = route.path === "/" ? 'path="/"' : `path="${route.path}"`;
    if (!marketingApp.includes(needle) && !marketingApp.includes(`'${route.path}'`)) {
      // dynamic niche routes share one component — already handled
      if (!route.path.startsWith("/discord-alternative-for-") && route.path !== "/apps-like-discord" && route.path !== "/discord-replacement") {
        warn(`Path may be missing from MarketingApp.jsx: ${route.path}`);
      }
    }
  }

  if (!sitemapJs.includes(`path: "${route.path}"`) && route.path !== "/") {
    // "/" is present as path: "/"
    if (!sitemapJs.includes(`path: "${route.path}"`)) {
      fail(`Sitemap missing path: ${route.path}`);
    }
  }
}

// Keyword targets must resolve to known routes
const routeSet = new Set(paths);
for (const row of KEYWORD_STRATEGY) {
  if (!routeSet.has(row.targetPath)) {
    fail(`Keyword "${row.keyword}" targets unknown path ${row.targetPath}`);
  }
}

// Niche uniqueness
const nicheH1 = new Set();
for (const [p, niche] of Object.entries(NICHE_LANDINGS)) {
  if (!routeSet.has(p)) fail(`Niche landing not in PUBLIC_ROUTES: ${p}`);
  if (nicheH1.has(niche.h1)) fail(`Duplicate niche H1: ${niche.h1}`);
  nicheH1.add(niche.h1);
  if (!niche.faq?.length) fail(`Niche missing FAQ: ${p}`);
  if ((niche.lead || "").length < 80) warn(`Niche lead short: ${p}`);
}

if (!robotsTxt.includes("Sitemap: https://descall.com/sitemap.xml")) {
  fail("public/robots.txt must point Sitemap to https://descall.com/sitemap.xml");
}
if (robotsTxt.includes("des-call.onrender.com")) {
  fail("public/robots.txt still references onrender.com");
}

if (checkDist) {
  const dist = path.join(root, "dist");
  if (!fs.existsSync(dist)) {
    fail("dist/ missing — run build first");
  } else {
    for (const route of PUBLIC_ROUTES) {
      const rel = route.path === "/" ? "index.html" : path.join(route.path.replace(/^\//, ""), "index.html");
      const file = path.join(dist, rel);
      if (!fs.existsSync(file)) {
        fail(`Prerender shell missing: ${rel}`);
        continue;
      }
      const html = fs.readFileSync(file, "utf8");
      if (!html.includes("<title>")) fail(`No <title> in ${rel}`);
      if (!html.includes('rel="canonical"')) fail(`No canonical in ${rel}`);
      if (!html.includes("<h1")) fail(`No <h1> crawl content in ${rel}`);
      if (html.includes('content=""') && html.includes('name="description"')) {
        warn(`Empty description meta possible in ${rel}`);
      }
      // noindex should not appear on indexable shells
      if (/noindex/i.test(html) && !route.noindex) fail(`noindex found on indexable shell ${rel}`);
    }
  }
}

console.log(`SEO validate: ${PUBLIC_ROUTES.length} routes, ${KEYWORD_STRATEGY.length} keywords, ${Object.keys(NICHE_LANDINGS).length} niches`);
for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

if (errors.length) {
  console.error(`\nseo-validate failed: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`\nseo-validate ok (${warnings.length} warning(s))`);
