"use strict";

/**
 * Sitemap + robots for Descall (SEO / discovery).
 *
 * Only lists real, indexable marketing URLs. Invite deep-links and
 * announcement query URLs are intentionally excluded from the default index.
 *
 * Endpoints:
 *   GET /robots.txt
 *   GET /sitemap.xml              — sitemap index (child tables)
 *   GET /sitemap-core.xml
 *   GET /sitemap-niches.xml
 *   GET /sitemap-blog.xml
 *   GET /sitemap-company.xml
 *   GET /sitemap-pages.xml       — full combined urlset (compat)
 *   GET /sitemap.html            — human-readable HTML sitemap
 *   GET /sitemap.xsl
 *   GET /api/sitemap/stats
 *
 * Legacy (empty / diagnostic only — not linked from sitemap index):
 *   GET /sitemap-invites.xml
 *   GET /sitemap-announcements.xml
 */

const path = require("path");
const { pathToFileURL } = require("url");
const express = require("express");

const router = express.Router();

let _sitemapHtmlModulePromise = null;
function loadSitemapHtmlModule() {
  if (!_sitemapHtmlModulePromise) {
    const modPath = path.join(__dirname, "../../src/site/buildSitemapHtml.js");
    _sitemapHtmlModulePromise = import(pathToFileURL(modPath).href);
  }
  return _sitemapHtmlModulePromise;
}

let _sitemapCatalogPromise = null;
function loadSitemapCatalog() {
  if (!_sitemapCatalogPromise) {
    const modPath = path.join(__dirname, "../../src/site/sitemapCatalog.js");
    _sitemapCatalogPromise = import(pathToFileURL(modPath).href);
  }
  return _sitemapCatalogPromise;
}

// Canonical public host for ALL sitemap/robots output.
// Never emit request Host / onrender / http — Search Console must see one HTTPS origin.
const DEFAULT_ORIGIN = "https://descall.com";
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

/**
 * Always return the canonical production origin for SEO documents.
 * Env overrides are accepted only when they are https://descall.com
 * (prevents accidental http:// or onrender.com sitemap pollution).
 */
function siteOrigin(_req) {
  const candidates = [process.env.PUBLIC_APP_URL, process.env.SITE_URL, DEFAULT_ORIGIN];
  for (const raw of candidates) {
    if (!raw) continue;
    const normalized = String(raw).trim().replace(/\/$/, "");
    if (/^https:\/\/descall\.com$/i.test(normalized)) return "https://descall.com";
  }
  return DEFAULT_ORIGIN;
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

/**
 * Canonical public marketing pages from shared sitemapCatalog.
 * Sync wrapper kept for callers that expect a plain array (stats / html).
 */
function staticPages(origin) {
  // Fallback list if ESM catalog fails to load in sync context — prefer asyncCatalogPages.
  const now = new Date().toISOString();
  return [
    { path: "/", title: "Descall", changefreq: "daily", priority: "1.0" },
    { path: "/download", title: "Download Descall", changefreq: "weekly", priority: "0.9" },
    { path: "/sitemap.html", title: "Sitemap", changefreq: "weekly", priority: "0.3" },
  ].map((p) => ({
    loc: p.path === "/" ? `${origin}/` : `${origin}${p.path}`,
    lastmod: now,
    changefreq: p.changefreq,
    priority: p.priority,
    title: p.title,
  }));
}

async function catalogEntries(origin, tableId = null) {
  const catalog = await loadSitemapCatalog();
  const now = new Date().toISOString();
  const entries = tableId
    ? catalog.entriesForTable(tableId, origin, now)
    : catalog.allSitemapEntries(origin, now);
  return entries.map((e) => ({
    loc: e.loc,
    lastmod: e.lastmod,
    changefreq: e.changefreq,
    priority: e.priority,
    title: e.title,
    path: e.path,
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

router.get("/sitemap.xsl", async (_req, res) => {
  try {
    const { SITEMAP_XSL } = await loadSitemapHtmlModule();
    res.set({
      "Content-Type": "application/xslt+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    });
    return res.send(SITEMAP_XSL);
  } catch (err) {
    return res.status(500).type("text/plain").send(err?.message || "xsl unavailable");
  }
});

router.get("/robots.txt", async (req, res) => {
  const origin = siteOrigin(req);
  let childAllows = "";
  try {
    const { SITEMAP_TABLES } = await loadSitemapCatalog();
    childAllows = SITEMAP_TABLES.map((t) => `Allow: /${t.file}`).join("\n") + "\n";
  } catch {
    childAllows = "";
  }
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
${childAllows}Allow: /sitemap.html

# Private / ephemeral — do not index
Disallow: /app/
Disallow: /api/
Disallow: /auth/
Disallow: /admin/
Disallow: /media/
Disallow: /groups/
Disallow: /friends/
Disallow: /servers/
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

router.get("/sitemap.xml", async (req, res) => {
  try {
    const origin = siteOrigin(req);
    const now = isoDate();
    const { SITEMAP_TABLES } = await loadSitemapCatalog();
    return sendXml(
      res,
      buildIndex(
        origin,
        SITEMAP_TABLES.map((t) => ({ loc: `${origin}/${t.file}`, lastmod: now }))
      )
    );
  } catch (err) {
    return res.status(500).type("text/plain").send(err?.message || "sitemap index unavailable");
  }
});

router.get("/sitemap-pages.xml", async (req, res) => {
  try {
    const origin = siteOrigin(req);
    return sendXml(res, buildUrlset(await catalogEntries(origin)));
  } catch (err) {
    return res.status(500).type("text/plain").send(err?.message || "sitemap pages unavailable");
  }
});

for (const tableId of ["core", "niches", "blog", "company"]) {
  router.get(`/sitemap-${tableId}.xml`, async (req, res) => {
    try {
      const origin = siteOrigin(req);
      return sendXml(res, buildUrlset(await catalogEntries(origin, tableId)));
    } catch (err) {
      return res.status(500).type("text/plain").send(err?.message || "sitemap table unavailable");
    }
  });
}

// Legacy endpoints: empty urlsets so old crawler bookmarks do not 404,
// but they are no longer linked from the sitemap index.
router.get("/sitemap-invites.xml", (_req, res) => sendXml(res, buildUrlset([])));
router.get("/sitemap-announcements.xml", (_req, res) => sendXml(res, buildUrlset([])));

router.get("/sitemap.html", async (req, res) => {
  try {
    const origin = siteOrigin(req);
    const pages = (await catalogEntries(origin)).filter(
      (p) => !String(p.loc || "").endsWith("/sitemap.html")
    );
    const { buildHumanSitemapHtml } = await loadSitemapHtmlModule();
    const routes = pages.map((p) => {
      let pathname = p.path || "/";
      if (!pathname || pathname === "/") {
        try {
          pathname = new URL(p.loc).pathname || "/";
        } catch {
          pathname = "/";
        }
      }
      return {
        path: pathname,
        title: p.title,
        description: "",
      };
    });
    const html = buildHumanSitemapHtml({ origin, routes, lang: "en" });
    return sendHtml(res, html);
  } catch (err) {
    return res.status(500).type("text/plain").send(err?.message || "sitemap html unavailable");
  }
});

router.get("/api/sitemap/stats", async (req, res) => {
  const origin = siteOrigin(req);
  const [invites, announcements, pages, catalog] = await Promise.all([
    fetchActiveInvites(origin),
    fetchAnnouncements(origin),
    catalogEntries(origin),
    loadSitemapCatalog().catch(() => null),
  ]);
  res.json({
    origin,
    generatedAt: new Date().toISOString(),
    policy: "multi-table-pages-only",
    counts: {
      pages: pages.length,
      invitesActiveNotIndexed: invites.length,
      announcementsActiveNotIndexed: announcements.length,
    },
    tables: (catalog?.SITEMAP_TABLES || []).map((t) => t.file),
    endpoints: [
      "/robots.txt",
      "/sitemap.xml",
      "/sitemap-core.xml",
      "/sitemap-niches.xml",
      "/sitemap-blog.xml",
      "/sitemap-company.xml",
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
