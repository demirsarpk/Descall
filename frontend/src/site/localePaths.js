/**
 * Locale path helpers for /tr/* marketing URLs.
 * EN remains at unprefixed paths; TR mirrors key pages under /tr.
 */

export const TR_LOCALE_PREFIX = "/tr";

/** Paths that have a dedicated /tr/* mirror (besides turkey landing). */
export const TR_MIRROR_PATHS = [
  "/",
  "/features",
  "/download",
  "/faq",
  "/compare/discord",
  "/about",
  "/contact",
  "/security",
];

export function stripLocalePrefix(pathname = "/") {
  const p = String(pathname || "/").split("?")[0] || "/";
  if (p === "/tr" || p === "/tr/") return "/";
  if (p.startsWith("/tr/")) {
    const rest = p.slice(3) || "/";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return p.replace(/\/+$/, "") || "/";
}

export function withTrPrefix(pathname = "/") {
  const base = stripLocalePrefix(pathname);
  if (base === "/") return "/tr";
  return `/tr${base}`;
}

export function isTrPath(pathname = "/") {
  const p = String(pathname || "/").split("?")[0] || "/";
  return p === "/tr" || p.startsWith("/tr/");
}

export function enPathForHreflang(pathname = "/") {
  const en = stripLocalePrefix(pathname);
  if (en === "/discord-alternative-turkey") return "/discord-alternative";
  return en;
}

export function trPathForHreflang(pathname = "/") {
  const en = stripLocalePrefix(pathname);
  if (en === "/discord-alternative" || en === "/discord-alternative-turkey") {
    return "/discord-alternative-turkey";
  }
  if (TR_MIRROR_PATHS.includes(en) || en === "/") return withTrPrefix(en);
  // Niche pages: fall back to turkey landing for TR alternate
  if (en.includes("discord") || en.startsWith("/blog") || en === "/alternatives") {
    return "/discord-alternative-turkey";
  }
  return withTrPrefix("/");
}
