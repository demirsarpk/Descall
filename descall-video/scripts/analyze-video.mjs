#!/usr/bin/env node
/**
 * Analyze source video + frames → write edit plan JSON.
 * Replace public/video/raw-source.mp4 and re-run to regenerate.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const video = path.join(root, "public/video/raw-source.mp4");
const framesDir = path.join(root, "public/images/frames");
const out = path.join(root, "src/captions/edit-plan.json");

function probe(file) {
  try {
    const raw = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,avg_frame_rate:format=duration -of json "${file}"`,
      { encoding: "utf8" }
    );
    return JSON.parse(raw);
  } catch (e) {
    return { error: String(e) };
  }
}

const frames = fs.existsSync(framesDir)
  ? fs.readdirSync(framesDir).filter((f) => f.endsWith(".png"))
  : [];

const plan = {
  generatedAt: new Date().toISOString(),
  source: {
    video: fs.existsSync(video) ? "public/video/raw-source.mp4" : null,
    probe: fs.existsSync(video) ? probe(video) : null,
    frames: frames.length,
    frameList: frames,
  },
  strongestMoments: [
    { id: "dm-descoin-gif", frame: "app-open-dm.png", reason: "DesCoin + GIF social proof" },
    { id: "chats-list", frame: "app-direct.png", reason: "Clean product chrome + neon ring" },
    { id: "lfg", frame: "app-play-2.png", reason: "Valorant LFG differentiator" },
    { id: "settings", frame: "app-appearance.png", reason: "Personalization depth" },
    { id: "seo-hook", frame: "m-discord-alt.png", reason: "Category positioning" },
  ],
  timeline: [
    { start: 0.0, end: 2.2, scene: "HOOK", copy: "Discord, but different." },
    { start: 2.2, end: 4.8, scene: "PRODUCT", copy: "Meet Descall." },
    { start: 4.8, end: 8.4, scene: "CHAT", copy: "Cosmetics that show." },
    { start: 8.4, end: 11.6, scene: "SOCIAL", copy: "Friends. Calls. Done." },
    { start: 11.6, end: 15.0, scene: "LOOK", copy: "Make it yours." },
    { start: 15.0, end: 19.0, scene: "PAYOFF", copy: "Free. Fast. Yours." },
    { start: 19.0, end: 24.0, scene: "CTA", copy: "Start free at descall.com" },
  ],
  notes: [
    "No speech in source — captions are editorial burn-ins, not transcription.",
    "Camera: micro Ken Burns only (≤6% scale) — no aggressive zoom.",
    "v3: ambient orbs, feature chips, accent rings, soft crossfades.",
  ],
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(plan, null, 2));
console.log("Wrote", out);
console.log(JSON.stringify(plan.timeline, null, 2));
