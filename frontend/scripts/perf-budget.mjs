#!/usr/bin/env node
/**
 * Marketing first-load JS budget checker.
 *
 * Counts only assets referenced by /features HTML (script + modulepreload),
 * which is what the browser downloads before interaction.
 *
 * Usage: node scripts/perf-budget.mjs [--max-kb 220]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const maxKbArg = process.argv.find((a) => a.startsWith("--max-kb="));
const maxKb = Number(
  maxKbArg?.split("=")[1] ||
    (process.argv.includes("--max-kb")
      ? process.argv[process.argv.indexOf("--max-kb") + 1]
      : 220)
);

function fileSize(rel) {
  const abs = path.join(distDir, rel.replace(/^\//, ""));
  if (!fs.existsSync(abs)) return 0;
  return fs.statSync(abs).size;
}

const htmlPath = path.join(distDir, "features", "index.html");
if (!fs.existsSync(htmlPath)) {
  console.error("Missing dist/features/index.html — run build:prod first");
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, "utf8");
const assets = new Set();
for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)) assets.add(m[1]);
for (const m of html.matchAll(/modulepreload[^>]+href="(\/assets\/[^"]+\.js)"/g)) assets.add(m[1]);

const rows = [...assets]
  .map((rel) => ({ rel, bytes: fileSize(rel) }))
  .filter((r) => r.bytes > 0)
  .sort((a, b) => b.bytes - a.bytes);

const total = rows.reduce((s, r) => s + r.bytes, 0);
const totalKb = total / 1024;

console.log("Marketing first-paint JS (/features HTML refs)\n");
for (const r of rows) {
  console.log(`${(r.bytes / 1024).toFixed(1).padStart(7)} KB  ${r.rel}`);
}
console.log("\nTotal:", `${totalKb.toFixed(1)} KB`, `(budget ${maxKb} KB)`);

const hasSeoStatic = /id="seo-static"[\s\S]*?<main/i.test(html);
const hasLoading = /\bLoading\b/.test(html);
const hasMotionPreload = [...assets].some((a) => a.includes("vendor-motion"));
const hasIconsPreload = [...assets].some((a) => a.includes("vendor-icons"));
console.log("seo-static main:", hasSeoStatic ? "yes" : "NO");
console.log("Loading word:", hasLoading ? "YES (bad)" : "no");
console.log("motion preload:", hasMotionPreload ? "YES (bad)" : "no");
console.log("icons preload:", hasIconsPreload ? "yes (warn)" : "no");

if (!hasSeoStatic || hasLoading || hasMotionPreload || totalKb > maxKb) {
  process.exitCode = 1;
} else {
  console.log("perf-budget: ok");
}
