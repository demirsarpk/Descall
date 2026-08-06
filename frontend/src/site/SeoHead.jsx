import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { absoluteUrl, routeMeta, SITE_NAME, DEFAULT_OG_IMAGE } from "./seoConfig";

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

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Per-route title / description / canonical / OG / robots.
 * Pass `forceNoindex` for the authenticated app shell.
 */
export default function SeoHead({ forceNoindex = false, title, description, path }) {
  const location = useLocation();
  const pathname = path || location.pathname || "/";
  const meta = routeMeta(pathname);
  const pageTitle = title || meta.title;
  const pageDesc = description || meta.description;
  const noindex = forceNoindex || meta.noindex;
  const canonical = absoluteUrl(meta.path === "/" || pathname === "/" ? "/" : pathname);
  const ogImage = absoluteUrl(DEFAULT_OG_IMAGE);

  useEffect(() => {
    document.title = pageTitle;
    upsertMeta("name", "description", pageDesc);
    upsertMeta("name", "robots", noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large");
    upsertLink("canonical", canonical);

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:title", pageTitle);
    upsertMeta("property", "og:description", pageDesc);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", pageTitle);
    upsertMeta("name", "twitter:description", pageDesc);
  }, [pageTitle, pageDesc, noindex, canonical, ogImage]);

  return null;
}
