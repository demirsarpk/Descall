import { absoluteUrl, SITE_NAME } from "./seoConfig.js";

export function buildOrganizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/og-default.png"),
    sameAs: ["https://github.com/demirsarpk/Descall"],
    email: "contact@descall.com",
    description:
      "Free Discord alternative for servers, roles, channels, chat, voice, screen share, and Valorant LFG.",
  };
}

export function buildWebSiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["Descall App", "Descall Chat"],
    url: absoluteUrl("/"),
    inLanguage: ["en", "tr"],
  };
}

export function buildSoftwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Windows, Web, Android",
    url: absoluteUrl("/"),
    downloadUrl: absoluteUrl("/download"),
    description:
      "Descall is a free Discord alternative with servers, roles, channels, messaging, group calls, screen share, and Valorant LFG.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Discord-style servers",
      "Roles and channel permissions",
      "Server templates",
      "Real-time messaging",
      "Group voice and video calls",
      "Screen share",
      "Valorant LFG",
    ],
  };
}

export function buildFaqLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (faqs || []).map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

export function buildBreadcrumbLd(crumbs = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label || c.name,
      item: absoluteUrl(c.to || c.path || "/"),
    })),
  };
}

export function buildArticleLd({ title, description, path, datePublished, dateModified }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: absoluteUrl(path),
    datePublished: datePublished || new Date().toISOString().slice(0, 10),
    dateModified: dateModified || datePublished || new Date().toISOString().slice(0, 10),
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/og-default.png"),
      },
    },
    image: [absoluteUrl("/og-default.png")],
  };
}

export function buildDiscordAlternativeAppLd(path = "/discord-alternative") {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Windows, Web, Android",
    url: absoluteUrl(path),
    downloadUrl: absoluteUrl("/download"),
    description:
      "Free Discord alternative with servers, roles, channels, real-time chat, group voice/video, screen share, and Valorant LFG.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Discord-style servers with channels",
      "Roles and permission overrides",
      "Advanced server templates",
      "Real-time messaging",
      "Group voice and video calls",
      "Screen share",
      "Valorant LFG",
      "Windows desktop app",
      "Android APK",
    ],
  };
}
