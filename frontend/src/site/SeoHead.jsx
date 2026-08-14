import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  absoluteUrl,
  routeMeta,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  DEFAULT_ORIGIN,
} from "./seoConfig";
import {
  isTrPath,
  enPathForHreflang,
  trPathForHreflang,
  stripLocalePrefix,
} from "./localePaths";

function upsertMeta(attr, key, content) {
  if (content == null) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href, extra = {}) {
  const hreflang = extra.hreflang;
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Per-route title / description / canonical / OG / Twitter / hreflang / robots.
 * Pass `forceNoindex` for the authenticated app shell.
 */
export default function SeoHead({ forceNoindex = false, title, description, path, image }) {
  const location = useLocation();
  const rawPath = path || location.pathname || "/";
  const tr = isTrPath(rawPath);
  const pathname = stripLocalePrefix(rawPath);
  const meta = routeMeta(pathname);
  const pageTitle = title || meta.title;
  const pageDesc = description || meta.description;
  const noindex = forceNoindex || meta.noindex;
  const canonicalPath = tr
    ? rawPath === "/tr" || rawPath === "/tr/"
      ? "/tr"
      : rawPath.replace(/\/+$/, "")
    : meta.path === "/" || pathname === "/"
      ? "/"
      : pathname;
  const canonical = absoluteUrl(canonicalPath === "/tr" ? "/tr" : canonicalPath);
  // Social crawlers prefer PNG; on-page can still preload webp.
  const ogImage = absoluteUrl(image || meta.image || DEFAULT_OG_IMAGE);
  const ogImageWebp = absoluteUrl("/og-default.webp");

  useEffect(() => {
    document.title = pageTitle;
    upsertMeta("name", "description", pageDesc);
    upsertMeta(
      "name",
      "robots",
      noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    );
    upsertMeta(
      "name",
      "keywords",
      "discord alternative, descall, free discord alternative, voice chat, screen share, valorant lfg, discord benzeri"
    );
    upsertLink("canonical", canonical);

    const origin = DEFAULT_ORIGIN.replace(/\/$/, "");
    const enHref = `${origin}${enPathForHreflang(rawPath) === "/" ? "/" : enPathForHreflang(rawPath)}`;
    const trHref = `${origin}${trPathForHreflang(rawPath)}`;
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    upsertLink("alternate", enHref, { hreflang: "en" });
    upsertLink("alternate", trHref, { hreflang: "tr" });
    upsertLink("alternate", enHref, { hreflang: "x-default" });

    upsertMeta("property", "og:type", meta.ogType || "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", tr ? "tr_TR" : "en_US");
    upsertMeta("property", "og:locale:alternate", tr ? "en_US" : "tr_TR");
    upsertMeta("property", "og:title", pageTitle);
    upsertMeta("property", "og:description", pageDesc);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:type", "image/png");
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:image:alt", `${SITE_NAME} — Discord alternative`);
    // Hint for clients that understand webp (not all social crawlers).
    upsertMeta("property", "og:image:secure_url", ogImage);
    let preload = document.head.querySelector('link[rel="preload"][data-og-webp="1"]');
    if (!preload) {
      preload = document.createElement("link");
      preload.rel = "preload";
      preload.setAttribute("data-og-webp", "1");
      document.head.appendChild(preload);
    }
    preload.setAttribute("as", "image");
    preload.setAttribute("type", "image/webp");
    preload.setAttribute("href", ogImageWebp);
    preload.setAttribute("imagesrcset", `${ogImageWebp} 1200w`);
    preload.setAttribute("imagesizes", "1200px");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", pageTitle);
    upsertMeta("name", "twitter:description", pageDesc);
    upsertMeta("name", "twitter:image", ogImage);
  }, [pageTitle, pageDesc, noindex, canonical, ogImage, ogImageWebp, meta.ogType, rawPath, tr]);

  return null;
}
