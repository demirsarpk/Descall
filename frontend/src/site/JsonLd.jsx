import { useEffect } from "react";

export {
  buildOrganizationLd,
  buildWebSiteLd,
  buildSoftwareApplicationLd,
  buildFaqLd,
  buildBreadcrumbLd,
  buildArticleLd,
  buildDiscordAlternativeAppLd,
} from "./jsonLdBuilders.js";

const SCRIPT_ID = "descall-jsonld";

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
