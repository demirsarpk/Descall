/**
 * Post-build SEO HTML shells for crawlers.
 * Copies dist/index.html into route folders with route-specific meta/title.
 * Routes stay in sync with src/site/seoConfig.js PUBLIC_ROUTES.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const indexPath = path.join(distDir, "index.html");

const SITE = "https://descall.com";
const OG = `${SITE}/og-default.svg`;

/** Keep aligned with frontend/src/site/seoConfig.js PUBLIC_ROUTES */
const ROUTES = [
  {
    path: "/",
    title: "Descall — Free Discord alternative for chat, voice & LFG",
    description:
      "Descall is a free Discord alternative with real-time chat, group voice/video, screen share, Valorant LFG, and a Windows desktop app — lighter for friends and gamers.",
    keywords: "discord alternative, discord alternatives, free discord alternative, voice chat, valorant lfg",
  },
  {
    path: "/download",
    title: "Download Descall — Discord alternative for Windows & Android",
    description:
      "Download the Descall desktop app for Windows or use Android/web. A free Discord alternative for chat, voice, video, and screen share.",
    keywords: "download descall, discord alternative download, descall windows",
  },
  {
    path: "/features",
    title: "Descall Features — Chat, calls, screen share & LFG",
    description:
      "Explore Descall features: Discord-alternative messaging, group voice/video, screen share quality controls, Valorant LFG, cosmetics, and more.",
    keywords: "descall features, discord alternative features, voice chat features",
  },
  {
    path: "/discord-alternative",
    title: "Best Free Discord Alternative (2026) — Descall",
    description:
      "Looking for a Discord alternative? Descall offers free chat, voice, video, screen share, and Valorant LFG without Nitro — built for friends and gaming groups.",
    keywords: "discord alternative, best discord alternative, free discord alternative 2026",
  },
  {
    path: "/alternatives",
    title: "Discord Alternatives in 2026 — Why teams pick Descall",
    description:
      "Compare Discord alternatives for chat and voice. See why Descall is a lighter, free Discord alternative for friend groups, LFG, and screen share.",
    keywords: "discord alternatives, apps like discord, best discord alternatives 2026",
  },
  {
    path: "/compare/discord",
    title: "Descall vs Discord — Honest comparison (2026)",
    description:
      "Descall vs Discord: chat, voice, video, screen share, LFG, desktop apps, and pricing. See when Descall is the better Discord alternative.",
    keywords: "descall vs discord, discord vs descall, discord comparison",
  },
  {
    path: "/best-discord-alternative-for-gamers",
    title: "Best Discord Alternative for Gamers — Descall LFG",
    description:
      "Best Discord alternative for gamers: Descall combines voice chat, screen share, and built-in Valorant LFG so squads can queue without Nitro.",
    keywords: "discord alternative for gamers, gaming discord alternative, valorant lfg",
  },
  {
    path: "/discord-alternative-turkey",
    title: "Türkiye için Discord Alternatifi — Descall",
    description:
      "Discord alternatifi mi arıyorsun? Descall: ücretsiz sohbet, sesli arama, ekran paylaşımı ve Valorant LFG. Türkçe arayüz, Windows ve Android.",
    keywords: "discord alternatifi, discord alternatifleri, ücretsiz sesli sohbet",
    lang: "tr",
  },
  {
    path: "/blog",
    title: "Descall Blog — Discord alternatives, LFG & voice chat",
    description:
      "Guides on Discord alternatives, Valorant LFG, voice chat, and migrating friend groups to Descall.",
    keywords: "discord alternative blog, voice chat guides, valorant lfg",
  },
  {
    path: "/blog/discord-vs-descall",
    title: "Discord vs Descall (2026) — Which should your group use?",
    description:
      "Honest Discord vs Descall comparison for chat, voice, screen share, LFG, and pricing — when a lighter Discord alternative wins.",
    keywords: "discord vs descall, descall vs discord",
  },
  {
    path: "/blog/best-discord-alternative-for-lfg",
    title: "Best Discord Alternative for Valorant LFG",
    description:
      "Why gamers choose Descall as a Discord alternative for LFG: Play tab lobbies, party codes, and Riot Name#TAG linking.",
    keywords: "discord alternative for lfg, valorant lfg app",
  },
  {
    path: "/blog/leave-nitro-keep-voice-chat",
    title: "Leave Nitro. Keep voice chat. — Descall migration guide",
    description:
      "Move your friend group off Discord Nitro habits to a free Discord alternative with voice, video, and screen share.",
    keywords: "leave discord nitro, switch from discord, free voice chat",
  },
  {
    path: "/faq",
    title: "Descall FAQ — Discord alternative questions answered",
    description:
      "FAQ about Descall as a Discord alternative — accounts, desktop download, calls, screen share, LFG, and privacy.",
    keywords: "descall faq, discord alternative faq",
  },
  {
    path: "/security",
    title: "Descall Security",
    description:
      "How Descall protects your chats and calls — encryption in transit, account security, and responsible practices.",
  },
  {
    path: "/privacy",
    title: "Descall Privacy Policy",
    description: "Privacy Policy for Descall — what we collect, how we use data, and your choices.",
  },
  {
    path: "/terms",
    title: "Descall Terms of Service",
    description: "Terms of Service for using Descall web and desktop apps.",
  },
  {
    path: "/about",
    title: "About Descall — Building a lighter Discord alternative",
    description:
      "Descall is building a fast, modern Discord alternative for chat, calls, screen share, and gamer LFG.",
  },
  {
    path: "/contact",
    title: "Contact Descall",
    description: "Get in touch with the Descall team — support, feedback, and press.",
  },
];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function injectMeta(html, route) {
  const url = `${SITE}${route.path === "/" ? "/" : route.path}`;
  const title = escapeHtml(route.title);
  const desc = escapeHtml(route.description);
  const keywords = route.keywords ? escapeHtml(route.keywords) : "";
  const lang = route.lang || "en";

  let out = html;
  out = out.replace(/<html\s+lang="[^"]*"/i, `<html lang="${lang}"`);
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);

  const metaBlock = [
    `<meta name="description" content="${desc}" />`,
    keywords ? `<meta name="keywords" content="${keywords}" />` : "",
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="en" href="${url}" />`,
    `<link rel="alternate" hreflang="tr" href="${url}" />`,
    `<link rel="alternate" hreflang="x-default" href="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Descall" />`,
    `<meta property="og:image" content="${OG}" />`,
    `<meta property="og:locale" content="${lang === "tr" ? "tr_TR" : "en_US"}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
    `<meta name="twitter:image" content="${OG}" />`,
  ]
    .filter(Boolean)
    .join("\n    ");

  out = out.replace(/<\/title>/i, `</title>\n    ${metaBlock}`);
  return out;
}

function writeRoute(route, html) {
  const rel = route.path === "/" ? "" : route.path.replace(/^\//, "");
  const dir = rel ? path.join(distDir, rel) : distDir;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, injectMeta(html, route), "utf8");
  console.log(`[prerender-seo] ${route.path}`);
}

function main() {
  if (!fs.existsSync(indexPath)) {
    console.error("[prerender-seo] dist/index.html missing — run vite build first");
    process.exit(1);
  }
  const base = fs.readFileSync(indexPath, "utf8");
  for (const route of ROUTES) {
    writeRoute(route, base);
  }
  console.log(`[prerender-seo] wrote ${ROUTES.length} SEO shells`);
}

main();
