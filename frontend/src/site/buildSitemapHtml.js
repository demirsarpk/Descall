/**
 * Shared human-readable sitemap HTML (Vercel static + Render API).
 * Designed to match marketing brand atmosphere — not a bare <ul>.
 */

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function humanizePath(path) {
  if (!path || path === "/") return "Home";
  const leaf = path.split("/").filter(Boolean).pop() || "Page";
  return leaf
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sitemapCardLabel(route) {
  if (route.path === "/") return "Home";
  if (route.sitemapLabel) return route.sitemapLabel;
  if (route.h1 && route.h1.length <= 72) return route.h1;
  // Prefer clean path labels over SEO title spam
  return humanizePath(route.path);
}

export function groupSitemapRoutes(routes) {
  const buckets = {
    product: { title: "Product", items: [] },
    alternatives: { title: "Discord alternatives", items: [] },
    blog: { title: "Guides & blog", items: [] },
    company: { title: "Company & legal", items: [] },
  };

  for (const route of routes) {
    const p = route.path || "/";
    if (p.startsWith("/blog")) {
      buckets.blog.items.push(route);
    } else if (
      p.includes("discord") ||
      p.includes("alternative") ||
      p.startsWith("/compare") ||
      p === "/apps-like-discord" ||
      p === "/alternatives"
    ) {
      buckets.alternatives.items.push(route);
    } else if (
      ["/", "/download", "/features", "/faq"].includes(p)
    ) {
      buckets.product.items.push(route);
    } else {
      buckets.company.items.push(route);
    }
  }

  return Object.values(buckets).filter((b) => b.items.length > 0);
}

/**
 * @param {{ origin: string, routes: Array<{path:string,title?:string,description?:string,h1?:string,sitemapLabel?:string}>, lang?: string }} opts
 */
export function buildHumanSitemapHtml({ origin, routes, lang = "en" }) {
  const site = String(origin || "https://descall.com").replace(/\/$/, "");
  const indexable = (routes || []).filter((r) => !r.noindex);
  const groups = groupSitemapRoutes(indexable);

  const sections = groups
    .map((group) => {
      const cards = group.items
        .map((route) => {
          const href = route.path === "/" ? `${site}/` : `${site}${route.path}`;
          const label = sitemapCardLabel(route);
          const pathLabel = route.path === "/" ? "/" : route.path;
          const desc = route.description || "";
          return `<a class="card" href="${xmlEscape(href)}">
  <span class="card-title">${xmlEscape(label)}</span>
  <span class="card-path">${xmlEscape(pathLabel)}</span>
  ${desc ? `<span class="card-desc">${xmlEscape(desc)}</span>` : ""}
</a>`;
        })
        .join("\n");
      return `<section class="section">
  <div class="section-head">
    <h2>${xmlEscape(group.title)}</h2>
    <span class="count">${group.items.length}</span>
  </div>
  <div class="grid">
${cards}
  </div>
</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="${xmlEscape(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sitemap — Descall</title>
  <meta name="description" content="Browse every public Descall page — product, Discord alternative guides, blog, and legal." />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${xmlEscape(site)}/sitemap.html" />
  <link rel="icon" href="/icon.png" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #0b0c10;
      --surface: rgba(30, 31, 34, 0.78);
      --text: #f2f3f5;
      --muted: #949ba4;
      --accent: #8b9cff;
      --accent-2: #3dd68c;
      --border: rgba(255,255,255,0.08);
      --font-display: "Avenir Next", "Segoe UI", sans-serif;
      --font-body: "Segoe UI", system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font-body);
      color: var(--text);
      background: var(--bg);
      line-height: 1.5;
    }
    .bg {
      position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden;
    }
    .orb {
      position: absolute; border-radius: 50%; filter: blur(72px); opacity: 0.42;
    }
    .orb-a {
      width: 52vw; height: 52vw; top: -20%; left: 18%;
      background: rgba(88, 101, 242, 0.38);
    }
    .orb-b {
      width: 34vw; height: 34vw; right: -10%; bottom: 8%;
      background: rgba(61, 214, 140, 0.16);
    }
    .grid-bg {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse at 50% 18%, #000 18%, transparent 72%);
    }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 72px; }
    header.top {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      margin-bottom: 36px; flex-wrap: wrap;
    }
    .brand {
      display: inline-flex; align-items: center; gap: 10px;
      color: var(--text); text-decoration: none; font-family: var(--font-display);
      font-weight: 700; font-size: 1.15rem; letter-spacing: -0.02em;
    }
    .brand img { width: 32px; height: 32px; border-radius: 8px; }
    .top-links { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 12px; border-radius: 999px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      color: var(--accent); text-decoration: none;
      font-size: 13px; font-weight: 600;
    }
    .chip:hover { background: rgba(139,156,255,0.12); }
    .hero { margin-bottom: 28px; }
    .hero h1 {
      font-family: var(--font-display);
      font-size: clamp(2rem, 5vw, 2.75rem);
      letter-spacing: -0.03em;
      margin: 0 0 10px;
      line-height: 1.1;
    }
    .hero p {
      margin: 0; max-width: 54ch;
      color: var(--muted); font-size: 1.05rem;
    }
    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 18px 18px 16px;
      margin-bottom: 16px;
      backdrop-filter: blur(16px);
    }
    .section-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; margin-bottom: 14px;
    }
    .section-head h2 {
      margin: 0; font-family: var(--font-display);
      font-size: 1.05rem; font-weight: 650; letter-spacing: -0.02em;
    }
    .count {
      font-size: 11px; font-weight: 700;
      padding: 3px 9px; border-radius: 999px;
      background: rgba(88,101,242,0.22); color: #c9d0ff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 10px;
    }
    .card {
      display: flex; flex-direction: column; gap: 4px;
      padding: 14px 14px 13px;
      border-radius: 14px;
      text-decoration: none; color: inherit;
      background: rgba(0,0,0,0.22);
      border: 1px solid rgba(255,255,255,0.06);
      transition: border-color .18s ease, transform .18s ease, background .18s ease;
      min-height: 104px;
    }
    .card:hover {
      border-color: rgba(139,156,255,0.45);
      background: rgba(88,101,242,0.12);
      transform: translateY(-1px);
    }
    .card-title {
      font-family: var(--font-display);
      font-weight: 650; font-size: 0.98rem;
      letter-spacing: -0.02em; color: #fff;
    }
    .card-path {
      font-size: 12px; color: var(--accent); font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .card-desc {
      margin-top: 4px;
      font-size: 12.5px; color: var(--muted);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden;
    }
    footer.foot {
      margin-top: 28px; color: var(--muted); font-size: 13px;
      display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center;
    }
    footer.foot a { color: var(--accent); text-decoration: none; font-weight: 600; }
    footer.foot a:hover { text-decoration: underline; }
    @media (max-width: 560px) {
      .wrap { padding: 20px 14px 56px; }
      .card { min-height: 0; }
    }
  </style>
</head>
<body>
  <div class="bg" aria-hidden="true">
    <div class="orb orb-a"></div>
    <div class="orb orb-b"></div>
    <div class="grid-bg"></div>
  </div>
  <div class="wrap">
    <header class="top">
      <a class="brand" href="${xmlEscape(site)}/">
        <img src="/icon.png" width="32" height="32" alt="" />
        <span>Descall</span>
      </a>
      <div class="top-links">
        <a class="chip" href="${xmlEscape(site)}/">Home</a>
        <a class="chip" href="/sitemap.xml">XML index</a>
        <a class="chip" href="/sitemap-pages.xml">Pages XML</a>
        <a class="chip" href="/robots.txt">robots.txt</a>
      </div>
    </header>

    <div class="hero">
      <h1>Sitemap</h1>
      <p>Every public Descall page in one place — product, Discord alternative guides, blog, and legal. Private app routes are intentionally excluded.</p>
    </div>

${sections}

    <footer class="foot">
      <span>${indexable.length} public pages</span>
      <a href="/sitemap.xml">Machine-readable sitemap</a>
      <a href="${xmlEscape(site)}/download">Download Descall</a>
      <a href="${xmlEscape(site)}/discord-alternative">Discord alternative</a>
    </footer>
  </div>
</body>
</html>
`;
}

export const SITEMAP_XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="s">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Descall Sitemap (XML)</title>
        <style>
          :root { color-scheme: dark; }
          body { margin:0; font-family:system-ui,"Segoe UI",sans-serif; background:#0b0c10; color:#f2f3f5;
            background-image: radial-gradient(80% 50% at 50% -10%, rgba(88,101,242,.28), transparent 55%);
            padding: 32px 20px 64px; }
          .wrap { max-width: 960px; margin: 0 auto; }
          h1 { font-family:"Avenir Next",system-ui,sans-serif; font-size: clamp(28px, 5vw, 40px); letter-spacing:-.03em; margin:0 0 8px; }
          p { color:#949ba4; margin:0 0 22px; }
          .chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:22px; }
          .chips a { color:#8b9cff; text-decoration:none; font-weight:600; font-size:13px;
            padding:8px 12px; border-radius:999px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); }
          table { width:100%; border-collapse:collapse; background:rgba(30,31,34,.9); border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; }
          th, td { text-align:left; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.06); font-size:14px; }
          th { color:#b5bac1; font-weight:600; background:#17181c; font-family:Outfit,sans-serif; }
          a { color:#8b9cff; text-decoration:none; word-break:break-all; }
          a:hover { text-decoration:underline; }
          .meta { font-size:12px; color:#949ba4; white-space:nowrap; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Descall XML sitemap</h1>
          <p>Styled view of the machine-readable sitemap. Crawlers still receive raw XML.</p>
          <div class="chips">
            <a href="/sitemap.html">Human sitemap</a>
            <a href="/sitemap.xml">XML index</a>
            <a href="/sitemap-pages.xml">Pages XML</a>
            <a href="/">Home</a>
          </div>
          <xsl:choose>
            <xsl:when test="s:sitemapindex">
              <table>
                <tr><th>Sitemap</th><th>Last modified</th></tr>
                <xsl:for-each select="s:sitemapindex/s:sitemap">
                  <tr>
                    <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                    <td class="meta"><xsl:value-of select="s:lastmod"/></td>
                  </tr>
                </xsl:for-each>
              </table>
            </xsl:when>
            <xsl:otherwise>
              <table>
                <tr><th>URL</th><th>Priority</th><th>Change</th><th>Last modified</th></tr>
                <xsl:for-each select="s:urlset/s:url">
                  <tr>
                    <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                    <td class="meta"><xsl:value-of select="s:priority"/></td>
                    <td class="meta"><xsl:value-of select="s:changefreq"/></td>
                    <td class="meta"><xsl:value-of select="s:lastmod"/></td>
                  </tr>
                </xsl:for-each>
              </table>
            </xsl:otherwise>
          </xsl:choose>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;
