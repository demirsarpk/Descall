# Descall Premium Reel (Remotion)

9:16 · 1080×1920 · 30fps Instagram/TikTok promo system for Descall.

## Quick start

```bash
npm install
node scripts/analyze-video.mjs
node scripts/generate-captions.mjs
npm run render
```

Final export: `/workspace/output/descall-reel-final.mp4` and `descall-video/output/`.

## Replace source footage

1. Drop a new raw recording at `public/video/raw-source.mp4` (or `.webm`).
2. Optionally refresh stills under `public/images/frames/` (1080×1920).
3. Re-run analyze → captions → render.
4. Tweak timings in `src/editPlan.ts`.

## Structure

```
src/
  components/   UIZoom, AnimatedText, Transition, Fonts, SoundEffect
  scenes/       Hook, ProductReveal, FeatureScene, CTA
  compositions/ DescallReel timeline
  captions/     edit-plan + captions
  audio/        (reserved)
scripts/        analyze-video, generate-captions, render, capture-*
public/         video, audio, images, fonts
```

## Demo capture

`scripts/capture-app.mjs` / `capture-pass2.mjs` / `record-raw.mjs` log in as the demo user and grab hi-DPI frames + a raw navigation webm.
