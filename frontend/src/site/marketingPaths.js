/**
 * Public marketing paths that can boot without the authenticated App bundle.
 */
const MARKETING_EXACT = new Set([
  "/",
  "/features",
  "/faq",
  "/download",
  "/about",
  "/privacy",
  "/terms",
  "/security",
  "/status",
  "/contact",
  "/blog",
  "/discord-alternative",
  "/alternatives",
  "/compare/discord",
  "/apps-like-discord",
  "/discord-replacement",
  "/discord-alternative-turkey",
  "/best-discord-alternative-for-gamers",
  "/discord-alternative-for-communities",
  "/discord-alternative-for-lfg",
  "/discord-alternative-for-voice-chat",
  "/discord-alternative-for-friends",
  "/login",
  "/register",
  "/tr",
  "/tr/features",
  "/tr/download",
  "/tr/faq",
  "/tr/discord-alternative",
  "/tr/compare/discord",
  "/tr/about",
  "/tr/contact",
  "/tr/security",
]);

export function isPublicMarketingPath(pathname = "/") {
  const path = String(pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (MARKETING_EXACT.has(path)) return true;
  if (path.startsWith("/blog/")) return true;
  if (path.startsWith("/compare/")) return true;
  if (path.startsWith("/tr/")) return true;
  return false;
}
