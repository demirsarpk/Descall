/**
 * Descall SEO keyword strategy — maps search demand → target pages.
 * Used for planning, internal linking, and seo-validate checks.
 * Do NOT stuff these into page body copy.
 */

/** @typedef {'informational'|'commercial'|'transactional'|'navigational'} Intent */
/** @typedef {'TOF'|'MOF'|'BOF'} Funnel */
/** @typedef {'P0'|'P1'|'P2'|'P3'} Priority */

/**
 * @type {Array<{
 *   keyword: string,
 *   intent: Intent,
 *   targetPath: string,
 *   priority: Priority,
 *   funnel: Funnel,
 *   commercialIntent: 'high'|'medium'|'low',
 *   cluster: string,
 * }>}
 */
export const KEYWORD_STRATEGY = [
  // High-intent core
  { keyword: "discord alternative", intent: "commercial", targetPath: "/discord-alternative", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "pillar" },
  { keyword: "discord alternatives", intent: "commercial", targetPath: "/alternatives", priority: "P0", funnel: "MOF", commercialIntent: "high", cluster: "pillar" },
  { keyword: "best discord alternative", intent: "commercial", targetPath: "/discord-alternative", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "pillar" },
  { keyword: "discord replacement", intent: "commercial", targetPath: "/discord-replacement", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "pillar" },
  { keyword: "alternative to discord", intent: "commercial", targetPath: "/discord-alternative", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "pillar" },
  { keyword: "best alternative to discord", intent: "commercial", targetPath: "/discord-alternative", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "pillar" },
  { keyword: "free discord alternative", intent: "commercial", targetPath: "/discord-alternative", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "pillar" },
  { keyword: "discord alternative app", intent: "commercial", targetPath: "/download", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "product" },
  { keyword: "discord alternative platform", intent: "commercial", targetPath: "/discord-alternative", priority: "P1", funnel: "MOF", commercialIntent: "high", cluster: "pillar" },

  // Gaming
  { keyword: "discord alternative for gamers", intent: "commercial", targetPath: "/best-discord-alternative-for-gamers", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "gaming" },
  { keyword: "discord alternative for gaming", intent: "commercial", targetPath: "/best-discord-alternative-for-gamers", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "gaming" },
  { keyword: "gaming community platform", intent: "informational", targetPath: "/discord-alternative-for-communities", priority: "P2", funnel: "MOF", commercialIntent: "medium", cluster: "communities" },
  { keyword: "gaming chat alternative", intent: "commercial", targetPath: "/best-discord-alternative-for-gamers", priority: "P1", funnel: "MOF", commercialIntent: "high", cluster: "gaming" },
  { keyword: "voice chat alternative to discord", intent: "commercial", targetPath: "/discord-alternative-for-voice-chat", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "voice" },
  { keyword: "lfg platform", intent: "commercial", targetPath: "/discord-alternative-for-lfg", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "lfg" },
  { keyword: "lfg app", intent: "commercial", targetPath: "/discord-alternative-for-lfg", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "lfg" },
  { keyword: "gaming community app", intent: "commercial", targetPath: "/best-discord-alternative-for-gamers", priority: "P2", funnel: "MOF", commercialIntent: "medium", cluster: "gaming" },
  { keyword: "valorant lfg", intent: "transactional", targetPath: "/discord-alternative-for-lfg", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "lfg" },
  { keyword: "discord alternative for lfg", intent: "commercial", targetPath: "/discord-alternative-for-lfg", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "lfg" },

  // Communities / friends
  { keyword: "discord alternative for communities", intent: "commercial", targetPath: "/discord-alternative-for-communities", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "communities" },
  { keyword: "community chat platform", intent: "informational", targetPath: "/discord-alternative-for-communities", priority: "P2", funnel: "MOF", commercialIntent: "medium", cluster: "communities" },
  { keyword: "community communication platform", intent: "informational", targetPath: "/discord-alternative-for-communities", priority: "P2", funnel: "TOF", commercialIntent: "medium", cluster: "communities" },
  { keyword: "private community platform", intent: "commercial", targetPath: "/discord-alternative-for-friends", priority: "P2", funnel: "MOF", commercialIntent: "medium", cluster: "friends" },
  { keyword: "online community platform", intent: "informational", targetPath: "/discord-alternative-for-communities", priority: "P2", funnel: "TOF", commercialIntent: "medium", cluster: "communities" },
  { keyword: "community voice chat", intent: "commercial", targetPath: "/discord-alternative-for-voice-chat", priority: "P2", funnel: "MOF", commercialIntent: "medium", cluster: "voice" },
  { keyword: "discord alternative for friends", intent: "commercial", targetPath: "/discord-alternative-for-friends", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "friends" },
  { keyword: "group chat alternative to discord", intent: "commercial", targetPath: "/discord-alternative-for-friends", priority: "P2", funnel: "MOF", commercialIntent: "high", cluster: "friends" },

  // Feature-based
  { keyword: "discord alternative for voice chat", intent: "commercial", targetPath: "/discord-alternative-for-voice-chat", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "voice" },
  { keyword: "discord alternative with screen share", intent: "commercial", targetPath: "/features", priority: "P2", funnel: "MOF", commercialIntent: "high", cluster: "features" },
  { keyword: "free voice chat app for gamers", intent: "commercial", targetPath: "/discord-alternative-for-voice-chat", priority: "P2", funnel: "MOF", commercialIntent: "high", cluster: "voice" },
  { keyword: "screen share voice chat app", intent: "commercial", targetPath: "/features", priority: "P2", funnel: "MOF", commercialIntent: "medium", cluster: "features" },

  // Comparison / competitors
  { keyword: "discord vs descall", intent: "commercial", targetPath: "/compare/discord", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "compare" },
  { keyword: "descall vs discord", intent: "commercial", targetPath: "/compare/discord", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "compare" },
  { keyword: "discord alternative comparison", intent: "informational", targetPath: "/alternatives", priority: "P1", funnel: "MOF", commercialIntent: "medium", cluster: "compare" },
  { keyword: "discord competitors", intent: "informational", targetPath: "/blog/discord-competitors", priority: "P1", funnel: "MOF", commercialIntent: "medium", cluster: "compare" },
  { keyword: "discord competitors 2026", intent: "informational", targetPath: "/blog/discord-competitors", priority: "P1", funnel: "MOF", commercialIntent: "medium", cluster: "compare" },
  { keyword: "best discord competitors", intent: "commercial", targetPath: "/alternatives", priority: "P1", funnel: "MOF", commercialIntent: "high", cluster: "compare" },
  { keyword: "apps like discord", intent: "commercial", targetPath: "/apps-like-discord", priority: "P0", funnel: "MOF", commercialIntent: "high", cluster: "compare" },
  { keyword: "websites like discord", intent: "commercial", targetPath: "/apps-like-discord", priority: "P1", funnel: "MOF", commercialIntent: "high", cluster: "compare" },
  { keyword: "platforms like discord", intent: "commercial", targetPath: "/apps-like-discord", priority: "P1", funnel: "MOF", commercialIntent: "high", cluster: "compare" },

  // Long-tail / migration
  { keyword: "how to switch from discord", intent: "informational", targetPath: "/blog/leave-nitro-keep-voice-chat", priority: "P1", funnel: "MOF", commercialIntent: "medium", cluster: "migration" },
  { keyword: "leave discord nitro", intent: "informational", targetPath: "/blog/leave-nitro-keep-voice-chat", priority: "P2", funnel: "MOF", commercialIntent: "medium", cluster: "migration" },
  { keyword: "best discord alternatives 2026", intent: "informational", targetPath: "/blog/best-discord-alternatives-2026", priority: "P1", funnel: "MOF", commercialIntent: "medium", cluster: "blog" },
  { keyword: "discord alternatifi", intent: "commercial", targetPath: "/discord-alternative-turkey", priority: "P0", funnel: "BOF", commercialIntent: "high", cluster: "i18n" },
  { keyword: "discord alternatifleri", intent: "commercial", targetPath: "/discord-alternative-turkey", priority: "P1", funnel: "MOF", commercialIntent: "high", cluster: "i18n" },
  { keyword: "discord muadili", intent: "commercial", targetPath: "/discord-alternative-turkey", priority: "P1", funnel: "MOF", commercialIntent: "high", cluster: "i18n" },
  { keyword: "discord benzeri uygulamalar", intent: "commercial", targetPath: "/discord-alternative-turkey", priority: "P1", funnel: "MOF", commercialIntent: "medium", cluster: "i18n" },
  { keyword: "türk discord alternatifi", intent: "commercial", targetPath: "/discord-alternative-turkey", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "i18n" },

  // Brand
  { keyword: "descall", intent: "navigational", targetPath: "/", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "brand" },
  { keyword: "descall app", intent: "navigational", targetPath: "/download", priority: "P1", funnel: "BOF", commercialIntent: "high", cluster: "brand" },
  { keyword: "descall chat", intent: "navigational", targetPath: "/", priority: "P2", funnel: "BOF", commercialIntent: "medium", cluster: "brand" },
];

export const CONTENT_CLUSTERS = {
  pillar: {
    pillar: "/discord-alternative",
    children: [
      "/alternatives",
      "/compare/discord",
      "/discord-replacement",
      "/apps-like-discord",
      "/best-discord-alternative-for-gamers",
      "/discord-alternative-for-communities",
      "/discord-alternative-for-lfg",
      "/discord-alternative-for-voice-chat",
      "/discord-alternative-for-friends",
      "/discord-alternative-turkey",
      "/blog",
    ],
  },
  gaming: {
    pillar: "/best-discord-alternative-for-gamers",
    children: [
      "/discord-alternative-for-lfg",
      "/blog/best-discord-alternative-for-lfg",
      "/blog/best-discord-alternatives-2026",
      "/discord-alternative",
    ],
  },
  compare: {
    pillar: "/compare/discord",
    children: [
      "/alternatives",
      "/apps-like-discord",
      "/blog/discord-vs-descall",
      "/blog/discord-competitors",
      "/discord-replacement",
    ],
  },
};
