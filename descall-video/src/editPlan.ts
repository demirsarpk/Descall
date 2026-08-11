/**
 * Descall Reel v5 — clean UI + denser VO/captions
 * 32s @ 30fps = 960 frames
 * No confetti / pulse / orbit / beams / streaks / beat flash / geo / spinning rings.
 */
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 960; // 32s

export const EDIT_PLAN = [
  {
    id: "hook",
    from: 0,
    duration: 126, // 0–4.2s
    frame: "app-open-dm",
    lines: [
      { text: "Tired of Discord?", accent: "Discord", at: 8 },
      { text: "Discord, but different.", accent: "different", at: 68 },
    ],
  },
  {
    id: "product",
    from: 126,
    duration: 132, // 4.2–8.6s
    frame: "app-direct",
    lines: [
      { text: "Meet Descall.", accent: "Descall", at: 6 },
      { text: "Chat, voice, and video — free.", accent: "free", at: 64 },
    ],
  },
  {
    id: "feature-chat",
    from: 258,
    duration: 138, // 8.6–13.2s
    frame: "app-open-dm",
    lines: [
      { text: "Real conversations.", accent: "Real", at: 18 },
      { text: "Cosmetics that actually show.", accent: "show", at: 74 },
    ],
  },
  {
    id: "feature-social",
    from: 396,
    duration: 132, // 13.2–17.6s
    frame: "app-friends-2",
    lines: [
      { text: "Friends without the clutter.", accent: "Friends", at: 6 },
      { text: "HD calls in one tap.", accent: "calls", at: 70 },
    ],
  },
  {
    id: "feature-look",
    from: 528,
    duration: 132, // 17.6–22.0s
    frame: "app-appearance",
    lines: [
      { text: "Themes, frames, and titles.", accent: "Themes", at: 6 },
      { text: "Make your profile yours.", accent: "yours", at: 80 },
    ],
  },
  {
    id: "payoff",
    from: 660,
    duration: 138, // 22.0–26.6s
    frame: "m-discord-alt",
    lines: [
      { text: "No Nitro paywall.", accent: "Nitro", at: 6 },
      { text: "Free. Fast. Built for friends.", accent: "Free", at: 72 },
    ],
  },
  {
    id: "cta",
    from: 798,
    duration: 162, // 26.6–32.0s
    frame: "m-download",
    lines: [
      { text: "Start free today.", accent: "free", at: 20 },
      { text: "descall.com", accent: "descall.com", at: 84 },
    ],
  },
] as const;

export const BRAND = {
  bg: "#05040a",
  bg2: "#12101f",
  accent: "#8b9bff",
  accentHot: "#d0a4ff",
  text: "#ffffff",
  muted: "rgba(255,255,255,0.68)",
};
