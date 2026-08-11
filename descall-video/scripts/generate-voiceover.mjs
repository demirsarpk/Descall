#!/usr/bin/env node
/**
 * Generate AI voiceover that reads ONLY on-screen captions.
 * Requires: edge-tts (pip install edge-tts)
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/audio/vo");
fs.mkdirSync(out, { recursive: true });

const VOICE = process.env.VO_VOICE || "en-US-AndrewNeural";
const lines = [
  "Discord, but different.",
  "Meet Descall.",
  "Cosmetics that show.",
  "Friends. Calls. Done.",
  "Make it yours.",
  "Free. Fast. Yours.",
  "Start free at descall.com",
];

const edge = process.env.HOME + "/.local/bin/edge-tts";
const bin = fs.existsSync(edge) ? edge : "edge-tts";

lines.forEach((text, i) => {
  const file = path.join(out, `line${String(i + 1).padStart(2, "0")}.mp3`);
  execSync(
    `${bin} --voice "${VOICE}" --rate="-8%" --pitch="+0Hz" --text ${JSON.stringify(text)} --write-media "${file}"`,
    { stdio: "inherit" }
  );
  console.log("ok", file, text);
});

const schedule = [
  { file: "line01.mp3", start: 0.35, text: lines[0] },
  { file: "line02.mp3", start: 2.55, text: lines[1] },
  { file: "line03.mp3", start: 5.15, text: lines[2] },
  { file: "line04.mp3", start: 8.75, text: lines[3] },
  { file: "line05.mp3", start: 12.0, text: lines[4] },
  { file: "line06.mp3", start: 15.4, text: lines[5] },
  { file: "line07.mp3", start: 19.5, text: lines[6] },
];
fs.writeFileSync(path.join(out, "schedule.json"), JSON.stringify(schedule, null, 2));
console.log("Wrote schedule.json");
