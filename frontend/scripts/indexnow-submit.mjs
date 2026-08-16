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
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

const STATUS_HINT = {
  200: "OK — URLs accepted",
  202: "Accepted — queued",
  400: "Bad request — payload format",
  403: "Forbidden — key file missing or key mismatch (check keyLocation)",
  422: "Unprocessable — URL host mismatch or invalid URL in urlList",
  429: "Rate limited — retry later",
};

export async function postIndexNow(urls, { key, dryRun = DRY_RUN } = {}) {
  const resolvedKey = key || resolveIndexNowKey();
  if (!urls.length) {
    return { ok: true, status: 204, submitted: 0, skipped: true };
  }
  const payload = {
    host: INDEXNOW_HOST,
    key: resolvedKey,
    keyLocation: keyLocation(resolvedKey),
    urlList: urls,
  };
  if (dryRun) {
    console.log(`[dry-run] POST ${INDEXNOW_ENDPOINT} (${urls.length} urls)`);
    console.log(`[dry-run] keyLocation ${payload.keyLocation}`);
    return { ok: true, status: 200, submitted: urls.length, dryRun: true };
  }
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  const hint = STATUS_HINT[res.status] || "see IndexNow docs";
  const ok = res.status === 200 || res.status === 202;
  console.log(`IndexNow HTTP ${res.status} — ${hint} (${urls.length} urls)`);
  if (!ok && text) console.log(text.slice(0, 500));
  return { ok, status: res.status, text, submitted: ok ? urls.length : 0 };
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
