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
    { start: 0.0, end: 1.8, scene: "HOOK", copy: "Discord, but different." },
    { start: 1.8, end: 4.2, scene: "PRODUCT", copy: "Meet Descall." },
    { start: 4.2, end: 7.8, scene: "FEATURE CHAT", copy: "Cosmetics that show." },
    { start: 7.8, end: 11.2, scene: "FEATURE LFG", copy: "Valorant LFG built in." },
    { start: 11.2, end: 15.0, scene: "FEATURE LOOK", copy: "Make it yours." },
    { start: 15.0, end: 18.6, scene: "PAYOFF", copy: "Free. Fast. Yours." },
    { start: 18.6, end: 22.0, scene: "CTA", copy: "Start free at descall.com" },
  ],
  notes: [
    "No speech in source — captions are editorial burn-ins, not transcription.",
    "PWA banner cropped via camera zoom on DM scene.",
    "Dead time / empty navigations removed; stills used for intentional cuts.",
  ],
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(plan, null, 2));
console.log("Wrote", out);
console.log(JSON.stringify(plan.timeline, null, 2));
