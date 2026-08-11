#!/usr/bin/env node
/**
 * Generate premium caption cues for the reel.
 * If a voiceover/transcript exists, merge timings; otherwise use edit-plan copy.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const planPath = path.join(root, "src/captions/edit-plan.json");
const outJson = path.join(root, "src/captions/captions.json");
const outSrt = path.join(root, "src/captions/captions.srt");

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));

const captions = plan.timeline.map((t, i) => ({
  id: i + 1,
  start: t.start,
  end: Math.min(t.end - 0.15, t.end),
  text: t.copy,
  words: t.copy.split(" ").map((w, wi, arr) => {
    const span = (t.end - t.start) / arr.length;
    return { word: w, start: t.start + wi * span, end: t.start + (wi + 1) * span };
  }),
}));

fs.writeFileSync(outJson, JSON.stringify(captions, null, 2));

const toTs = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

const srt = captions
  .map((c) => `${c.id}\n${toTs(c.start)} --> ${toTs(c.end)}\n${c.text}\n`)
  .join("\n");
fs.writeFileSync(outSrt, srt);
console.log("Wrote", outJson, "and", outSrt);
