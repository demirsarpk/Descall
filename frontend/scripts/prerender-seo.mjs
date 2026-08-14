/**
 * Post-build SEO HTML shells for crawlers.
 * - Route meta from src/site/seoConfig.js (single source of truth)
 * - Injects crawlable <main> into #root so HTML responses aren't empty SPA shells
 * - Strips boot splash "Loading" chrome from SEO shells (bots must not see Loading)
 * - Injects route-specific JSON-LD (FAQPage, SoftwareApplication, Organization, Article)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const SITE = "https://descall.com";
const OG = `${SITE}/og-default.png`;

const { PUBLIC_ROUTES } = await import(pathToFileURL(path.join(root, "src/site/seoConfig.js")).href);
const { NICHE_LANDINGS } = await import(pathToFileURL(path.join(root, "src/site/seo/nicheLandings.js")).href);
const { BLOG_POSTS } = await import(
  pathToFileURL(path.join(root, "src/site/content/discordSeoContent.js")).href
);
const { BLOG_BODIES } = await import(pathToFileURL(path.join(root, "src/site/seo/blogBodies.js")).href);
const { corePageBody } = await import(pathToFileURL(path.join(root, "src/site/seo/corePageBodies.js")).href);
const { FAQ_ITEMS } = await import(pathToFileURL(path.join(root, "src/site/faqData.js")).href);
const {
  buildOrganizationLd,
  buildWebSiteLd,
  buildSoftwareApplicationLd,
  buildFaqLd,
  buildArticleLd,
  buildBreadcrumbLd,
} = await import(pathToFileURL(path.join(root, "src/site/jsonLdBuilders.js")).href);

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripBootSplash(html) {
  // Nested divs — remove the whole splash block + its dismiss script.
  return html
    .replace(
      /<div id="boot-splash"[\s\S]*?<\/div>\s*<script>\s*\(function \(\) \{\s*var el = document\.getElementById\("boot-splash"\)[\s\S]*?<\/script>\s*/i,
      ""
    )
    .replace(/<div id="boot-splash"[\s\S]*?data-shown-at=""[\s\S]*?<\/script>\s*/i, "");
}

function crawlBody(route) {
  const core = corePageBody(route.path);
  if (core) return core;

  const niche = NICHE_LANDINGS[route.path];
  if (niche) {
    const sections = niche.sections
      .map((s) => `<h2>${escapeHtml(s.h)}</h2><p>${escapeHtml(s.p)}</p>`)
      .join("\n");
    const links = niche.related
      .map((l) => `<li><a href="${escapeHtml(l.to)}">${escapeHtml(l.label)}</a></li>`)
      .join("");
    const faq =
      Array.isArray(niche.faqs) && niche.faqs.length
        ? `<h2>FAQ</h2>${niche.faqs
            .map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`)
            .join("\n")}`
        : "";
    return `
<main>
  <h1>${escapeHtml(niche.h1)}</h1>
  <p>${escapeHtml(niche.lead)}</p>
  <p><a href="/download">Download Descall</a> · <a href="/discord-alternative">Discord alternative</a></p>
  <h2>${escapeHtml(niche.answerTitle)}</h2>
  <p>${escapeHtml(niche.answer)}</p>
  <ul>${niche.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
  ${sections}
  ${faq}
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

  if (route.path === "/blog") {
    const posts = BLOG_POSTS.map(
      (p) =>
        `<li><a href="/blog/${escapeHtml(p.slug)}"><strong>${escapeHtml(p.title)}</strong></a> — ${escapeHtml(p.description)}</li>`
    ).join("");
    return `
<main>
  <h1>Descall Blog</h1>
  <p>Guides on Discord alternatives, servers, voice chat, and gaming LFG.</p>
  <ul>${posts}</ul>
  <nav aria-label="Descall">
    <a href="/">Home</a>
    <a href="/discord-alternative">Discord alternative</a>
    <a href="/features">Features</a>
    <a href="/download">Download</a>
  </nav>
</main>`;
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
    <a href="/about">About</a>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/contact">Contact</a>
  </nav>
</main>`;
}

function jsonLdForRoute(route) {
  const graphs = [buildWebSiteLd(), buildOrganizationLd()];

  if (route.path === "/" || route.path === "/features" || route.path === "/download") {
    graphs.push(buildSoftwareApplicationLd());
  }

  if (route.path === "/faq") {
    graphs.push(buildFaqLd(FAQ_ITEMS));
  }

  const niche = NICHE_LANDINGS[route.path];
  if (niche?.faqs?.length) {
    graphs.push(buildFaqLd(niche.faqs));
  }

  if (route.path.startsWith("/blog/") && route.path !== "/blog") {
    const slug = route.path.replace("/blog/", "");
    const post = BLOG_POSTS.find((p) => p.slug === slug);
    if (post && typeof buildArticleLd === "function") {
      graphs.push(
        buildArticleLd({
          title: post.title,
          description: post.description,
          path: route.path,
          datePublished: post.date || post.publishedAt || "2026-01-01",
          dateModified: post.updatedAt || post.date || "2026-01-01",
        })
      );
    }
    graphs.push(
      buildBreadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Blog", path: "/blog" },
        { name: post?.title || slug, path: route.path },
      ])
    );
  }

  return graphs;
}

function stripStaleHeadSeo(html) {
  return html
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="keywords"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="alternate"[^>]*hreflang="[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");
}

function injectMeta(html, route) {
  const url = `${SITE}${route.path === "/" ? "/" : route.path}`;
  const title = escapeHtml(route.title);
  const desc = escapeHtml(route.description);
  const keywords = route.keywords ? escapeHtml(route.keywords) : "";
  const lang = route.lang || "en";
  const ogType = route.ogType || "website";

  let out = stripBootSplash(html);
  out = stripStaleHeadSeo(out);
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

  const ldScripts = jsonLdForRoute(route)
    .map(
      (data) =>
        `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`
    )
    .join("\n    ");

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
    ldScripts,
  ]
    .filter(Boolean)
    .join("\n    ");

  out = out.replace(/<\/title>/i, `</title>\n    ${metaBlock}`);

  const body = crawlBody(route);
  if (/<div id="seo-static"><\/div>/i.test(out)) {
    out = out.replace(
      /<div id="seo-static"><\/div>/i,
      `<div id="seo-static" aria-hidden="false">${body}</div>`
    );
  } else if (/<div id="seo-static"[^>]*>[\s\S]*?<\/div>/i.test(out)) {
    out = out.replace(
      /<div id="seo-static"[^>]*>[\s\S]*?<\/div>/i,
      `<div id="seo-static" aria-hidden="false">${body}</div>`
    );
  } else if (/<div id="root"><\/div>/i.test(out)) {
    // Backward compatible fallback for older templates
    out = out.replace(
      /<div id="root"><\/div>/i,
      `<div id="seo-static" aria-hidden="false">${body}</div><div id="root"></div>`
    );
  } else if (/<div id="root">[\s\S]*?<\/div>/i.test(out)) {
    out = out.replace(
      /<div id="root">[\s\S]*?<\/div>/i,
      `<div id="seo-static" aria-hidden="false">${body}</div><div id="root"></div>`
    );
  }

  const noscript = `<noscript>
      <nav aria-label="Descall">
        <a href="/">Descall</a>
        <a href="/discord-alternative">Discord alternative</a>
        <a href="/features">Features</a>
        <a href="/download">Download</a>
        <a href="/faq">FAQ</a>
        <a href="/about">About</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
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
