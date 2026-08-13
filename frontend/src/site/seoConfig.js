/** Canonical public marketing routes + head metadata. */

export const SITE_NAME = "Descall";
// descall.com is the canonical public host; the Render hostname is infrastructure.
export const DEFAULT_ORIGIN = "https://descall.com";
// PNG — Instagram/Facebook rasterize SVG poorly (dark smudge next to wordmark).
export const DEFAULT_OG_IMAGE = "/og-default.png";
export const SUPPORTED_LOCALES = ["en", "tr"];

/** Runtime origin (API / preview hosts). Prefer this only for non-SEO needs. */
export function siteOrigin() {
  try {
    if (typeof window !== "undefined" && window.location?.origin) {
      const o = window.location.origin;
      if (o && !o.startsWith("file:")) return o.replace(/\/$/, "");
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ORIGIN;
}

/**
 * Canonical public origin for SEO (canonical, OG, JSON-LD, hreflang).
 * Always descall.com — never preview/onrender hosts — so Google consolidates signals.
 */
export function canonicalOrigin() {
  return DEFAULT_ORIGIN;
}

export function absoluteUrl(path = "/") {
  const origin = canonicalOrigin();
  if (!path || path === "/") return `${origin}/`;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Public indexable routes (must match sitemap staticPages + MarketingApp). */
export const PUBLIC_ROUTES = [
  {
    path: "/",
    title: "Descall — Free Discord Alternative with Servers, Chat & Voice",
    description:
      "Descall is a free Discord alternative with real servers (roles, channels, templates), chat, group voice/video, screen share, Valorant LFG, and Windows/Android apps.",
    changefreq: "daily",
    priority: "1.0",
    keywords: "discord alternative, descall, discord servers alternative, free voice chat, valorant lfg",
  },
  {
    path: "/download",
    title: "Download Descall — Discord alternative for Windows & Android",
    description:
      "Download the Descall desktop app for Windows or use Android/web. A free Discord alternative for servers, chat, voice, video, and screen share.",
    changefreq: "weekly",
    priority: "0.9",
  },
  {
    path: "/features",
    title: "Descall Features — Servers, roles, chat, calls & LFG",
    description:
      "Explore Descall features: Discord-style servers with roles & channels, templates, messaging, group voice/video, screen share, Valorant LFG, and more.",
    changefreq: "weekly",
    priority: "0.85",
  },
  {
    path: "/discord-alternative",
    title: "Best Free Discord Alternative for Friends & Gamers | Descall",
    description:
      "Descall is a free Discord alternative with real servers, roles, channels, HD voice/video, screen share, and Valorant LFG — no Nitro paywall on core features.",
    h1: "The best free Discord alternative for friends & gamers",
    changefreq: "weekly",
    priority: "0.95",
    keywords: "discord alternative, best discord alternative, free discord alternative, discord server alternative",
  },
  {
    path: "/alternatives",
    title: "Best Discord Alternatives in 2026 — Compare Apps Like Discord",
    description:
      "Compare Discord alternatives and apps like Discord for servers, chat, voice, and LFG. See why friend groups pick Descall as a lighter free option.",
    h1: "Discord alternatives worth switching to",
    changefreq: "weekly",
    priority: "0.9",
    keywords: "discord alternatives, apps like discord, best discord alternatives 2026",
  },
  {
    path: "/compare/discord",
    title: "Descall vs Discord (2026) — Feature Comparison & Verdict",
    description:
      "Side-by-side Descall vs Discord: servers, roles, channels, templates, voice, messaging, LFG, screen share, mobile, desktop, and pricing.",
    h1: "Descall vs Discord — which Discord alternative fits your group?",
    changefreq: "weekly",
    priority: "0.95",
    keywords: "descall vs discord, discord vs descall, discord alternative comparison",
  },
  {
    path: "/best-discord-alternative-for-gamers",
    title: "Best Discord Alternative for Gamers & Valorant LFG | Descall",
    description:
      "Discord alternative for gamers: free voice, screen share, and built-in Valorant LFG so squads queue without Nitro or bot hell.",
    changefreq: "weekly",
    priority: "0.9",
    keywords: "discord alternative for gamers, gaming chat alternative, valorant lfg",
  },
  {
    path: "/discord-alternative-for-communities",
    title: "Discord Alternative for Communities | Descall Servers",
    description:
      "Community chat platform with real servers: roles, channels, templates, invites, and voice. Descall is a Discord alternative for private and growing communities.",
    changefreq: "weekly",
    priority: "0.88",
    keywords: "discord alternative for communities, community chat platform, discord server alternative",
  },
  {
    path: "/discord-alternative-for-lfg",
    title: "Discord Alternative for LFG — Valorant Lobbies | Descall",
    description:
      "LFG app built into a Discord alternative: Play tab lobbies, party codes, Riot Name#TAG link, then jump straight into voice.",
    changefreq: "weekly",
    priority: "0.9",
    keywords: "discord alternative for lfg, lfg app, lfg platform, valorant lfg",
  },
  {
    path: "/discord-alternative-for-voice-chat",
    title: "Voice Chat Alternative to Discord — Free Calls | Descall",
    description:
      "Free voice chat alternative to Discord with WebRTC calls, screen share quality presets, and no Nitro paywall on talking to friends.",
    changefreq: "weekly",
    priority: "0.88",
    keywords: "voice chat alternative to discord, discord alternative for voice chat",
  },
  {
    path: "/discord-alternative-for-friends",
    title: "Discord Alternative for Friends — DMs, Groups & Voice",
    description:
      "Discord alternative for friends: DMs, groups, presence, and free voice/video. Skip server admin — keep the people you actually call.",
    changefreq: "weekly",
    priority: "0.88",
    keywords: "discord alternative for friends, group chat alternative to discord",
  },
  {
    path: "/apps-like-discord",
    title: "Apps Like Discord (2026) — Websites & Platforms Compared",
    description:
      "Looking for apps like Discord, websites like Discord, or platforms like Discord? Compare options and see when Descall is the better free pick.",
    changefreq: "weekly",
    priority: "0.9",
    keywords: "apps like discord, websites like discord, platforms like discord",
  },
  {
    path: "/discord-replacement",
    title: "Discord Replacement for Friend Groups | Switch to Descall",
    description:
      "Need a Discord replacement for nightly voice and DMs? Migrate your friend group to Descall in two weeks — keep Discord only for mega-servers.",
    changefreq: "weekly",
    priority: "0.88",
    keywords: "discord replacement, alternative to discord, switch from discord",
  },
  {
    path: "/discord-alternative-turkey",
    title: "Türkiye için Discord Alternatifi — Descall",
    description:
      "Discord alternatifi mi arıyorsun? Descall: ücretsiz sohbet, sesli arama, ekran paylaşımı ve Valorant LFG. Türkçe arayüz, Windows ve Android.",
    changefreq: "weekly",
    priority: "0.9",
    lang: "tr",
    keywords: "discord alternatifi, discord alternatifleri, ücretsiz sesli sohbet",
  },
  {
    path: "/blog",
    title: "Descall Blog — Discord Alternatives, LFG & Voice Chat Guides",
    description:
      "Practical guides on Discord alternatives, Discord competitors, Valorant LFG, voice chat, and migrating friend groups to Descall.",
    changefreq: "weekly",
    priority: "0.8",
  },
  {
    path: "/blog/discord-vs-descall",
    title: "Discord vs Descall (2026) — Which Should Your Group Use?",
    description:
      "Honest Discord vs Descall comparison for chat, voice, screen share, LFG, and pricing — when a lighter Discord alternative wins.",
    changefreq: "monthly",
    priority: "0.85",
    ogType: "article",
  },
  {
    path: "/blog/best-discord-alternative-for-lfg",
    title: "Best Discord Alternative for Valorant LFG | Descall Blog",
    description:
      "Why gamers choose Descall as a Discord alternative for LFG: Play tab lobbies, party codes, and Riot Name#TAG linking.",
    changefreq: "monthly",
    priority: "0.85",
    ogType: "article",
  },
  {
    path: "/blog/leave-nitro-keep-voice-chat",
    title: "Leave Nitro. Keep Voice Chat. — Migration Guide",
    description:
      "Move your friend group off Discord Nitro habits to a free Discord alternative with voice, video, and screen share.",
    changefreq: "monthly",
    priority: "0.8",
    ogType: "article",
  },
  {
    path: "/blog/best-discord-alternatives-2026",
    title: "Best Discord Alternatives in 2026 — Honest Shortlist",
    description:
      "Best Discord alternatives in 2026 for friends, voice, and LFG — how Descall, Discord, Guilded, and others actually compare.",
    changefreq: "monthly",
    priority: "0.85",
    ogType: "article",
  },
  {
    path: "/blog/apps-like-discord",
    title: "Apps Like Discord — What to Use Instead in 2026",
    description:
      "Apps like Discord explained by job-to-be-done: friend voice, communities, or pure voice servers — and where Descall fits.",
    changefreq: "monthly",
    priority: "0.85",
    ogType: "article",
  },
  {
    path: "/blog/discord-competitors",
    title: "Discord Competitors in 2026 — Who Actually Competes",
    description:
      "Map of Discord competitors in 2026: lighter friend apps, gaming suites, and voice classics — plus where Descall competes honestly.",
    changefreq: "monthly",
    priority: "0.85",
    ogType: "article",
  },
  {
    path: "/blog/discord-alternative-for-communities-guide",
    title: "Discord Alternative for Communities — Practical Guide",
    description:
      "How small communities pick a Discord alternative: groups, invites, voice hangouts, and when to stay on Discord.",
    changefreq: "monthly",
    priority: "0.8",
    ogType: "article",
  },
  {
    path: "/blog/voice-chat-alternative-to-discord",
    title: "Voice Chat Alternative to Discord — Free Calls Guide",
    description:
      "Looking for a voice chat alternative to Discord? How Descall handles free WebRTC calls, screen share, and gaming nights.",
    changefreq: "monthly",
    priority: "0.8",
    ogType: "article",
  },
  {
    path: "/faq",
    title: "Descall FAQ — Discord alternative questions answered",
    description:
      "FAQ about Descall as a Discord alternative — accounts, desktop download, calls, screen share, LFG, and privacy.",
    changefreq: "weekly",
    priority: "0.75",
  },
  {
    path: "/security",
    title: "Descall Security — TLS, WebRTC DTLS/SRTP & Accounts",
    description:
      "Descall security: HTTPS/TLS for web, WebRTC DTLS/SRTP for calls, bcrypt passwords, and honest limits — no default E2E claim for stored chat history.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/privacy",
    title: "Descall Privacy Policy — GDPR/KVKK data practices",
    description:
      "Descall Privacy Policy: what we collect (account, messages, IP, call metadata), how long we keep it, processors (Supabase, Resend, FCM), and your access/deletion rights.",
    changefreq: "monthly",
    priority: "0.5",
  },
  {
    path: "/terms",
    title: "Descall Terms of Service — Age, Acceptable Use & Accounts",
    description:
      "Terms of Service for Descall web and desktop apps: age requirements (13+), acceptable use, account suspension, DesCoin cosmetics, and liability limits.",
    changefreq: "monthly",
    priority: "0.5",
  },
  {
    path: "/about",
    title: "About Descall — Building a lighter Discord alternative",
    description:
      "Descall is an independent beta Discord alternative by Demir Sarp Kurtlar (Türkiye). Contact contact@descall.com for support.",
    changefreq: "monthly",
    priority: "0.65",
  },
  {
    path: "/contact",
    title: "Contact Descall Support — Email & Security Reports",
    description:
      "Email contact@descall.com for Descall support, feedback, press, or security reports. Operated by Demir Sarp Kurtlar in Türkiye.",
    changefreq: "monthly",
    priority: "0.5",
  },
];

export function routeMeta(pathname) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  const hit = PUBLIC_ROUTES.find((r) => r.path === clean);
  if (hit) return { ...hit, noindex: false };
  // Auth deep-links — crawlable entry should be marketing pages, not thin auth URLs
  if (clean === "/register" || clean === "/login") {
    return {
      path: clean,
      title: clean === "/register" ? "Create account — Descall" : "Sign in — Descall",
      description: "Create a free Descall account for chat, voice, video, and screen share.",
      noindex: true,
    };
  }
  if (clean.startsWith("/app")) {
    return {
      path: clean,
      title: "Descall",
      description: "Descall app",
      noindex: true,
    };
  }
  return {
    path: clean,
    title: "Page not found — Descall",
    description: "This page does not exist on Descall.",
    noindex: true,
  };
}
