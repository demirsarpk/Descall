/** Canonical public marketing routes + head metadata. */

export const SITE_NAME = "Descall";
export const DEFAULT_ORIGIN = "https://des-call.onrender.com";
export const DEFAULT_OG_IMAGE = "/icon.png";

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

export function absoluteUrl(path = "/") {
  const origin = siteOrigin();
  if (!path || path === "/") return `${origin}/`;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Public indexable routes (must match sitemap staticPages). */
export const PUBLIC_ROUTES = [
  {
    path: "/",
    title: "Descall — Messages, voice & screen share",
    description:
      "Descall is a modern chat app with group voice/video calls, screen share, Valorant LFG, and a desktop client.",
    changefreq: "daily",
    priority: "1.0",
  },
  {
    path: "/download",
    title: "Download Descall Desktop",
    description:
      "Download the Descall desktop app for Windows. Chat, voice, video, and screen share — also available in the browser.",
    changefreq: "weekly",
    priority: "0.9",
  },
  {
    path: "/features",
    title: "Descall Features — Chat, calls & screen share",
    description:
      "Explore Descall features: real-time messaging, group voice and video calls, screen share, groups, and more.",
    changefreq: "weekly",
    priority: "0.8",
  },
  {
    path: "/faq",
    title: "Descall FAQ",
    description:
      "Frequently asked questions about Descall — accounts, desktop download, calls, screen share, and privacy.",
    changefreq: "weekly",
    priority: "0.7",
  },
  {
    path: "/security",
    title: "Descall Security",
    description:
      "How Descall protects your chats and calls — encryption in transit, account security, and responsible practices.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/privacy",
    title: "Descall Privacy Policy",
    description: "Privacy Policy for Descall — what we collect, how we use data, and your choices.",
    changefreq: "monthly",
    priority: "0.5",
  },
  {
    path: "/terms",
    title: "Descall Terms of Service",
    description: "Terms of Service for using Descall web and desktop apps.",
    changefreq: "monthly",
    priority: "0.5",
  },
  {
    path: "/about",
    title: "About Descall",
    description: "Descall is building a fast, modern place to chat and call with friends and groups.",
    changefreq: "monthly",
    priority: "0.6",
  },
  {
    path: "/contact",
    title: "Contact Descall",
    description: "Get in touch with the Descall team — support, feedback, and press.",
    changefreq: "monthly",
    priority: "0.5",
  },
  {
    path: "/compare/discord",
    title: "Descall vs Discord",
    description:
      "Compare Descall and Discord for chat, voice, video, and screen share — a lighter alternative for friends and groups.",
    changefreq: "monthly",
    priority: "0.7",
  },
];

export function routeMeta(pathname) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  const hit = PUBLIC_ROUTES.find((r) => r.path === clean || (r.path !== "/" && clean === r.path));
  if (hit) return { ...hit, noindex: false };
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
