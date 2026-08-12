#!/usr/bin/env node
/**
 * Request indexing for important public pages until daily budgets are hit.
 *
 * Engines:
 *  1) IndexNow (Bing / Yandex / Seznam / Naver) — batch notify
 *  2) Google sitemap ping — refresh discovery of sitemap index + child tables
 *  3) Optional Google Indexing API — only when GOOGLE_INDEXING_CREDENTIALS_JSON is set
 *
 * Usage:
 *   node scripts/request-indexing.mjs
 *   node scripts/request-indexing.mjs --dry-run
 *   SITE_ORIGIN=https://descall.com node scripts/request-indexing.mjs
 */
import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const DIST_DIR = join(ROOT, "dist");
const STATE_PATH = join(ROOT, ".seo-indexing-state.json");

const DRY_RUN = process.argv.includes("--dry-run");
const SITE_ORIGIN = String(process.env.SITE_ORIGIN || "https://descall.com").replace(/\/+$/, "");
const INDEXNOW_HOST = new URL(SITE_ORIGIN).hostname;
const INDEXNOW_KEY = "4f463b15fd51f502c6bb73abbeb38e3c";

/** IndexNow practical daily budget (engine soft limit; stay under to avoid 429). */
const INDEXNOW_DAILY_LIMIT = Number(process.env.INDEXNOW_DAILY_LIMIT || 10000);
/** Google Indexing API free quota is typically ~200 URL notifications / day. */
const GOOGLE_INDEXING_DAILY_LIMIT = Number(process.env.GOOGLE_INDEXING_DAILY_LIMIT || 200);

const { indexingUrlQueue, SITEMAP_TABLES } = await import(
  pathToFileURL(join(ROOT, "src/site/sitemapCatalog.js")).href
);

function ensureIndexNowKeyFile() {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  const pubPath = join(PUBLIC_DIR, `${INDEXNOW_KEY}.txt`);
  writeFileSync(pubPath, `${INDEXNOW_KEY}\n`, "utf8");
  if (existsSync(DIST_DIR)) {
    writeFileSync(join(DIST_DIR, `${INDEXNOW_KEY}.txt`), `${INDEXNOW_KEY}\n`, "utf8");
  }
  return INDEXNOW_KEY;
}

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return { day: "", indexNowSubmitted: [], googleIndexingSubmitted: [] };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { day: "", indexNowSubmitted: [], googleIndexingSubmitted: [] };
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

async function submitIndexNow(key, urls) {
  if (!urls.length) return { ok: true, status: 204, submitted: 0 };
  const payload = {
    host: INDEXNOW_HOST,
    key,
    keyLocation: `${SITE_ORIGIN}/${key}.txt`,
    urlList: urls,
  };
  if (DRY_RUN) {
    console.log(`[dry-run] IndexNow ${urls.length} urls → ${SITE_ORIGIN}`);
    return { ok: true, status: 200, submitted: urls.length, dryRun: true };
  }
  const endpoints = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];
  let last = { ok: false, status: 0, text: "" };
  for (const endpoint of endpoints) {
    last = await postJson(endpoint, payload);
    console.log(`IndexNow ${endpoint} → HTTP ${last.status} (${urls.length} urls)`);
    if (last.ok || last.status === 202 || last.status === 200) {
      return { ...last, submitted: urls.length };
    }
  }
  return { ...last, submitted: 0 };
}

async function pingSitemapEngines(sitemapUrl) {
  // Google retired /ping; keep for logs. Bing still accepts sitemap ping.
  const targets = [
    ["Bing", `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`],
    ["Google", `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`],
  ];
  if (DRY_RUN) {
    for (const [name] of targets) console.log(`[dry-run] ${name} sitemap ping ${sitemapUrl}`);
    return { ok: true, status: 200, dryRun: true };
  }
  for (const [name, pingUrl] of targets) {
    try {
      const res = await fetch(pingUrl, { method: "GET", redirect: "follow" });
      console.log(`${name} sitemap ping → HTTP ${res.status} (${sitemapUrl})`);
    } catch (err) {
      console.warn(`${name} sitemap ping failed:`, err?.message || err);
    }
  }
  return { ok: true };
}

async function submitGoogleIndexingApi(urls) {
  const raw = process.env.GOOGLE_INDEXING_CREDENTIALS_JSON;
  if (!raw) {
    console.log("Google Indexing API skipped (no GOOGLE_INDEXING_CREDENTIALS_JSON).");
    return { submitted: 0, skipped: true };
  }
  if (DRY_RUN) {
    console.log(`[dry-run] Google Indexing API would submit ${urls.length} urls`);
    return { submitted: urls.length, dryRun: true };
  }
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    console.warn("Invalid GOOGLE_INDEXING_CREDENTIALS_JSON");
    return { submitted: 0, skipped: true };
  }
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claim}`;
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign(credentials.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    console.warn("Google OAuth token failed:", tokenRes.status, tokenJson);
    return { submitted: 0, error: true };
  }
  let submitted = 0;
  for (const url of urls) {
    const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    });
    if (res.ok) {
      submitted += 1;
      console.log(`Google Indexing OK ${url}`);
    } else {
      const text = await res.text().catch(() => "");
      console.warn(`Google Indexing fail ${res.status} ${url}: ${text.slice(0, 200)}`);
      if (res.status === 429 || res.status === 403) break;
    }
  }
  return { submitted };
}

async function main() {
  const key = ensureIndexNowKeyFile();
  const allUrls = indexingUrlQueue(SITE_ORIGIN);
  const day = todayKey();
  let state = loadState();
  if (state.day !== day) {
    state = { day, indexNowSubmitted: [], googleIndexingSubmitted: [] };
  }
  const alreadyIndexNow = new Set(state.indexNowSubmitted || []);
  const alreadyGoogle = new Set(state.googleIndexingSubmitted || []);

  const indexNowRemaining = Math.max(0, INDEXNOW_DAILY_LIMIT - alreadyIndexNow.size);
  const googleRemaining = Math.max(0, GOOGLE_INDEXING_DAILY_LIMIT - alreadyGoogle.size);

  const indexNowBatch = allUrls.filter((u) => !alreadyIndexNow.has(u)).slice(0, indexNowRemaining);
  const googleBatch = allUrls.filter((u) => !alreadyGoogle.has(u)).slice(0, googleRemaining);

  console.log(`Site: ${SITE_ORIGIN}`);
  console.log(`Index tables: ${SITEMAP_TABLES.map((t) => t.file).join(", ")}`);
  console.log(`Queue size: ${allUrls.length}`);
  console.log(
    `IndexNow budget today: ${alreadyIndexNow.size}/${INDEXNOW_DAILY_LIMIT} used → submitting ${indexNowBatch.length}`,
  );
  console.log(
    `Google Indexing budget today: ${alreadyGoogle.size}/${GOOGLE_INDEXING_DAILY_LIMIT} used → submitting ${googleBatch.length}`,
  );

  const CHUNK = 100;
  let indexNowOk = 0;
  for (let i = 0; i < indexNowBatch.length; i += CHUNK) {
    const chunk = indexNowBatch.slice(i, i + CHUNK);
    const result = await submitIndexNow(key, chunk);
    if (result.ok || result.status === 202 || result.dryRun) {
      indexNowOk += chunk.length;
      for (const u of chunk) alreadyIndexNow.add(u);
    } else {
      console.warn("IndexNow stopped after error:", result.status, result.text?.slice(0, 200));
      break;
    }
  }

  await pingSitemapEngines(`${SITE_ORIGIN}/sitemap.xml`);
  await pingSitemapEngines(`${SITE_ORIGIN}/sitemap-pages.xml`);
  for (const table of SITEMAP_TABLES) {
    await pingSitemapEngines(`${SITE_ORIGIN}/${table.file}`);
  }

  const googleResult = await submitGoogleIndexingApi(googleBatch);
  if (!googleResult.skipped && !googleResult.error) {
    for (const u of googleBatch.slice(0, googleResult.submitted || 0)) {
      alreadyGoogle.add(u);
    }
  }

  state = {
    day,
    indexNowSubmitted: [...alreadyIndexNow],
    googleIndexingSubmitted: [...alreadyGoogle],
    lastRunAt: new Date().toISOString(),
    lastIndexNowCount: indexNowOk,
    lastGoogleCount: googleResult.submitted || 0,
  };
  if (!DRY_RUN) saveState(state);

  console.log("---");
  console.log(`Done. IndexNow submitted this run: ${indexNowOk}`);
  console.log(`Google Indexing submitted this run: ${googleResult.submitted || 0}`);
  console.log(`Key file: ${SITE_ORIGIN}/${key}.txt`);
  console.log(`Sitemap index: ${SITE_ORIGIN}/sitemap.xml`);
  for (const table of SITEMAP_TABLES) {
    console.log(`  - ${SITE_ORIGIN}/${table.file} (${table.id})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
