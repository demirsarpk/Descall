#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "output");
const finalOut = "/workspace/output/descall-reel-final.mp4";
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(finalOut), { recursive: true });

const target = process.argv[2] || path.join(outDir, "descall-reel-v1.mp4");

console.log("Rendering DescallReel →", target);
execSync(
  `npx remotion render src/index.ts DescallReel "${target}" --codec=h264 --crf=16 --pixel-format=yuv420p --image-format=jpeg --jpeg-quality=92`,
  { stdio: "inherit", cwd: root }
);

fs.copyFileSync(target, finalOut);
fs.copyFileSync(target, path.join("/opt/cursor/artifacts/descall-reel", path.basename(target)));
console.log("Copied final →", finalOut);
