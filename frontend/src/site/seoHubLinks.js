/**
 * Canonical internal-link hub for SEO crawl depth + topical clustering.
 * Used by React pages, prerender bodies, and footer “Explore” blocks.
 */
export const SEO_PILLARS = [
  { to: "/discord-alternative", label: "Discord alternative" },
  { to: "/compare/discord", label: "Descall vs Discord" },
  { to: "/features", label: "Features" },
  { to: "/download", label: "Download" },
  { to: "/faq", label: "FAQ" },
];

export const SEO_NICHES = [
  { to: "/discord-alternative-for-communities", label: "Communities" },
  { to: "/discord-alternative-for-lfg", label: "Valorant LFG" },
  { to: "/discord-alternative-for-voice-chat", label: "Voice chat" },
  { to: "/discord-alternative-for-friends", label: "Friends" },
  { to: "/best-discord-alternative-for-gamers", label: "Gamers" },
  { to: "/apps-like-discord", label: "Apps like Discord" },
  { to: "/discord-replacement", label: "Discord replacement" },
  { to: "/discord-alternative-turkey", label: "Türkiye" },
  { to: "/alternatives", label: "Alternatives list" },
];

export const SEO_COMPANY = [
  { to: "/about", label: "About" },
  { to: "/security", label: "Security & encryption" },
  { to: "/status", label: "Status" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/contact", label: "Contact" },
  { to: "/blog", label: "Blog" },
  { to: "/blog/migrate-from-discord-to-descall", label: "Migrate from Discord" },
  { to: "/tr", label: "Türkçe" },
];

/** Default related set for any marketing page missing a custom cluster. */
export const SEO_DEFAULT_RELATED = [
  ...SEO_PILLARS,
  { to: "/blog", label: "Guides & blog" },
  { to: "/security", label: "How calls are secured" },
];

export function hubLinksForPath(pathname = "/") {
  const p = pathname.split("?")[0] || "/";
  if (p.startsWith("/blog")) {
    return [
      ...SEO_PILLARS,
      { to: "/blog", label: "All guides" },
      { to: "/apps-like-discord", label: "Apps like Discord" },
    ];
  }
  if (p.includes("discord") || p === "/alternatives" || p === "/apps-like-discord") {
    return [...SEO_PILLARS, ...SEO_NICHES.slice(0, 5), { to: "/blog", label: "Blog" }];
  }
  if (["/about", "/security", "/privacy", "/terms", "/contact", "/faq"].includes(p)) {
    return [...SEO_COMPANY, ...SEO_PILLARS.slice(0, 3)];
  }
  return SEO_DEFAULT_RELATED;
}
