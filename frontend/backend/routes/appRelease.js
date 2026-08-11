"use strict";

const express = require("express");

const router = express.Router();

const GITHUB_REPO = process.env.GITHUB_RELEASE_REPO || "demirsarpk/Descall";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Keep in sync with frontend/src/lib/desktopRelease.js when cutting releases. */
const FALLBACK_RELEASE = {
  tagName: "v2.6.2",
  version: "2.6.2",
  name: "2.6.2",
  publishedAt: new Date().toISOString(),
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v2.6.2`,
  windowsDownloadUrl: `https://github.com/${GITHUB_REPO}/releases/download/v2.6.2/Descall-Setup-2.6.2.exe`,
  // The Android APK filename is version-suffixed per release
  // (Descall-APK-vX.Y.Z.apk), so it cannot be guessed without a live asset
  // list. Send people to the releases page instead of a dead direct link.
  androidDownloadUrl: null,
  repo: GITHUB_REPO,
  fallback: true,
};

let cache = { at: 0, payload: null };
const CACHE_MS = 5 * 60 * 1000;

function pickWindowsExeUrl(release) {
  if (!release?.assets?.length) return null;

  const exes = release.assets.filter((a) => {
    const n = (a.name || "").toLowerCase();
    return n.endsWith(".exe") && !n.includes("portable") && !n.includes("blockmap");
  });

  // Prefer NSIS installer (Descall-Setup-*.exe) — never Portable
  const setupExact = exes.find((a) => {
    const n = (a.name || "").toLowerCase();
    return n.includes("setup");
  });
  if (setupExact?.browser_download_url) return setupExact.browser_download_url;

  const setupLoose = exes.find((a) => {
    const n = (a.name || "").toLowerCase();
    return n.includes("descall") && !n.includes("portable");
  });
  if (setupLoose?.browser_download_url) return setupLoose.browser_download_url;

  return exes[0]?.browser_download_url || null;
}

/** Android asset name is version-suffixed (Descall-APK-vX.Y.Z.apk) per the
 * release workflow, so it must be resolved from the live asset list. */
function pickAndroidApkUrl(release) {
  if (!release?.assets?.length) return null;
  const apk = release.assets.find((a) => (a.name || "").toLowerCase().endsWith(".apk"));
  return apk?.browser_download_url || null;
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Descall-Server",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_RELEASE_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function payloadFromRelease(release) {
  return {
    tagName: release.tag_name,
    version: String(release.tag_name || "").replace(/^v/i, ""),
    name: release.name,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    windowsDownloadUrl: pickWindowsExeUrl(release),
    androidDownloadUrl: pickAndroidApkUrl(release),
    repo: GITHUB_REPO,
    fallback: false,
  };
}

/** Public — used by landing page to avoid browser CORS to GitHub */
router.get("/latest-release", async (_req, res) => {
  try {
    if (cache.payload && Date.now() - cache.at < CACHE_MS) {
      res.set("Cache-Control", "public, max-age=120");
      return res.json(cache.payload);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let ghRes;
    try {
      ghRes = await fetch(GITHUB_API, { headers: githubHeaders(), signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (ghRes.ok) {
      const release = await ghRes.json();
      const payload = payloadFromRelease(release);
      if (!payload.windowsDownloadUrl) {
        payload.windowsDownloadUrl = FALLBACK_RELEASE.windowsDownloadUrl;
        payload.fallback = true;
      }
      cache = { at: Date.now(), payload };
      res.set("Cache-Control", "public, max-age=120");
      return res.json(payload);
    }

    // Rate limit / outage: still serve a working Setup download for Windows
    const rateRemaining = ghRes.headers.get("x-ratelimit-remaining");
    const bodyText = await ghRes.text().catch(() => "");
    console.warn(
      "[latest-release] GitHub API failed:",
      ghRes.status,
      rateRemaining !== null ? `rateRemaining=${rateRemaining}` : "",
      "— serving fallback",
      FALLBACK_RELEASE.tagName,
      bodyText.slice(0, 300)
    );
    if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN && !process.env.GITHUB_RELEASE_TOKEN) {
      console.warn(
        "[latest-release] No GITHUB_TOKEN/GH_TOKEN/GITHUB_RELEASE_TOKEN set — unauthenticated " +
        "GitHub API calls share a 60 req/hr limit across Render's egress IP pool and can be " +
        "exhausted by unrelated traffic. Set one of those env vars to raise it to 5000 req/hr."
      );
    }
    // Cached under the same CACHE_MS window as a successful lookup, so a
    // rate-limited GitHub API is retried at most once every 5 minutes.
    cache = { at: Date.now(), payload: FALLBACK_RELEASE };
    res.set("Cache-Control", "public, max-age=60");
    return res.json(FALLBACK_RELEASE);
  } catch (err) {
    console.warn("[latest-release] error:", err.message, "— serving fallback");
    res.set("Cache-Control", "public, max-age=60");
    return res.json(FALLBACK_RELEASE);
  }
});

module.exports = router;
