"use strict";

/**
 * Production host/protocol canonicalization for SEO.
 * - http → https (301)
 * - www.descall.com → descall.com (301)
 * - Marketing HTML on des-call.onrender.com → https://descall.com (301)
 * API / realtime / health paths are never redirected off Render.
 *
 * Localhost / development is left untouched unless FORCE_CANONICAL_HOST=true.
 */

const CANONICAL_HOST = "descall.com";
const RENDER_HOSTS = new Set(["des-call.onrender.com", "des-call-staging.onrender.com"]);

const API_PREFIXES = [
  "/api",
  "/auth",
  "/admin",
  "/media",
  "/groups",
  "/friends",
  "/servers",
  "/reactions",
  "/health",
  "/debug",
  "/lfg",
  "/calls",
  "/riot",
  "/socket.io",
];

function isApiOrInfraPath(pathname) {
  if (!pathname) return false;
  return API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function shouldEnforce() {
  if (process.env.FORCE_CANONICAL_HOST === "true") return true;
  if (process.env.FORCE_CANONICAL_HOST === "false") return false;
  return process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";
}

function getForwardedProto(req) {
  const raw = req.get("x-forwarded-proto") || req.protocol || "http";
  return String(raw).split(",")[0].trim().toLowerCase();
}

function getHost(req) {
  const raw = req.get("x-forwarded-host") || req.get("host") || "";
  return String(raw).split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function canonicalHostMiddleware(req, res, next) {
  if (!shouldEnforce()) return next();
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  const host = getHost(req);
  const proto = getForwardedProto(req);
  const pathOnly = req.path || "/";

  // Never bounce API / socket traffic away from Render.
  if (isApiOrInfraPath(pathOnly)) return next();

  // Skip local/dev hosts
  if (!host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return next();
  }

  let targetHost = host;
  let targetProto = proto;
  let redirect = false;

  if (proto === "http") {
    targetProto = "https";
    redirect = true;
  }

  if (host === `www.${CANONICAL_HOST}`) {
    targetHost = CANONICAL_HOST;
    targetProto = "https";
    redirect = true;
  }

  // SEO: don't let Render hostname compete with the apex domain for HTML pages.
  if (RENDER_HOSTS.has(host) && !isApiOrInfraPath(pathOnly)) {
    targetHost = CANONICAL_HOST;
    targetProto = "https";
    redirect = true;
  }

  // Prefer no trailing slash (except "/") to match Vercel SPA + sitemap locs.
  let targetUrl = req.originalUrl || pathOnly;
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    const qIndex = targetUrl.indexOf("?");
    const pathPart = qIndex >= 0 ? targetUrl.slice(0, qIndex) : targetUrl;
    const queryPart = qIndex >= 0 ? targetUrl.slice(qIndex) : "";
    targetUrl = `${pathPart.replace(/\/+$/, "")}${queryPart}`;
    redirect = true;
  }

  if (!redirect) return next();

  const destination = `${targetProto}://${targetHost}${targetUrl}`;
  res.set("Cache-Control", "public, max-age=3600");
  return res.redirect(301, destination);
}

module.exports = {
  canonicalHostMiddleware,
  CANONICAL_HOST,
  isApiOrInfraPath,
};
