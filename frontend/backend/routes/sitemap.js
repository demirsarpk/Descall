"use strict";

/**
 * Advanced sitemap + robots for Descall (SEO / discovery).
 *
 * Endpoints:
 *   GET /robots.txt
 *   GET /sitemap.xml              — sitemap index
 *   GET /sitemap-pages.xml       — static public pages (+ hreflang)
 *   GET /sitemap-invites.xml     — active group invite deep-links
 *   GET /sitemap-announcements.xml
 *   GET /sitemap.html            — human-readable HTML sitemap
 *   GET /api/sitemap/stats       — JSON diagnostics
 */

const express = require("express");

const router = express.Router();

const DEFAULT_ORIGIN = "https://des-call.onrender.com";
const CACHE_SECONDS = 300; // 5 minutes

function getSupabase() {
  // Lazy require so unit tests / robots can load without env.
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

function staticPages(origin) {
  const now = new Date().toISOString();
  return [
    {
      loc: `${origin}/`,
      lastmod: now,
      changefreq: "daily",
      priority: "1.0",
      title: "Descall — Messages, voice & screen share",
      alternates: [
        { hreflang: "en", href: `${origin}/` },
        { hreflang: "tr", href: `${origin}/?lang=tr` },
        { hreflang: "x-default", href: `${origin}/` },
      ],
    },
    {
      loc: `${origin}/download`,
      lastmod: now,
      changefreq: "weekly",
      priority: "0.9",
      title: "Download Descall Desktop",
      alternates: [
        { hreflang: "en", href: `${origin}/download` },
        { hreflang: "tr", href: `${origin}/download?lang=tr` },
        { hreflang: "x-default", href: `${origin}/download` },
      ],
    },
    {
      loc: `${origin}/sitemap.html`,
      lastmod: now,
      changefreq: "weekly",
      priority: "0.3",
      title: "Sitemap",
    },
  ];
}

function urlEntry(page) {
  const alts = (page.alternates || [])
    .map(
      (a) =>
        `    <xhtml:link rel="alternate" hreflang="${xmlEscape(a.hreflang)}" href="${xmlEscape(a.href)}" />`
    )
    .join("\n");

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
    <priority>${xmlEscape(page.priority || "0.5")}</priority>
${alts}${imageBlock}
  </url>`;
}

async function fetchActiveInvites(origin, limit = 5000) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("group_invite_links")
      .select("code, expires_at, created_at, uses, max_uses, group_id, groups(name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // Fallback without join if FK embed fails
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
      const avatar = group.avatar_url || null;
      return {
        loc: `${origin}/invite/${encodeURIComponent(row.code)}`,
        lastmod: isoDate(row.created_at || row.expires_at),
        changefreq: "daily",
        priority: "0.6",
        title: `Join ${name} on Descall`,
        image: avatar
          ? {
              loc: avatar.startsWith("http") ? avatar : `${origin}${avatar}`,
              title: name,
              caption: `Invite to ${name}`,
            }
          : null,
      };
    });
}

async function fetchAnnouncements(origin, limit = 200) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, created_at, updated_at, is_active, is_pinned")
      .eq("is_active", true)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // Older schemas may lack is_active
      const { data: plain } = await supabase
        .from("announcements")
        .select("id, title, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      return (plain || []).map((a) => announcementEntry(a, origin));
    }
    return (data || []).map((a) => announcementEntry(a, origin));
  } catch (err) {
    console.warn("[sitemap] announcements fetch error:", err?.message || err);
    return [];
  }
}

function announcementEntry(a, origin) {
  return {
    loc: `${origin}/?announcement=${encodeURIComponent(a.id)}`,
    lastmod: isoDate(a.updated_at || a.created_at),
    changefreq: "weekly",
    priority: a.is_pinned ? "0.7" : "0.4",
    title: a.title || "Announcement",
  };
}

function buildUrlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml"
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
Allow: /invite/
Allow: /i/
Allow: /sitemap.xml
Allow: /sitemap-pages.xml
Allow: /sitemap-invites.xml
Allow: /sitemap-announcements.xml
Allow: /sitemap.html

# App / API surfaces — no indexing
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
    buildIndex(origin, [
      { loc: `${origin}/sitemap-pages.xml`, lastmod: now },
      { loc: `${origin}/sitemap-invites.xml`, lastmod: now },
      { loc: `${origin}/sitemap-announcements.xml`, lastmod: now },
    ])
  );
});

router.get("/sitemap-pages.xml", (req, res) => {
  const origin = siteOrigin(req);
  return sendXml(res, buildUrlset(staticPages(origin)));
});

router.get("/sitemap-invites.xml", async (req, res) => {
  const origin = siteOrigin(req);
  const invites = await fetchActiveInvites(origin);
  return sendXml(res, buildUrlset(invites));
});

router.get("/sitemap-announcements.xml", async (req, res) => {
  const origin = siteOrigin(req);
  const items = await fetchAnnouncements(origin);
  return sendXml(res, buildUrlset(items));
});

router.get("/sitemap.html", async (req, res) => {
  const origin = siteOrigin(req);
  const pages = staticPages(origin);
  const [invites, announcements] = await Promise.all([
    fetchActiveInvites(origin, 200),
    fetchAnnouncements(origin, 50),
  ]);

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
  <meta name="description" content="Human-readable sitemap for Descall — public pages, invites, and announcements." />
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
    <p class="lead">Public routes indexed for search engines and humans. Machine-readable XML lives at <a href="/sitemap.xml">/sitemap.xml</a>.</p>
    <div class="links">
      <a href="/sitemap.xml">Sitemap index</a>
      <a href="/sitemap-pages.xml">Pages XML</a>
      <a href="/sitemap-invites.xml">Invites XML</a>
      <a href="/sitemap-announcements.xml">Announcements XML</a>
      <a href="/robots.txt">robots.txt</a>
    </div>
    ${section("Core pages", pages)}
    ${section("Active group invites", invites)}
    ${section("Announcements", announcements)}
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
    counts: {
      pages: staticPages(origin).length,
      invites: invites.length,
      announcements: announcements.length,
    },
    endpoints: [
      "/robots.txt",
      "/sitemap.xml",
      "/sitemap-pages.xml",
      "/sitemap-invites.xml",
      "/sitemap-announcements.xml",
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
