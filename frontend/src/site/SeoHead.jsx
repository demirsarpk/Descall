import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  absoluteUrl,
  routeMeta,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  DEFAULT_ORIGIN,
} from "./seoConfig";

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
  const pathname = path || location.pathname || "/";
  const meta = routeMeta(pathname);
  const pageTitle = title || meta.title;
  const pageDesc = description || meta.description;
  const noindex = forceNoindex || meta.noindex;
  const canonicalPath = meta.path === "/" || pathname === "/" ? "/" : pathname;
  const canonical = absoluteUrl(canonicalPath);
  const ogImage = absoluteUrl(image || meta.image || DEFAULT_OG_IMAGE);

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

    // hreflang — only when we have real locale-targeted URLs (no fake en/tr on the same path).
    // Client locale toggle does not create separate crawlable language URLs.
    const origin = DEFAULT_ORIGIN.replace(/\/$/, "");
    const pathPart = canonicalPath === "/" ? "/" : canonicalPath;
    const isTurkey = pathPart === "/discord-alternative-turkey";
    // Clear previous alternates by rewriting the ones we own
    if (isTurkey) {
      upsertLink("alternate", `${origin}${pathPart}`, { hreflang: "tr" });
      upsertLink("alternate", `${origin}/discord-alternative`, { hreflang: "en" });
      upsertLink("alternate", `${origin}/discord-alternative`, { hreflang: "x-default" });
    } else {
      upsertLink("alternate", `${origin}${pathPart}`, { hreflang: "en" });
      upsertLink("alternate", `${origin}${pathPart}`, { hreflang: "x-default" });
      if (pathPart === "/discord-alternative") {
        upsertLink("alternate", `${origin}/discord-alternative-turkey`, { hreflang: "tr" });
      }
    }

    upsertMeta("property", "og:type", meta.ogType || "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", isTurkey ? "tr_TR" : "en_US");
    if (!isTurkey) upsertMeta("property", "og:locale:alternate", "tr_TR");
    upsertMeta("property", "og:title", pageTitle);
    upsertMeta("property", "og:description", pageDesc);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:alt", `${SITE_NAME} — Discord alternative`);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", pageTitle);
    upsertMeta("name", "twitter:description", pageDesc);
    upsertMeta("name", "twitter:image", ogImage);
  }, [pageTitle, pageDesc, noindex, canonical, ogImage, meta.ogType, canonicalPath]);

  return null;
}
