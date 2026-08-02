"use strict";

const express = require("express");

const router = express.Router();

const GITHUB_REPO = process.env.GITHUB_RELEASE_REPO || "demirrsarppkurtlarr/Descall";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

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

/** Public — used by landing page to avoid browser CORS to GitHub */
router.get("/latest-release", async (_req, res) => {
  try {
    const ghRes = await fetch(GITHUB_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "Descall-Server",
      },
    });

    if (ghRes.status === 404) {
      return res.status(404).json({
        error: "No published release found.",
        repo: GITHUB_REPO,
      });
    }

    if (!ghRes.ok) {
      const text = await ghRes.text().catch(() => "");
      return res.status(502).json({
        error: "Could not load release from GitHub.",
        status: ghRes.status,
        detail: text.slice(0, 200),
      });
    }

    const release = await ghRes.json();
    const windowsDownloadUrl = pickWindowsExeUrl(release);

    res.set("Cache-Control", "public, max-age=120");
    res.json({
      tagName: release.tag_name,
      version: String(release.tag_name || "").replace(/^v/i, ""),
      name: release.name,
      publishedAt: release.published_at,
      htmlUrl: release.html_url,
      windowsDownloadUrl,
      repo: GITHUB_REPO,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Release lookup failed." });
  }
});

module.exports = router;
