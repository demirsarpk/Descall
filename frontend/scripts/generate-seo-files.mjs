/**
 * Write production robots.txt + sitemap XML into dist/ for Vercel static hosting.
 * Stops Google from discovering SEO files via the Render proxy (onrender.com).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const SITE = "https://descall.com";

const { PUBLIC_ROUTES } = await import(pathToFileURL(path.join(root, "src/site/seoConfig.js")).href);
const { buildHumanSitemapHtml, SITEMAP_XSL } = await import(
  pathToFileURL(path.join(root, "src/site/buildSitemapHtml.js")).href
);

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function assertHttpsDescall(url) {
  if (!url.startsWith("https://descall.com")) {
    throw new Error(`[generate-seo-files] Non-canonical URL: ${url}`);
  }
}

function buildRobots() {
  return `# Descall robots.txt — production (static, served from descall.com)
User-agent: *
Allow: /
Allow: /download
Allow: /features
Allow: /faq
Allow: /security
Allow: /about
Allow: /privacy
Allow: /terms
Allow: /contact
Allow: /compare/
Allow: /discord-alternative
Allow: /discord-alternative-turkey
Allow: /discord-alternative-for-communities
Allow: /discord-alternative-for-lfg
Allow: /discord-alternative-for-voice-chat
Allow: /discord-alternative-for-friends
Allow: /best-discord-alternative-for-gamers
Allow: /apps-like-discord
Allow: /discord-replacement
Allow: /alternatives
Allow: /blog
Allow: /blog/
Allow: /sitemap.xml
Allow: /sitemap-pages.xml
Allow: /sitemap.html

Disallow: /app/
Disallow: /api/
Disallow: /auth/
Disallow: /admin/
Disallow: /media/
Disallow: /groups/
Disallow: /friends/
Disallow: /guilds/
Disallow: /invite/
Disallow: /i/
Disallow: /debug/
Disallow: /health
Disallow: /*?*invite=
Disallow: /*?*announcement=

Sitemap: ${SITE}/sitemap.xml
`;
}

function buildPagesSitemap() {
  const now = new Date().toISOString();
  const routes = PUBLIC_ROUTES.filter((r) => !r.noindex);
  const urls = routes.map((r) => {
    const loc = r.path === "/" ? `${SITE}/` : `${SITE}${r.path}`;
    assertHttpsDescall(loc);
    return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${xmlEscape(now)}</lastmod>
    <changefreq>${xmlEscape(r.changefreq || "weekly")}</changefreq>
    <priority>${xmlEscape(r.priority || "0.5")}</priority>
  </url>`;
  });

  // Human sitemap page
  urls.push(`  <url>
    <loc>${xmlEscape(`${SITE}/sitemap.html`)}</loc>
    <lastmod>${xmlEscape(now)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.3</priority>
  </url>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}

function buildSitemapIndex() {
  const now = new Date().toISOString();
  const child = `${SITE}/sitemap-pages.xml`;
  assertHttpsDescall(child);
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${xmlEscape(child)}</loc>
    <lastmod>${xmlEscape(now)}</lastmod>
  </sitemap>
</sitemapindex>
`;
}

function buildSitemapHtml() {
  return buildHumanSitemapHtml({
    origin: SITE,
    routes: PUBLIC_ROUTES.filter((r) => !r.noindex),
    lang: "en",
  });
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.error("[generate-seo-files] dist/ missing — run vite build first");
    process.exit(1);
  }

  const robots = buildRobots();
  const pages = buildPagesSitemap();
  const index = buildSitemapIndex();
  const html = buildSitemapHtml();

  // Guardrails
  for (const [name, body] of [
    ["robots", robots],
    ["sitemap", index],
    ["pages", pages],
  ]) {
    if (/https?:\/\/[^"'\s]*onrender\.com/i.test(body)) {
      throw new Error(`[generate-seo-files] ${name} contains onrender.com`);
    }
    if (/http:\/\/descall\.com/i.test(body)) {
      throw new Error(`[generate-seo-files] ${name} contains http://descall.com`);
    }
    if (/localhost|127\.0\.0\.1|vercel\.app/i.test(body)) {
      throw new Error(`[generate-seo-files] ${name} contains non-production host`);
    }
  }

  fs.writeFileSync(path.join(distDir, "robots.txt"), robots, "utf8");
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), index, "utf8");
  fs.writeFileSync(path.join(distDir, "sitemap-pages.xml"), pages, "utf8");
  fs.writeFileSync(path.join(distDir, "sitemap.html"), html, "utf8");
  fs.writeFileSync(path.join(distDir, "sitemap.xsl"), SITEMAP_XSL, "utf8");

  // Also refresh public/ copies so Vite copies them on next builds too
  fs.writeFileSync(path.join(root, "public/robots.txt"), robots, "utf8");
  fs.writeFileSync(path.join(root, "public/sitemap.xsl"), SITEMAP_XSL, "utf8");

  console.log(
    `[generate-seo-files] wrote robots.txt + sitemap index/pages/html/xsl (${PUBLIC_ROUTES.length} routes) → ${SITE}`
  );
}

main();
