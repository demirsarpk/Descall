/**
 * Shared sitemap catalog — single source for Vercel static + Render API.
 * Splits indexable PUBLIC_ROUTES into crawlable child sitemap tables.
 */

import { PUBLIC_ROUTES, DEFAULT_ORIGIN } from "./seoConfig.js";

export const SITE = DEFAULT_ORIGIN;

/** @typedef {'core'|'niches'|'blog'|'company'} SitemapTableId */

/**
 * Child sitemap tables linked from /sitemap.xml.
 * Order = crawl priority for discovery.
 */
export const SITEMAP_TABLES = [
  {
    id: "core",
    file: "sitemap-core.xml",
    title: "Product & conversion",
    description: "Home, download, features, FAQ — primary conversion surfaces.",
  },
  {
    id: "niches",
    file: "sitemap-niches.xml",
    title: "Discord alternatives & niches",
    description: "High-intent Discord alternative, compare, LFG, voice, Turkey hubs.",
  },
  {
    id: "blog",
    file: "sitemap-blog.xml",
    title: "Guides & blog",
    description: "Blog index and long-form Discord alternative guides.",
  },
  {
    id: "company",
    file: "sitemap-company.xml",
    title: "Company & legal",
    description: "About, contact, security, privacy, terms, human sitemap.",
  },
];

/** Highest-value URLs to push first when requesting indexing (daily quota). */
export const INDEXING_PRIORITY_PATHS = [
  "/",
  "/discord-alternative",
  "/alternatives",
  "/compare/discord",
  "/download",
  "/best-discord-alternative-for-gamers",
  "/discord-alternative-for-lfg",
  "/apps-like-discord",
  "/discord-alternative-turkey",
  "/discord-replacement",
  "/discord-alternative-for-voice-chat",
  "/discord-alternative-for-friends",
  "/discord-alternative-for-communities",
  "/features",
  "/blog",
  "/blog/discord-vs-descall",
  "/blog/best-discord-alternatives-2026",
  "/blog/apps-like-discord",
  "/blog/discord-competitors",
  "/blog/best-discord-alternative-for-lfg",
  "/faq",
  "/blog/leave-nitro-keep-voice-chat",
  "/blog/discord-alternative-for-communities-guide",
  "/blog/voice-chat-alternative-to-discord",
  "/blog/migrate-from-discord-to-descall",
  "/about",
  "/contact",
  "/security",
  "/status",
  "/tr",
  "/tr/discord-alternative",
  "/tr/compare/discord",
  "/tr/download",
];

function tableIdForPath(path) {
  const p = path || "/";
  if (p.startsWith("/blog")) return "blog";
  if (p === "/tr" || p.startsWith("/tr/")) return "niches";
  if (p === "/status") return "company";
  if (
    p.includes("discord") ||
    p.includes("alternative") ||
    p.startsWith("/compare") ||
    p === "/apps-like-discord" ||
    p === "/alternatives"
  ) {
    return "niches";
  }
  if (["/", "/download", "/features", "/faq"].includes(p)) return "core";
  return "company";
}

export function indexableRoutes() {
  return PUBLIC_ROUTES.filter((r) => !r.noindex);
}

export function absoluteLoc(path, origin = SITE) {
  const base = String(origin || SITE).replace(/\/$/, "");
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function routesForTable(tableId) {
  return indexableRoutes().filter((r) => tableIdForPath(r.path) === tableId);
}

export function allSitemapEntries(origin = SITE, now = new Date().toISOString()) {
  const entries = indexableRoutes().map((r) => ({
    path: r.path,
    loc: absoluteLoc(r.path, origin),
    lastmod: now,
    changefreq: r.changefreq || "weekly",
    priority: r.priority || "0.5",
    title: r.title,
    description: r.description || "",
    tableId: tableIdForPath(r.path),
  }));

  // Human sitemap page
  entries.push({
    path: "/sitemap.html",
    loc: absoluteLoc("/sitemap.html", origin),
    lastmod: now,
    changefreq: "weekly",
    priority: "0.3",
    title: "Sitemap",
    description: "Human-readable sitemap of public Descall pages.",
    tableId: "company",
  });

  return entries;
}

export function entriesForTable(tableId, origin = SITE, now = new Date().toISOString()) {
  return allSitemapEntries(origin, now).filter((e) => e.tableId === tableId);
}

/** Deduped absolute URLs ordered by INDEXING_PRIORITY_PATHS then remaining. */
export function indexingUrlQueue(origin = SITE) {
  const all = allSitemapEntries(origin);
  const byPath = new Map(all.map((e) => [e.path, e.loc]));
  const seen = new Set();
  const out = [];

  for (const path of INDEXING_PRIORITY_PATHS) {
    const loc = byPath.get(path);
    if (!loc || seen.has(loc)) continue;
    seen.add(loc);
    out.push(loc);
  }
  for (const entry of all) {
    if (seen.has(entry.loc)) continue;
    seen.add(entry.loc);
    out.push(entry.loc);
  }
  return out;
}
