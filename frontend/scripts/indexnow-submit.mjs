#!/usr/bin/env node
/**
 * Submit public Descall URLs to IndexNow (Bing / Yandex / Seznam / Naver).
 *
 * URL list comes from sitemapCatalog.js (same source as prerender + sitemaps).
 *
 *   node scripts/indexnow-submit.mjs
 *   node scripts/indexnow-submit.mjs --dry-run
 *   node scripts/indexnow-submit.mjs --changed
 *   INDEXNOW_KEY=… SITE_ORIGIN=https://descall.com node scripts/indexnow-submit.mjs
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  INDEXNOW_HOST,
  SITE_ORIGIN,
  collectChangedUrls,
  keyLocation,
  loadSitemapUrls,
  resolveIndexNowKey,
  writeIndexNowKeyFiles,
} from "./indexnow-config.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const CHANGED_ONLY = process.argv.includes("--changed");

/** Shared hub + Bing's own endpoint (Bing Webmaster IndexNow Insights). */
const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
];

const STATUS_HINT = {
  200: "OK — URLs accepted",
  202: "Accepted — queued",
  400: "Bad request — payload format",
  403: "Forbidden — key file missing or key mismatch (check keyLocation)",
  422: "Unprocessable — URL host mismatch or invalid URL in urlList",
  429: "Rate limited — retry later",
};

function buildPayload(urls, key) {
  return {
    host: INDEXNOW_HOST,
    key,
    keyLocation: keyLocation(key),
    urlList: urls,
  };
}

async function postToEndpoint(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  const hint = STATUS_HINT[res.status] || "see IndexNow docs";
  const ok = res.status === 200 || res.status === 202;
  console.log(`IndexNow ${endpoint} → HTTP ${res.status} — ${hint} (${payload.urlList.length} urls)`);
  if (!ok && text) console.log(text.slice(0, 500));
  return { ok, status: res.status, text, endpoint };
}

/**
 * Bing wizard step 3 also documents a single-URL GET:
 * https://www.bing.com/indexnow?url=…&key=…&keyLocation=…
 */
export async function getIndexNow(url, { key, dryRun = DRY_RUN } = {}) {
  const resolvedKey = key || resolveIndexNowKey();
  const endpoint = new URL("https://www.bing.com/indexnow");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("key", resolvedKey);
  endpoint.searchParams.set("keyLocation", keyLocation(resolvedKey));
  if (dryRun) {
    console.log(`[dry-run] GET ${endpoint}`);
    return { ok: true, status: 200, dryRun: true };
  }
  const res = await fetch(endpoint, { method: "GET", redirect: "follow" });
  const text = await res.text().catch(() => "");
  const hint = STATUS_HINT[res.status] || "see IndexNow docs";
  const ok = res.status === 200 || res.status === 202;
  console.log(`IndexNow GET bing.com → HTTP ${res.status} — ${hint} (${url})`);
  if (!ok && text) console.log(text.slice(0, 500));
  return { ok, status: res.status, text };
}

export async function postIndexNow(urls, { key, dryRun = DRY_RUN } = {}) {
  const resolvedKey = key || resolveIndexNowKey();
  if (!urls.length) {
    return { ok: true, status: 204, submitted: 0, skipped: true };
  }
  const payload = buildPayload(urls, resolvedKey);
  if (dryRun) {
    for (const endpoint of INDEXNOW_ENDPOINTS) {
      console.log(`[dry-run] POST ${endpoint} (${urls.length} urls)`);
    }
    console.log(`[dry-run] keyLocation ${payload.keyLocation}`);
    return { ok: true, status: 200, submitted: urls.length, dryRun: true };
  }
  const results = [];
  for (const endpoint of INDEXNOW_ENDPOINTS) {
    results.push(await postToEndpoint(endpoint, payload));
  }
  const ok = results.some((r) => r.ok);
  const status = results.find((r) => r.ok)?.status || results[0]?.status || 0;
  return { ok, status, results, submitted: ok ? urls.length : 0 };
}

async function main() {
  const key = writeIndexNowKeyFiles();
  let urls = await loadSitemapUrls();
  let mode = "full sitemap catalog";

  if (CHANGED_ONLY) {
    const changed = await collectChangedUrls();
    if (changed === null) {
      mode = "full sitemap (changed-set unreliable — fallback)";
    } else if (changed.length === 0) {
      console.log("IndexNow: no public URL changes in this deploy — skip");
      console.log(`Key file: ${keyLocation(key)}`);
      return;
    } else {
      urls = changed;
      mode = "changed URLs only";
    }
  }

  console.log(`Site: ${SITE_ORIGIN}`);
  console.log(`Mode: ${mode}`);
  console.log(`URLs: ${urls.length}`);
  console.log(`Key file: ${keyLocation(key)}`);

  const result = await postIndexNow(urls, { key });
  const homepage = urls.find((u) => u === `${SITE_ORIGIN}/`) || urls[0];
  if (homepage && !result.skipped) {
    await getIndexNow(homepage, { key });
  }
  if (!result.ok && !result.dryRun && !result.skipped) {
    process.exitCode = 1;
  }
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
