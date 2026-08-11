/**
 * Descall Reel v4 — no camera zoom / no edge crop
 * 24s @ 30fps = 720 frames
 *
 * UI frames are always shown with object-fit: contain.
 * No zoom in, zoom out, or pan that clips edges.
 */
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 720; // 24s

export const EDIT_PLAN = [
  {
    id: "hook",
    label: "HOOK",
    from: 0,
    duration: 66,
    copy: "Discord, but different.",
    frame: "app-open-dm",
  },
  {
    id: "product",
    label: "PRODUCT",
    from: 66,
    duration: 78,
    copy: "Meet Descall.",
    frame: "app-direct",
  },
  {
    id: "feature-chat",
    label: "CHAT",
    from: 144,
    duration: 108,
    copy: "Cosmetics that show.",
    frame: "app-open-dm",
  },
  {
    id: "feature-social",
    label: "SOCIAL",
    from: 252,
    duration: 96,
    copy: "Friends. Calls. Done.",
    frame: "app-friends-2",
  },
  {
    id: "feature-look",
    label: "LOOK",
    from: 348,
    duration: 102,
    copy: "Make it yours.",
    frame: "app-appearance",
  },
  {
    id: "payoff",
    label: "PAYOFF",
    from: 450,
    duration: 120,
    copy: "Free. Fast. Yours.",
    frame: "m-discord-alt",
  },
  {
    id: "cta",
    label: "CTA",
    from: 570,
    duration: 150,
    copy: "Start free at descall.com",
    frame: "m-download",
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
