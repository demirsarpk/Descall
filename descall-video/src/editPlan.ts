/**
 * Descall Reel — Edit Plan (derived from source analysis)
 *
 * SOURCE:
 * - public/video/raw-source.mp4 (~24s navigation capture)
 * - public/images/frames/* (hi-res 1080x1920 stills)
 *
 * STRONGEST MOMENTS:
 * - DM with Sam: DesCoin unlock + "YOU ROCK" GIF (hook)
 * - Neon avatar ring + crown cosmetics
 * - Chats list (Sam / Nova)
 * - Play / LFG lobbies
 * - Discord-alternative marketing hero
 * - Download CTA
 *
 * REMOVED / AVOIDED:
 * - PWA install banner (cropped via zoom)
 * - Empty loading waits in raw video
 * - Redundant list ↔ list navigations
 *
 * TIMELINE @ 30fps (22.0s = 660 frames):
 * 0.00–1.80  HOOK          frames 0–54
 * 1.80–4.20  PRODUCT       frames 54–126
 * 4.20–7.80  FEATURE CHAT  frames 126–234
 * 7.80–11.2  FEATURE LFG   frames 234–336
 * 11.2–15.0  FEATURE LOOK  frames 336–450
 * 15.0–18.6  PAYOFF        frames 450–558
 * 18.6–22.0  CTA           frames 558–660
 */
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 660; // 22s

export const BEAT = 18; // ~100 BPM → 0.6s = 18f

export const EDIT_PLAN = [
  {
    id: "hook",
    label: "HOOK",
    from: 0,
    duration: 54,
    copy: "Discord, but different.",
    frame: "app-open-dm",
    zoom: { start: 1.35, end: 1.12, x: 0.5, y: 0.42 },
    sfx: ["impact", "whoosh"],
  },
  {
    id: "product",
    label: "PRODUCT REVEAL",
    from: 54,
    duration: 72,
    copy: "Meet Descall.",
    frame: "app-direct",
    zoom: { start: 1.18, end: 1.05, x: 0.55, y: 0.4 },
    sfx: ["whoosh", "confirm"],
  },
  {
    id: "feature-chat",
    label: "FEATURE · CHAT",
    from: 126,
    duration: 108,
    copy: "Chat that feels alive.",
    frame: "app-open-dm",
    zoom: { start: 1.08, end: 1.22, x: 0.5, y: 0.38 },
    sfx: ["click", "notif"],
  },
  {
    id: "feature-lfg",
    label: "FEATURE · LFG",
    from: 234,
    duration: 102,
    copy: "Friends. Calls. Done.",
    frame: "app-friends-2",
    zoom: { start: 1.14, end: 1.05, x: 0.58, y: 0.38 },
    sfx: ["whoosh", "click"],
  },
  {
    id: "feature-look",
    label: "FEATURE · LOOK",
    from: 336,
    duration: 114,
    copy: "Your look. Your rules.",
    frame: "app-appearance",
    zoom: { start: 1.1, end: 1.18, x: 0.5, y: 0.35 },
    sfx: ["whoosh", "confirm"],
  },
  {
    id: "payoff",
    label: "PAYOFF",
    from: 450,
    duration: 108,
    copy: "The free Discord alternative.",
    frame: "m-discord-alt",
    zoom: { start: 1.2, end: 1.05, x: 0.5, y: 0.35 },
    sfx: ["impact", "riser"],
  },
  {
    id: "cta",
    label: "CTA",
    from: 558,
    duration: 102,
    copy: "descall.com",
    frame: "m-download",
    zoom: { start: 1.08, end: 1.0, x: 0.5, y: 0.4 },
    sfx: ["impact", "confirm"],
  },
] as const;

export const BRAND = {
  bg: "#07060d",
  bg2: "#120f22",
  accent: "#7b8cff",
  accentHot: "#c084fc",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.72)",
};
