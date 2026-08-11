import { useEffect } from "react";
import { absoluteUrl, SITE_NAME } from "./seoConfig";

const SCRIPT_ID = "descall-jsonld";

export function buildOrganizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.png"),
    sameAs: ["https://github.com/demirrsarppkurtlarr/Descall"],
  };
}

export function buildWebSiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/faq")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildSoftwareApplicationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "CommunicationApplication",
    operatingSystem: "Windows, Web",
    url: absoluteUrl("/"),
    downloadUrl: absoluteUrl("/download"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
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

/** Inject one or more JSON-LD graphs into <head>. */
export default function JsonLd({ data }) {
  useEffect(() => {
    const graphs = Array.isArray(data) ? data : [data];
    const payload = graphs.filter(Boolean);
    let el = document.getElementById(SCRIPT_ID);
    if (!payload.length) {
      el?.remove();
      return undefined;
    }
    if (!el) {
      el = document.createElement("script");
      el.id = SCRIPT_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(payload.length === 1 ? payload[0] : payload);
    return () => {
      el?.remove();
    };
  }, [data]);

  return null;
}
