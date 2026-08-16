/**
 * Shared IndexNow key + URL list.
 * Key is public by protocol (hosted at /<KEY>.txt). Prefer INDEXNOW_KEY env;
 * fall back to the published public/*.txt file so local/CI works without secrets.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FRONTEND_ROOT = join(__dirname, "..");
export const PUBLIC_DIR = join(FRONTEND_ROOT, "public");
export const DIST_DIR = join(FRONTEND_ROOT, "dist");
export const REPO_ROOT = join(FRONTEND_ROOT, "..");

export const SITE_ORIGIN = String(process.env.SITE_ORIGIN || "https://descall.com").replace(/\/+$/, "");
export const INDEXNOW_HOST = new URL(SITE_ORIGIN).hostname;

const KEY_FILE_RE = /^[a-f0-9]{32,}\.txt$/i;

/** Files whose change means “resubmit the whole public sitemap”. */
const FULL_SITEMAP_PATHS = [
  "frontend/src/site/seoConfig.js",
  "frontend/src/site/sitemapCatalog.js",
  "frontend/src/site/MarketingApp.jsx",
  "frontend/src/site/localePaths.js",
  "frontend/src/site/seo/",
  "frontend/src/site/content/",
  "frontend/scripts/prerender-seo.mjs",
  "frontend/scripts/generate-seo-files.mjs",
  "frontend/index.html",
  "frontend/vercel.json",
];

/** Page source → public path(s). Used only for --changed when the blast radius is small. */
const PAGE_PATH_MAP = {
  "frontend/src/site/pages/HomePage.jsx": ["/", "/tr"],
  "frontend/src/site/pages/FeaturesPage.jsx": ["/features", "/tr/features"],
  "frontend/src/site/pages/FaqPage.jsx": ["/faq", "/tr/faq"],
  "frontend/src/site/pages/MarketingDownloadPage.jsx": ["/download", "/tr/download"],
  "frontend/src/site/pages/AboutPage.jsx": ["/about", "/tr/about"],
  "frontend/src/site/pages/ContactPage.jsx": ["/contact", "/tr/contact"],
  "frontend/src/site/pages/SecurityPage.jsx": ["/security", "/tr/security"],
  "frontend/src/site/pages/PrivacyPage.jsx": ["/privacy"],
  "frontend/src/site/pages/TermsPage.jsx": ["/terms"],
  "frontend/src/site/pages/StatusPage.jsx": ["/status"],
  "frontend/src/site/pages/AlternativesPage.jsx": ["/alternatives"],
  "frontend/src/site/pages/CompareDiscordPage.jsx": ["/compare/discord", "/tr/compare/discord"],
  "frontend/src/site/pages/DiscordAlternativePage.jsx": ["/discord-alternative"],
  "frontend/src/site/pages/DiscordAlternativeTurkeyPage.jsx": ["/discord-alternative-turkey"],
  "frontend/src/site/pages/DiscordAlternativeGamersPage.jsx": ["/best-discord-alternative-for-gamers"],
  "frontend/src/site/pages/DiscordAlternativeNichePage.jsx": [
    "/discord-alternative-for-communities",
    "/discord-alternative-for-lfg",
    "/discord-alternative-for-voice-chat",
    "/discord-alternative-for-friends",
    "/apps-like-discord",
    "/discord-replacement",
  ],
  "frontend/src/site/pages/BlogIndexPage.jsx": ["/blog"],
  "frontend/src/site/pages/BlogPostPage.jsx": ["/blog"],
};

export function resolveIndexNowKey() {
  const fromEnv = String(process.env.INDEXNOW_KEY || "").trim();
  if (fromEnv) {
    if (!/^[a-f0-9-]{32,}$/i.test(fromEnv)) {
      throw new Error("INDEXNOW_KEY must be 32+ hex/UUID characters");
    }
    return fromEnv.replace(/-/g, "").toLowerCase();
  }
  if (existsSync(PUBLIC_DIR)) {
    const hit = readdirSync(PUBLIC_DIR).find((name) => KEY_FILE_RE.test(name));
    if (hit) {
      const body = readFileSync(join(PUBLIC_DIR, hit), "utf8").trim();
      const fromName = hit.replace(/\.txt$/i, "");
      if (body && body === fromName) return body;
      if (body) return body;
      return fromName;
    }
  }
  throw new Error(
    "INDEXNOW_KEY is not set and no public/<key>.txt verification file was found",
  );
}

export function keyLocation(key = resolveIndexNowKey()) {
  return `${SITE_ORIGIN}/${key}.txt`;
}

/** POSIX text file: key + single trailing newline (matches live descall.com file). */
export function writeIndexNowKeyFiles(key = resolveIndexNowKey()) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const body = `${key}\n`;
  writeFileSync(join(PUBLIC_DIR, `${key}.txt`), body, "utf8");
  if (existsSync(DIST_DIR)) {
    writeFileSync(join(DIST_DIR, `${key}.txt`), body, "utf8");
  }
  return key;
}

export async function loadSitemapUrls() {
  const { indexingUrlQueue } = await import(
    pathToFileURL(join(FRONTEND_ROOT, "src/site/sitemapCatalog.js")).href
  );
  return indexingUrlQueue(SITE_ORIGIN);
}

function gitChangedFiles(before, after) {
  try {
    const out = execSync(`git diff --name-only ${before} ${after}`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

function touchesFullSitemap(file) {
  return FULL_SITEMAP_PATHS.some((p) => file === p || file.startsWith(p));
}

/**
 * --changed: map git diff → public URLs.
 * Unreliable/empty diff → null (caller should submit the full sitemap).
 */
export async function collectChangedUrls() {
  const before =
    process.env.INDEXNOW_GIT_BEFORE ||
    process.env.GITHUB_EVENT_BEFORE ||
    "HEAD~1";
  const after = process.env.INDEXNOW_GIT_AFTER || process.env.GITHUB_SHA || "HEAD";
  if (!before || /^0+$/.test(before)) return null;

  const files = gitChangedFiles(before, after);
  if (!files) return null;
  const relevant = files.filter((f) => f.startsWith("frontend/"));
  if (!relevant.length) return [];

  if (relevant.some(touchesFullSitemap)) return null;

  const paths = new Set();
  let mapped = false;
  for (const file of relevant) {
    const routes = PAGE_PATH_MAP[file];
    if (routes) {
      mapped = true;
      for (const p of routes) paths.add(p);
    }
  }
  if (!mapped) return null;

  const all = await loadSitemapUrls();
  const wanted = new Set(
    [...paths].map((p) => (p === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${p}`)),
  );
  return all.filter((u) => wanted.has(u));
}
