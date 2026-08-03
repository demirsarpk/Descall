"use strict";

const express = require("express");

const router = express.Router();

const GITHUB_REPO = process.env.GITHUB_RELEASE_REPO || "demirrsarppkurtlarr/Descall";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** Keep in sync with frontend/src/lib/desktopRelease.js when cutting releases. */
const FALLBACK_RELEASE = {
  tagName: "v2.5.35",
  version: "2.5.35",
  name: "2.5.35",
  publishedAt: new Date().toISOString(),
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v2.5.35`,
  windowsDownloadUrl: `https://github.com/${GITHUB_REPO}/releases/download/v2.5.35/Descall-Setup-2.5.35.exe`,
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

    const ghRes = await fetch(GITHUB_API, { headers: githubHeaders() });

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
    console.warn(
      "[latest-release] GitHub API failed:",
      ghRes.status,
      "— serving fallback",
      FALLBACK_RELEASE.tagName
    );
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
