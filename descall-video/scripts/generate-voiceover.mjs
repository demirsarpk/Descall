#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/audio/vo");
fs.mkdirSync(out, { recursive: true });

const VOICE = process.env.VO_VOICE || "en-US-AndrewNeural";
const edge = process.env.HOME + "/.local/bin/edge-tts";
const bin = fs.existsSync(edge) ? edge : "edge-tts";

const lines = [
  "Tired of Discord?",
  "Discord, but different.",
  "Meet Descall.",
  "Chat, voice, and video — free.",
  "Real conversations.",
  "Cosmetics that actually show.",
  "Friends without the clutter.",
  "HD calls in one tap.",
  "Themes, frames, and titles.",
  "Make your profile yours.",
  "No Nitro paywall.",
  "Free. Fast. Built for friends.",
  "Start free today.",
  "descall.com",
];

lines.forEach((text, i) => {
  const file = path.join(out, `line${String(i + 1).padStart(2, "0")}.mp3`);
  const rate = text.length > 28 ? "+8%" : "-5%";
  execSync(
    `${bin} --voice "${VOICE}" --rate="${rate}" --pitch="+0Hz" --text ${JSON.stringify(text)} --write-media "${file}"`,
    { stdio: "inherit" }
  );
  console.log("ok", path.basename(file), text);
});
