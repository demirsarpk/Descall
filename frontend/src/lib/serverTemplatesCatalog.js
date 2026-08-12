/**
 * Create-server template cards (display metadata).
 * Backend seed source of truth: backend/lib/serverTemplates.js
 */

export const BLANK_TEMPLATE = {
  id: "blank",
  name: "Start from scratch",
  description: "Empty server with only @everyone — build channels and roles yourself.",
  accent: "#94a3b8",
  icon: "Sparkles",
  highlights: ["No channels", "@everyone only", "Full control"],
  roleCount: 1,
  channelCount: 0,
  categoryCount: 0,
};

export const SERVER_TEMPLATES = [
  {
    id: "gaming",
    name: "Gaming hub",
    description:
      "Squad-ready layout with LFG, game chats, clip drops, staff ops, and ranked voice lobbies.",
    accent: "#22c55e",
    icon: "Gamepad2",
    highlights: ["LFG board", "Clip channel", "Staff roles", "Lobby voice"],
    roleCount: 6,
    channelCount: 19,
    categoryCount: 4,
  },
  {
    id: "valorant",
    name: "Valorant / competitive",
    description:
      "Ranked LFG, agent mains, VOD review, scrim voice, and coach/IGL roles ready to assign.",
    accent: "#ff4655",
    icon: "Crosshair",
    highlights: ["Ranked LFG", "VOD review", "Scrim rooms", "Coach role"],
    roleCount: 7,
    channelCount: 20,
    categoryCount: 4,
  },
  {
    id: "friends",
    name: "Friends hangout",
    description:
      "Cozy private group setup — lounge chat, plans, music nights, and always-on voice rooms.",
    accent: "#a78bfa",
    icon: "Users",
    highlights: ["Lounge chat", "Plans board", "Music night", "Always-on VC"],
    roleCount: 5,
    channelCount: 12,
    categoryCount: 3,
  },
  {
    id: "community",
    name: "Community & creators",
    description:
      "Public-ready community with announcements, support, events, stage, and a full staff ladder.",
    accent: "#38bdf8",
    icon: "Megaphone",
    highlights: ["Announcements", "Support desk", "Events", "Stage"],
    roleCount: 7,
    channelCount: 19,
    categoryCount: 4,
  },
  {
    id: "study",
    name: "Study & campus",
    description:
      "Focus rooms, subject channels, homework help, silent VC, and mentor roles for campus crews.",
    accent: "#34d399",
    icon: "GraduationCap",
    highlights: ["Focus rooms", "Homework help", "Silent VC", "Mentor role"],
    roleCount: 6,
    channelCount: 17,
    categoryCount: 4,
  },
  {
    id: "streaming",
    name: "Streamer & content",
    description:
      "Go-live alerts, clip vault, collab board, VIP lounge, and mod/VIP roles for creator teams.",
    accent: "#f97316",
    icon: "Radio",
    highlights: ["Go-live channel", "Clip vault", "VIP lounge", "Mod team"],
    roleCount: 7,
    channelCount: 20,
    categoryCount: 5,
  },
];

export function getTemplateCard(id) {
  if (!id || id === "blank") return BLANK_TEMPLATE;
  return SERVER_TEMPLATES.find((t) => t.id === id) || null;
}
