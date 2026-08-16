import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const appLayout = readFileSync(join(root, "app-layout.css"), "utf8");
const dima = readFileSync(join(root, "dimaai.css"), "utf8");
const mobile = readFileSync(join(root, "mobile.css"), "utf8");

assert(
  /\[data-view="play"\],\s*\n\.app-root\[data-view="dimaai"\]/.test(appLayout)
    || /\[data-view="dimaai"\][\s\S]{0,120}grid-template-columns:\s*var\(--nav-rail-width\)\s+1fr/.test(appLayout),
  "DimaAI must use the 2-column rail + workspace grid (not the default sidebar column)",
);

assert(
  /grid-template-columns:\s*minmax\(220px,\s*280px\)\s+minmax\(0,\s*1fr\)/.test(dima),
  "DimaAI inner chat column must be minmax(0, 1fr) so it can grow",
);

assert(
  /\[data-view="dimaai"\][\s\S]{0,80}grid-template-columns:\s*1fr\s*!important/.test(mobile),
  "Mobile DimaAI must be full-bleed like Play",
);

console.log("dimaai.layout.selftest.mjs: ok");
