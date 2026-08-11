/**
 * Post-build SEO HTML shells for crawlers.
 * - Route meta from src/site/seoConfig.js (single source of truth)
 * - Injects crawlable <main> into #root so HTML responses aren't empty SPA shells
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const SITE = "https://descall.com";
const OG = `${SITE}/og-default.svg`;

const { PUBLIC_ROUTES } = await import(pathToFileURL(path.join(root, "src/site/seoConfig.js")).href);
const { NICHE_LANDINGS } = await import(pathToFileURL(path.join(root, "src/site/seo/nicheLandings.js")).href);
const { BLOG_POSTS } = await import(
  pathToFileURL(path.join(root, "src/site/content/discordSeoContent.js")).href
);
const { BLOG_BODIES } = await import(pathToFileURL(path.join(root, "src/site/seo/blogBodies.js")).href);

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function crawlBody(route) {
  const niche = NICHE_LANDINGS[route.path];
  if (niche) {
    const sections = niche.sections
      .map((s) => `<h2>${escapeHtml(s.h)}</h2><p>${escapeHtml(s.p)}</p>`)
      .join("\n");
    const links = niche.related
      .map((l) => `<li><a href="${escapeHtml(l.to)}">${escapeHtml(l.label)}</a></li>`)
      .join("");
    return `
<main>
  <h1>${escapeHtml(niche.h1)}</h1>
  <p>${escapeHtml(niche.lead)}</p>
  <p><a href="/download">Download Descall</a> · <a href="/discord-alternative">Discord alternative</a></p>
  <h2>${escapeHtml(niche.answerTitle)}</h2>
  <p>${escapeHtml(niche.answer)}</p>
  <ul>${niche.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
  ${sections}
  <nav aria-label="Related"><ul>${links}</ul></nav>
</main>`;
  }

  if (route.path.startsWith("/blog/") && route.path !== "/blog") {
    const slug = route.path.replace("/blog/", "");
    const post = BLOG_POSTS.find((p) => p.slug === slug);
    const body = BLOG_BODIES[slug];
    if (post && body) {
      const sections = body.sections
        .map((s) => `<h2>${escapeHtml(s.h)}</h2><p>${escapeHtml(s.p)}</p>`)
        .join("\n");
      return `
<main>
  <article>
    <h1>${escapeHtml(post.title)}</h1>
    <p>${escapeHtml(post.description)}</p>
    ${sections}
    <p><a href="/blog">Blog</a> · <a href="/discord-alternative">Discord alternative</a> · <a href="/download">Download</a></p>
  </article>
</main>`;
    }
  }

  const h1 = route.h1 || route.title.replace(/\s*\|\s*Descall\s*$/i, "").replace(/\s*—\s*Descall\s*$/i, "");
  return `
<main>
  <h1>${escapeHtml(h1)}</h1>
  <p>${escapeHtml(route.description)}</p>
  <nav aria-label="Descall">
    <a href="/">Home</a>
    <a href="/discord-alternative">Discord alternative</a>
    <a href="/alternatives">Alternatives</a>
    <a href="/compare/discord">Descall vs Discord</a>
    <a href="/apps-like-discord">Apps like Discord</a>
    <a href="/features">Features</a>
    <a href="/download">Download</a>
    <a href="/blog">Blog</a>
    <a href="/faq">FAQ</a>
  </nav>
</main>`;
}

function stripStaleHeadSeo(html) {
  return html
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="keywords"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="alternate"[^>]*hreflang="[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "");
}

function injectMeta(html, route) {
  const url = `${SITE}${route.path === "/" ? "/" : route.path}`;
  const title = escapeHtml(route.title);
  const desc = escapeHtml(route.description);
  const keywords = route.keywords ? escapeHtml(route.keywords) : "";
  const lang = route.lang || "en";
  const ogType = route.ogType || "website";

  let out = stripStaleHeadSeo(html);
  out = out.replace(/<html\s+lang="[^"]*"/i, `<html lang="${lang}"`);
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);

  const isTurkey = route.path === "/discord-alternative-turkey" || lang === "tr";
  const hreflang = isTurkey
    ? [
        `<link rel="alternate" hreflang="tr" href="${url}" />`,
        `<link rel="alternate" hreflang="en" href="${SITE}/discord-alternative" />`,
        `<link rel="alternate" hreflang="x-default" href="${SITE}/discord-alternative" />`,
      ]
    : [
        `<link rel="alternate" hreflang="en" href="${url}" />`,
        `<link rel="alternate" hreflang="x-default" href="${url}" />`,
        route.path === "/discord-alternative"
          ? `<link rel="alternate" hreflang="tr" href="${SITE}/discord-alternative-turkey" />`
          : "",
      ];

  const metaBlock = [
    `<meta name="description" content="${desc}" />`,
    keywords ? `<meta name="keywords" content="${keywords}" />` : "",
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />`,
    `<link rel="canonical" href="${url}" />`,
    ...hreflang,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="Descall" />`,
    `<meta property="og:image" content="${OG}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="${isTurkey ? "tr_TR" : "en_US"}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    `<meta name="twitter:image" content="${OG}" />`,
  ]
    .filter(Boolean)
    .join("\n    ");

  out = out.replace(/<\/title>/i, `</title>\n    ${metaBlock}`);

  // Boot splash uses an <h1> for the brand mark — demote so the page keeps a single H1.
  out = out.replace(
    /<h1 class="boot-title">Descall<\/h1>/i,
    '<div class="boot-title">Descall</div>'
  );

  const body = crawlBody(route);
  // Prefer injecting into #root so crawlers see content before SPA mount.
  if (/<div id="root"><\/div>/i.test(out)) {
    out = out.replace(/<div id="root"><\/div>/i, `<div id="root">${body}</div>`);
  } else if (/<div id="root">[\s\S]*?<\/div>/i.test(out)) {
    out = out.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${body}</div>`);
  }

  // Noscript nav only — full crawl body already lives in #root (avoid duplicate H1).
  const noscript = `<noscript>
      <nav aria-label="Descall">
        <a href="/">Descall</a>
        <a href="/discord-alternative">Discord alternative</a>
        <a href="/alternatives">Alternatives</a>
        <a href="/compare/discord">vs Discord</a>
        <a href="/apps-like-discord">Apps like Discord</a>
        <a href="/features">Features</a>
        <a href="/download">Download</a>
        <a href="/blog">Blog</a>
        <a href="/faq">FAQ</a>
        <a href="/contact">Contact</a>
      </nav>
    </noscript>`;
  if (/<noscript>[\s\S]*?<\/noscript>/i.test(out)) {
    out = out.replace(/<noscript>[\s\S]*?<\/noscript>/i, noscript);
  }

  return out;
}

function writeRoute(route, html) {
  const rel = route.path === "/" ? "" : route.path.replace(/^\//, "");
  const dir = rel ? path.join(distDir, rel) : distDir;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, injectMeta(html, route), "utf8");
  console.log(`[prerender-seo] ${route.path}`);
}

function main() {
  if (!fs.existsSync(indexPath)) {
    console.error("[prerender-seo] dist/index.html missing — run vite build first");
    process.exit(1);
  }
  const base = fs.readFileSync(indexPath, "utf8");
  const routes = PUBLIC_ROUTES.filter((r) => !r.noindex);
  for (const route of routes) {
    writeRoute(route, base);
  }
  console.log(`[prerender-seo] wrote ${routes.length} SEO shells with crawlable HTML`);
}

main();
