"use strict";

/**
 * Sitemap + robots for Descall (SEO / discovery).
 *
 * Only lists real, indexable marketing URLs. Invite deep-links and
 * announcement query URLs are intentionally excluded from the default index.
 *
 * Endpoints:
 *   GET /robots.txt
 *   GET /sitemap.xml              — sitemap index
 *   GET /sitemap-pages.xml       — static public pages
 *   GET /sitemap.html            — human-readable HTML sitemap
 *   GET /sitemap.xsl
 *   GET /api/sitemap/stats
 *
 * Legacy (empty / diagnostic only — not linked from sitemap index):
 *   GET /sitemap-invites.xml
 *   GET /sitemap-announcements.xml
 */

const express = require("express");

const router = express.Router();

const DEFAULT_ORIGIN = "https://des-call.onrender.com";
const CACHE_SECONDS = 300; // 5 minutes

function getSupabase() {
  try {
    // eslint-disable-next-line global-require
    return require("../db/supabase");
  } catch (err) {
    const e = new Error(err?.message || "supabase unavailable");
    e.code = "SUPABASE_UNAVAILABLE";
    throw e;
  }
}

function siteOrigin(req) {
  const raw =
    process.env.PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    (req.get("x-forwarded-proto") && req.get("x-forwarded-host")
      ? `${req.get("x-forwarded-proto")}://${req.get("x-forwarded-host")}`
      : null) ||
    `${req.protocol}://${req.get("host")}` ||
    DEFAULT_ORIGIN;
  return String(raw).replace(/\/$/, "");
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isoDate(value) {
  try {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function sendXml(res, body) {
  res.set({
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=600`,
    "X-Content-Type-Options": "nosniff",
  });
  return res.status(200).send(body);
}

function sendHtml(res, body) {
  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
  });
  return res.status(200).send(body);
}

/** Canonical public marketing pages — must match client routes in src/site/. */
function staticPages(origin) {
  const now = new Date().toISOString();
  const pages = [
    { path: "/", title: "Descall — Messages, voice & screen share", changefreq: "daily", priority: "1.0" },
    { path: "/download", title: "Download Descall Desktop", changefreq: "weekly", priority: "0.9" },
    { path: "/features", title: "Descall Features", changefreq: "weekly", priority: "0.8" },
    { path: "/faq", title: "Descall FAQ", changefreq: "weekly", priority: "0.7" },
    { path: "/security", title: "Descall Security", changefreq: "monthly", priority: "0.6" },
    { path: "/about", title: "About Descall", changefreq: "monthly", priority: "0.6" },
    { path: "/compare/discord", title: "Descall vs Discord", changefreq: "monthly", priority: "0.7" },
    { path: "/privacy", title: "Descall Privacy Policy", changefreq: "monthly", priority: "0.5" },
    { path: "/terms", title: "Descall Terms of Service", changefreq: "monthly", priority: "0.5" },
    { path: "/contact", title: "Contact Descall", changefreq: "monthly", priority: "0.5" },
    { path: "/sitemap.html", title: "Sitemap", changefreq: "weekly", priority: "0.3" },
  ];

  return pages.map((p) => ({
    loc: p.path === "/" ? `${origin}/` : `${origin}${p.path}`,
    lastmod: now,
    changefreq: p.changefreq,
    priority: p.priority,
    title: p.title,
  }));
}

function urlEntry(page) {
  const imageBlock = page.image
    ? `
    <image:image>
      <image:loc>${xmlEscape(page.image.loc)}</image:loc>
      ${page.image.title ? `<image:title>${xmlEscape(page.image.title)}</image:title>` : ""}
      ${page.image.caption ? `<image:caption>${xmlEscape(page.image.caption)}</image:caption>` : ""}
    </image:image>`
    : "";

  return `  <url>
    <loc>${xmlEscape(page.loc)}</loc>
    <lastmod>${xmlEscape(page.lastmod)}</lastmod>
    <changefreq>${xmlEscape(page.changefreq || "weekly")}</changefreq>
    <priority>${xmlEscape(page.priority || "0.5")}</priority>${imageBlock}
  </url>`;
}

async function fetchActiveInvites(origin, limit = 5000) {
  // Kept for /api/sitemap/stats diagnostics — not published in sitemap index.
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("group_invite_links")
      .select("code, expires_at, created_at, uses, max_uses, group_id, groups(name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      const { data: plain, error: e2 } = await supabase
        .from("group_invite_links")
        .select("code, expires_at, created_at, uses, max_uses, group_id")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (e2) {
        console.warn("[sitemap] invite query failed:", error.message, e2.message);
        return [];
      }
      return filterInvites(plain || [], origin);
    }
    return filterInvites(data || [], origin);
  } catch (err) {
    console.warn("[sitemap] invite fetch error:", err?.message || err);
    return [];
  }
}

function filterInvites(rows, origin) {
  const now = Date.now();
  return rows
    .filter((row) => {
      if (!row?.code) return false;
      if (row.expires_at && new Date(row.expires_at).getTime() < now) return false;
      if (row.max_uses != null && Number(row.uses || 0) >= Number(row.max_uses)) return false;
      return true;
    })
    .map((row) => {
      const group = row.groups || {};
      const name = group.name || "Group invite";
      return {
        loc: `${origin}/?invite=${encodeURIComponent(row.code)}`,
        lastmod: isoDate(row.created_at || row.expires_at),
        changefreq: "daily",
        priority: "0.1",
        title: `Join ${name} on Descall`,
      };
    });
}

async function fetchAnnouncements(_origin, limit = 200) {
  // Announcements have no public landing page — do not invent ?announcement= URLs.
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, created_at, updated_at, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

function buildUrlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>
${entries.map(urlEntry).join("\n")}
</urlset>
`;
}

function buildIndex(origin, children) {
  const now = isoDate();
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children
  .map(
    (c) => `  <sitemap>
    <loc>${xmlEscape(c.loc)}</loc>
    <lastmod>${xmlEscape(c.lastmod || now)}</lastmod>
  </sitemap>`
  )
  .join("\n")}
</sitemapindex>
`;
}

const SITEMAP_XSL = `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  exclude-result-prefixes="s image">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <title>Descall Sitemap</title>
        <style>
          :root { color-scheme: dark; }
          body { font-family: Inter, system-ui, sans-serif; background:#0b0c10; color:#f2f3f5; margin:0; padding:32px; }
          h1 { font-size: 28px; margin: 0 0 8px; }
          p { color:#949ba4; margin: 0 0 24px; }
          table { width:100%; border-collapse: collapse; background:#1e1f22; border-radius:12px; overflow:hidden; }
          th, td { text-align:left; padding:12px 14px; border-bottom:1px solid rgba(255,255,255,.06); font-size:14px; }
          th { color:#b5bac1; font-weight:600; background:#17181c; }
          a { color:#7b89ff; text-decoration:none; }
          a:hover { text-decoration:underline; }
          .meta { font-size:12px; color:#949ba4; }
        </style>
      </head>
      <body>
        <h1>Descall Sitemap</h1>
        <p>XML sitemap rendered for humans. Machine-readable version is served as application/xml.</p>
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
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;

router.get("/sitemap.xsl", (_req, res) => {
  res.set({
    "Content-Type": "application/xslt+xml; charset=utf-8",
    "Cache-Control": "public, max-age=86400",
  });
  res.send(SITEMAP_XSL);
});

router.get("/robots.txt", (req, res) => {
  const origin = siteOrigin(req);
  const body = `# Descall robots.txt
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
Allow: /sitemap.xml
Allow: /sitemap-pages.xml
Allow: /sitemap.html

# Private / ephemeral — do not index
Disallow: /app/
Disallow: /api/
Disallow: /auth/
Disallow: /admin/
Disallow: /media/
Disallow: /groups/
Disallow: /friends/
Disallow: /guilds/
Disallow: /reactions/
Disallow: /lfg/
Disallow: /calls/
Disallow: /riot/
Disallow: /debug/
Disallow: /health
Disallow: /invite/
Disallow: /i/
Disallow: /*?*invite=
Disallow: /*?*announcement=

Sitemap: ${origin}/sitemap.xml
Host: ${origin.replace(/^https?:\/\//, "")}
`;
  res.set({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
  });
  res.send(body);
});

router.get("/sitemap.xml", (req, res) => {
  const origin = siteOrigin(req);
  const now = isoDate();
  return sendXml(
    res,
    buildIndex(origin, [{ loc: `${origin}/sitemap-pages.xml`, lastmod: now }])
  );
});

router.get("/sitemap-pages.xml", (req, res) => {
  const origin = siteOrigin(req);
  return sendXml(res, buildUrlset(staticPages(origin)));
});

// Legacy endpoints: empty urlsets so old crawler bookmarks do not 404,
// but they are no longer linked from the sitemap index.
router.get("/sitemap-invites.xml", (_req, res) => sendXml(res, buildUrlset([])));
router.get("/sitemap-announcements.xml", (_req, res) => sendXml(res, buildUrlset([])));

router.get("/sitemap.html", (req, res) => {
  const origin = siteOrigin(req);
  const pages = staticPages(origin);

  const section = (title, items) => `
    <section>
      <h2>${xmlEscape(title)} <span class="count">${items.length}</span></h2>
      <ul>
        ${items
          .map(
            (p) => `<li>
              <a href="${xmlEscape(p.loc)}">${xmlEscape(p.title || p.loc)}</a>
              <span class="meta">${xmlEscape(p.lastmod)}</span>
            </li>`
          )
          .join("")}
      </ul>
    </section>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Descall Sitemap</title>
  <meta name="description" content="Human-readable sitemap for Descall public marketing pages." />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${xmlEscape(origin)}/sitemap.html" />
  <style>
    :root { color-scheme: dark; --bg:#0b0c10; --card:#1e1f22; --text:#f2f3f5; --muted:#949ba4; --accent:#7b89ff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, system-ui, sans-serif; background:
      radial-gradient(90% 60% at 50% -10%, rgba(88,101,242,.25), transparent 55%), var(--bg);
      color: var(--text); min-height: 100vh; }
    main { max-width: 880px; margin: 0 auto; padding: 48px 20px 80px; }
    h1 { font-size: clamp(28px, 5vw, 40px); margin: 0 0 8px; letter-spacing: -0.03em; }
    .lead { color: var(--muted); margin: 0 0 28px; line-height: 1.5; }
    .links { display:flex; flex-wrap:wrap; gap:10px; margin-bottom: 32px; }
    .links a { background: var(--card); color: var(--accent); padding: 8px 12px; border-radius: 999px;
      text-decoration:none; border:1px solid rgba(255,255,255,.08); font-size: 13px; font-weight: 600; }
    section { background: var(--card); border: 1px solid rgba(255,255,255,.06); border-radius: 16px;
      padding: 18px 20px; margin-bottom: 16px; }
    h2 { margin: 0 0 12px; font-size: 16px; display:flex; align-items:center; gap:8px; }
    .count { background: rgba(88,101,242,.2); color:#c5ccff; font-size:11px; padding:2px 8px; border-radius:999px; }
    ul { list-style:none; margin:0; padding:0; }
    li { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-top:1px solid rgba(255,255,255,.05); }
    li:first-child { border-top:none; }
    a { color: var(--accent); text-decoration:none; word-break: break-all; }
    a:hover { text-decoration: underline; }
    .meta { color: var(--muted); font-size: 12px; white-space: nowrap; }
  </style>
</head>
<body>
  <main>
    <h1>Descall sitemap</h1>
    <p class="lead">Indexable marketing routes only. Machine-readable XML: <a href="/sitemap.xml">/sitemap.xml</a>. Invites and private app UI are excluded.</p>
    <div class="links">
      <a href="/sitemap.xml">Sitemap index</a>
      <a href="/sitemap-pages.xml">Pages XML</a>
      <a href="/robots.txt">robots.txt</a>
    </div>
    ${section("Core pages", pages)}
  </main>
</body>
</html>`;

  return sendHtml(res, html);
});

router.get("/api/sitemap/stats", async (req, res) => {
  const origin = siteOrigin(req);
  const [invites, announcements] = await Promise.all([
    fetchActiveInvites(origin),
    fetchAnnouncements(origin),
  ]);
  res.json({
    origin,
    generatedAt: new Date().toISOString(),
    policy: "pages-only",
    counts: {
      pages: staticPages(origin).length,
      invitesActiveNotIndexed: invites.length,
      announcementsActiveNotIndexed: announcements.length,
    },
    endpoints: [
      "/robots.txt",
      "/sitemap.xml",
      "/sitemap-pages.xml",
      "/sitemap.html",
      "/sitemap.xsl",
    ],
  });
});

module.exports = {
  sitemapRouter: router,
  siteOrigin,
  staticPages,
  fetchActiveInvites,
  fetchAnnouncements,
};
