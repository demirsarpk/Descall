"use strict";

/**
 * Advanced server templates — roles, categories, text/voice/stage channels,
 * topics, slowmode, NSFW flags, and channel permission overrides.
 *
 * Used by POST /api/servers?templateId=...
 */

const {
  Permissions,
  EVERYONE_DEFAULT,
  toPgBigint,
} = require("./serverPermissions");

function orBits(...parts) {
  return parts.reduce((acc, p) => acc | (typeof p === "bigint" ? p : 0n), 0n);
}

function bits(...keys) {
  return keys.reduce((acc, key) => {
    const bit = Permissions[key];
    if (bit == null) throw new Error(`Unknown permission key: ${key}`);
    return acc | bit;
  }, 0n);
}

const MEMBER_BASE = EVERYONE_DEFAULT;

const MOD_PERMS = orBits(
  MEMBER_BASE,
  bits(
    "KICK_MEMBERS",
    "BAN_MEMBERS",
    "MANAGE_MESSAGES",
    "MUTE_MEMBERS",
    "DEAFEN_MEMBERS",
    "MOVE_MEMBERS",
    "MODERATE_MEMBERS",
    "MANAGE_NICKNAMES",
    "VIEW_AUDIT_LOG",
    "PRIORITY_SPEAKER",
    "MENTION_EVERYONE",
    "MANAGE_THREADS",
    "CREATE_PUBLIC_THREADS",
    "MANAGE_EVENTS",
    "CREATE_EVENTS"
  )
);

const ADMIN_PERMS = orBits(
  MOD_PERMS,
  bits(
    "MANAGE_CHANNELS",
    "MANAGE_GUILD",
    "MANAGE_ROLES",
    "MANAGE_WEBHOOKS",
    "MANAGE_EMOJIS_AND_STICKERS",
    "VIEW_GUILD_INSIGHTS",
    "ADMINISTRATOR"
  )
);

const HELPER_PERMS = orBits(
  MEMBER_BASE,
  bits("MANAGE_MESSAGES", "MUTE_MEMBERS", "MOVE_MEMBERS", "PRIORITY_SPEAKER", "MODERATE_MEMBERS")
);

const VIP_PERMS = orBits(MEMBER_BASE, bits("PRIORITY_SPEAKER", "STREAM", "MENTION_EVERYONE"));

/** @typedef {{ key: string, deny?: string[], allow?: string[] }} OverrideSpec */

/**
 * @typedef {object} TemplateDef
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} accent  hex color for UI
 * @property {string} icon    lucide icon name hint for UI
 * @property {string[]} highlights
 * @property {bigint} [everyonePermissions]
 * @property {string} [descriptionSeed]
 * @property {string} [rulesText]
 * @property {boolean} [communityEnabled]
 * @property {number} [verificationLevel]
 * @property {Array<{ name: string, color: number, hoist?: boolean, mentionable?: boolean, permissions: bigint }>} roles
 * @property {Array<object>} categories  nested channel trees
 */

/** @type {TemplateDef[]} */
const TEMPLATES = [
  {
    id: "gaming",
    name: "Gaming hub",
    description:
      "Squad-ready layout with LFG, game chats, clip drops, staff ops, and ranked voice lobbies.",
    accent: "#22c55e",
    icon: "Gamepad2",
    highlights: ["LFG board", "Clip channel", "Staff roles", "Lobby voice"],
    descriptionSeed: "A gaming community — find teammates, drop clips, and hop into voice.",
    rulesText:
      "1) Be respectful.\n2) No hate, spam, or NSFW outside marked channels.\n3) Keep LFG posts clear (game + rank + region).\n4) Staff decisions are final.\n5) Have fun and play fair.",
    communityEnabled: true,
    verificationLevel: 1,
    everyonePermissions: orBits(MEMBER_BASE, bits("CREATE_INSTANT_INVITE")),
    roles: [
      {
        name: "Admin",
        color: 0xe74c3c,
        hoist: true,
        mentionable: false,
        permissions: ADMIN_PERMS,
      },
      {
        name: "Moderator",
        color: 0x3498db,
        hoist: true,
        mentionable: true,
        permissions: MOD_PERMS,
      },
      {
        name: "Helper",
        color: 0x2ecc71,
        hoist: true,
        mentionable: true,
        permissions: HELPER_PERMS,
      },
      {
        name: "VIP",
        color: 0xf1c40f,
        hoist: true,
        mentionable: false,
        permissions: VIP_PERMS,
      },
      {
        name: "Member",
        color: 0x95a5a6,
        hoist: false,
        mentionable: false,
        permissions: MEMBER_BASE,
      },
    ],
    categories: [
      {
        name: "Welcome",
        channels: [
          {
            name: "announcements",
            type: "text",
            topic: "Official server news and patch notes. Read-only for members.",
            slowmodeSeconds: 0,
            overrides: [
              { key: "@everyone", deny: ["SEND_MESSAGES", "ATTACH_FILES"] },
              { key: "Moderator", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES", "ATTACH_FILES"] },
              { key: "Admin", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES", "ATTACH_FILES"] },
            ],
          },
          {
            name: "rules",
            type: "text",
            topic: "Server rules — accept before chatting in community channels.",
            overrides: [{ key: "@everyone", deny: ["SEND_MESSAGES"] }],
          },
          {
            name: "introductions",
            type: "text",
            topic: "Say hi — game, rank, region, and what you play.",
            slowmodeSeconds: 10,
          },
        ],
      },
      {
        name: "Community",
        channels: [
          {
            name: "general",
            type: "text",
            topic: "Main hangout for anything gaming.",
          },
          {
            name: "looking-for-group",
            type: "text",
            topic: "LFG posts: game · rank · region · mic yes/no.",
            slowmodeSeconds: 15,
          },
          {
            name: "clips-and-highlights",
            type: "text",
            topic: "Drop your best clips and screenshots.",
            slowmodeSeconds: 5,
          },
          {
            name: "memes",
            type: "text",
            topic: "Keep it light. No harassment.",
            slowmodeSeconds: 5,
          },
        ],
      },
      {
        name: "Voice lobbies",
        channels: [
          { name: "Lobby", type: "voice" },
          { name: "Duo Queue", type: "voice" },
          { name: "Five Stack", type: "voice" },
          { name: "AFK / Chill", type: "voice" },
          {
            name: "Tournament Stage",
            type: "stage",
            topic: "Watch parties and tournament briefs.",
          },
        ],
      },
      {
        name: "Staff",
        channels: [
          {
            name: "staff-chat",
            type: "text",
            topic: "Private staff coordination.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Helper",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Admin",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
          {
            name: "mod-logs",
            type: "text",
            topic: "Moderation notes and case log.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Admin",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
          {
            name: "Staff Voice",
            type: "voice",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL", "CONNECT"] },
              { key: "Helper", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"] },
              { key: "Moderator", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
              { key: "Admin", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "valorant",
    name: "Valorant / competitive",
    description:
      "Ranked LFG, agent mains, VOD review, scrim voice, and coach/IGL roles ready to assign.",
    accent: "#ff4655",
    icon: "Crosshair",
    highlights: ["Ranked LFG", "VOD review", "Scrim rooms", "Coach role"],
    descriptionSeed: "Competitive Valorant community — ranked queues, VODs, and scrims.",
    rulesText:
      "1) No toxicity or throw accusations in public chat.\n2) LFG must include rank + role + region.\n3) Scrim rooms are for scheduled matches.\n4) Respect coaches and IGLs during review.\n5) Cheating = instant ban.",
    communityEnabled: true,
    verificationLevel: 1,
    everyonePermissions: MEMBER_BASE,
    roles: [
      {
        name: "Admin",
        color: 0xff4655,
        hoist: true,
        mentionable: false,
        permissions: ADMIN_PERMS,
      },
      {
        name: "Moderator",
        color: 0x0f1923,
        hoist: true,
        mentionable: true,
        permissions: MOD_PERMS,
      },
      {
        name: "Coach",
        color: 0x9b59b6,
        hoist: true,
        mentionable: true,
        permissions: orBits(HELPER_PERMS, bits("PRIORITY_SPEAKER", "MOVE_MEMBERS", "MENTION_EVERYONE")),
      },
      {
        name: "IGL",
        color: 0xe67e22,
        hoist: true,
        mentionable: true,
        permissions: orBits(MEMBER_BASE, bits("PRIORITY_SPEAKER", "MOVE_MEMBERS")),
      },
      {
        name: "Radiant+",
        color: 0xf1c40f,
        hoist: true,
        mentionable: false,
        permissions: VIP_PERMS,
      },
      {
        name: "Member",
        color: 0x7f8c8d,
        hoist: false,
        mentionable: false,
        permissions: MEMBER_BASE,
      },
    ],
    categories: [
      {
        name: "Info",
        channels: [
          {
            name: "announcements",
            type: "text",
            topic: "Patch notes, event nights, scrim schedules.",
            overrides: [
              { key: "@everyone", deny: ["SEND_MESSAGES"] },
              { key: "Moderator", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
              { key: "Admin", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
              { key: "Coach", allow: ["SEND_MESSAGES"] },
            ],
          },
          {
            name: "rules",
            type: "text",
            topic: "Competitive etiquette and LFG format.",
            overrides: [{ key: "@everyone", deny: ["SEND_MESSAGES"] }],
          },
          {
            name: "roles-and-ranks",
            type: "text",
            topic: "Ask staff for rank/role tags after verifying.",
            slowmodeSeconds: 20,
          },
        ],
      },
      {
        name: "Play",
        channels: [
          {
            name: "ranked-lfg",
            type: "text",
            topic: "Format: Rank · Roles · Region · Party size · Mic?",
            slowmodeSeconds: 20,
          },
          {
            name: "unrated-and-swiftplay",
            type: "text",
            topic: "Casual queues and warmups.",
            slowmodeSeconds: 10,
          },
          {
            name: "agent-mains",
            type: "text",
            topic: "Lineups, utilities, and agent tips.",
          },
          {
            name: "vod-review",
            type: "text",
            topic: "Share VODs for coach / peer review.",
            slowmodeSeconds: 30,
          },
          {
            name: "highlights",
            type: "text",
            topic: "Clutches, aces, and funny fails.",
            slowmodeSeconds: 5,
          },
        ],
      },
      {
        name: "Voice",
        channels: [
          { name: "Warmup", type: "voice" },
          { name: "Ranked Stack", type: "voice" },
          { name: "Duo / Trio", type: "voice" },
          { name: "Scrim A", type: "voice" },
          { name: "Scrim B", type: "voice" },
          {
            name: "VOD Review Stage",
            type: "stage",
            topic: "Live review sessions with coaches.",
          },
        ],
      },
      {
        name: "Staff",
        channels: [
          {
            name: "staff-ops",
            type: "text",
            topic: "Private ops for mods and coaches.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Coach",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Admin",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
          {
            name: "Staff Huddle",
            type: "voice",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL", "CONNECT"] },
              { key: "Coach", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "PRIORITY_SPEAKER"] },
              { key: "Moderator", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
              { key: "Admin", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "friends",
    name: "Friends hangout",
    description:
      "Cozy private group setup — lounge chat, plans, music nights, and always-on voice rooms.",
    accent: "#a78bfa",
    icon: "Users",
    highlights: ["Lounge chat", "Plans board", "Music night", "Always-on VC"],
    descriptionSeed: "A private hangout for friends — plans, memes, and late-night voice.",
    rulesText:
      "1) Keep drama out of the group.\n2) Ask before adding new people.\n3) No leaking private chats.\n4) Mute when AFK in shared voice.\n5) Be kind — this is our space.",
    communityEnabled: false,
    verificationLevel: 0,
    everyonePermissions: orBits(MEMBER_BASE, bits("CREATE_INSTANT_INVITE", "MENTION_EVERYONE")),
    roles: [
      {
        name: "Admin",
        color: 0xa78bfa,
        hoist: true,
        mentionable: false,
        permissions: ADMIN_PERMS,
      },
      {
        name: "Co-host",
        color: 0x60a5fa,
        hoist: true,
        mentionable: true,
        permissions: MOD_PERMS,
      },
      {
        name: "Bestie",
        color: 0xf472b6,
        hoist: true,
        mentionable: true,
        permissions: VIP_PERMS,
      },
      {
        name: "Friend",
        color: 0x94a3b8,
        hoist: false,
        mentionable: false,
        permissions: MEMBER_BASE,
      },
    ],
    categories: [
      {
        name: "Home",
        channels: [
          {
            name: "lounge",
            type: "text",
            topic: "Daily chat — memes welcome.",
          },
          {
            name: "plans",
            type: "text",
            topic: "Hangouts, watch parties, trips.",
            slowmodeSeconds: 5,
          },
          {
            name: "photos",
            type: "text",
            topic: "Share pics from hangs and trips.",
          },
          {
            name: "music-and-links",
            type: "text",
            topic: "Playlists, TikToks, and random links.",
            slowmodeSeconds: 5,
          },
        ],
      },
      {
        name: "Voice",
        channels: [
          { name: "Living Room", type: "voice" },
          { name: "Late Night", type: "voice" },
          { name: "Watch Party", type: "voice" },
          { name: "Study With Me", type: "voice" },
        ],
      },
      {
        name: "Private",
        channels: [
          {
            name: "hosts-only",
            type: "text",
            topic: "Admin / co-host planning.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Co-host",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Admin",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "community",
    name: "Community & creators",
    description:
      "Public-ready community with announcements, support, events, stage, and a full staff ladder.",
    accent: "#38bdf8",
    icon: "Megaphone",
    highlights: ["Announcements", "Support desk", "Events", "Stage"],
    descriptionSeed: "A creator-friendly community — announcements, support, and events.",
    rulesText:
      "1) Follow Discord/Descall ToS.\n2) No spam, scams, or self-promo outside #promote.\n3) Respect everyone — zero hate speech.\n4) Use the right channel for topics.\n5) Contact staff in #support for help.",
    communityEnabled: true,
    verificationLevel: 2,
    everyonePermissions: MEMBER_BASE,
    roles: [
      {
        name: "Owner Team",
        color: 0xe11d48,
        hoist: true,
        mentionable: false,
        permissions: ADMIN_PERMS,
      },
      {
        name: "Admin",
        color: 0xdc2626,
        hoist: true,
        mentionable: false,
        permissions: ADMIN_PERMS,
      },
      {
        name: "Moderator",
        color: 0x2563eb,
        hoist: true,
        mentionable: true,
        permissions: MOD_PERMS,
      },
      {
        name: "Event Host",
        color: 0xd97706,
        hoist: true,
        mentionable: true,
        permissions: orBits(
          HELPER_PERMS,
          bits("MANAGE_EVENTS", "CREATE_EVENTS", "MENTION_EVERYONE", "PRIORITY_SPEAKER")
        ),
      },
      {
        name: "Contributor",
        color: 0x059669,
        hoist: true,
        mentionable: false,
        permissions: VIP_PERMS,
      },
      {
        name: "Member",
        color: 0x64748b,
        hoist: false,
        mentionable: false,
        permissions: MEMBER_BASE,
      },
    ],
    categories: [
      {
        name: "Start here",
        channels: [
          {
            name: "announcements",
            type: "text",
            topic: "Official updates. Members cannot post here.",
            overrides: [
              { key: "@everyone", deny: ["SEND_MESSAGES", "ATTACH_FILES"] },
              { key: "Event Host", allow: ["SEND_MESSAGES"] },
              { key: "Moderator", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
              { key: "Admin", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
              { key: "Owner Team", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
            ],
          },
          {
            name: "rules",
            type: "text",
            topic: "Community guidelines.",
            overrides: [{ key: "@everyone", deny: ["SEND_MESSAGES"] }],
          },
          {
            name: "welcome",
            type: "text",
            topic: "New members introduce themselves here.",
            slowmodeSeconds: 15,
          },
          {
            name: "roles",
            type: "text",
            topic: "Ask for interest roles / contributor tags.",
            slowmodeSeconds: 20,
          },
        ],
      },
      {
        name: "Community",
        channels: [
          { name: "general", type: "text", topic: "Main conversation." },
          {
            name: "support",
            type: "text",
            topic: "Need help? Staff will respond here.",
            slowmodeSeconds: 10,
          },
          {
            name: "events",
            type: "text",
            topic: "Upcoming events and RSVPs.",
            slowmodeSeconds: 10,
          },
          {
            name: "promote",
            type: "text",
            topic: "Self-promo allowed here only — one post per day.",
            slowmodeSeconds: 60,
          },
          {
            name: "showcase",
            type: "text",
            topic: "Share your work, streams, and wins.",
            slowmodeSeconds: 10,
          },
        ],
      },
      {
        name: "Voice & stage",
        channels: [
          { name: "Community Lounge", type: "voice" },
          { name: "Collab Room", type: "voice" },
          {
            name: "Town Hall",
            type: "stage",
            topic: "AMAs, announcements, and live events.",
          },
        ],
      },
      {
        name: "Staff",
        channels: [
          {
            name: "staff-chat",
            type: "text",
            topic: "Internal staff discussion.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Event Host",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Admin",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Owner Team",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
          {
            name: "mod-queue",
            type: "text",
            topic: "Reports and open moderation cases.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Admin",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Owner Team",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
          {
            name: "Staff Voice",
            type: "voice",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL", "CONNECT"] },
              { key: "Event Host", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"] },
              { key: "Moderator", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
              { key: "Admin", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
              { key: "Owner Team", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "study",
    name: "Study & campus",
    description:
      "Focus rooms, subject channels, homework help, silent VC, and mentor roles for campus crews.",
    accent: "#34d399",
    icon: "GraduationCap",
    highlights: ["Focus rooms", "Homework help", "Silent VC", "Mentor role"],
    descriptionSeed: "Study together — focus sessions, homework help, and campus chat.",
    rulesText:
      "1) Keep study rooms distraction-free.\n2) No cheating / exam leaks.\n3) Share resources with credit.\n4) Use subject channels for on-topic help.\n5) Be supportive — everyone learns at their own pace.",
    communityEnabled: true,
    verificationLevel: 1,
    everyonePermissions: MEMBER_BASE,
    roles: [
      {
        name: "Admin",
        color: 0x059669,
        hoist: true,
        mentionable: false,
        permissions: ADMIN_PERMS,
      },
      {
        name: "Moderator",
        color: 0x0ea5e9,
        hoist: true,
        mentionable: true,
        permissions: MOD_PERMS,
      },
      {
        name: "Mentor",
        color: 0x8b5cf6,
        hoist: true,
        mentionable: true,
        permissions: orBits(HELPER_PERMS, bits("PRIORITY_SPEAKER", "MENTION_EVERYONE")),
      },
      {
        name: "Study Buddy",
        color: 0x14b8a6,
        hoist: true,
        mentionable: false,
        permissions: MEMBER_BASE,
      },
      {
        name: "Student",
        color: 0x94a3b8,
        hoist: false,
        mentionable: false,
        permissions: MEMBER_BASE,
      },
    ],
    categories: [
      {
        name: "Campus",
        channels: [
          {
            name: "announcements",
            type: "text",
            topic: "Deadlines, sessions, and campus news.",
            overrides: [
              { key: "@everyone", deny: ["SEND_MESSAGES"] },
              { key: "Mentor", allow: ["SEND_MESSAGES"] },
              { key: "Moderator", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
              { key: "Admin", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
            ],
          },
          {
            name: "rules",
            type: "text",
            topic: "Study community guidelines.",
            overrides: [{ key: "@everyone", deny: ["SEND_MESSAGES"] }],
          },
          {
            name: "introductions",
            type: "text",
            topic: "Major, year, and what you're studying.",
            slowmodeSeconds: 15,
          },
        ],
      },
      {
        name: "Study",
        channels: [
          { name: "general", type: "text", topic: "Off-topic campus chat." },
          {
            name: "homework-help",
            type: "text",
            topic: "Ask questions — show your work.",
            slowmodeSeconds: 15,
          },
          {
            name: "resources",
            type: "text",
            topic: "Notes, links, and study guides.",
            slowmodeSeconds: 10,
          },
          {
            name: "accountability",
            type: "text",
            topic: "Daily goals and check-ins.",
            slowmodeSeconds: 30,
          },
        ],
      },
      {
        name: "Focus voice",
        channels: [
          { name: "Silent Focus", type: "voice" },
          { name: "Pomodoro Room", type: "voice" },
          { name: "Group Project A", type: "voice" },
          { name: "Group Project B", type: "voice" },
          {
            name: "Office Hours",
            type: "stage",
            topic: "Mentor-led Q&A sessions.",
          },
        ],
      },
      {
        name: "Staff",
        channels: [
          {
            name: "mentor-room",
            type: "text",
            topic: "Mentors + mods coordinate help sessions.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Mentor",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Admin",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "streaming",
    name: "Streamer & content",
    description:
      "Go-live alerts, clip vault, collab board, VIP lounge, and mod/VIP roles for creator teams.",
    accent: "#f97316",
    icon: "Radio",
    highlights: ["Go-live channel", "Clip vault", "VIP lounge", "Mod team"],
    descriptionSeed: "Creator HQ — go-live pings, clips, collabs, and VIP perks.",
    rulesText:
      "1) Support the creator — no spoiling streams.\n2) No spoilers in #live-chat during VODs.\n3) Self-promo only in #collabs.\n4) VIPs set the vibe — don't abuse perks.\n5) Mods enforce chat rules during live.",
    communityEnabled: true,
    verificationLevel: 1,
    everyonePermissions: MEMBER_BASE,
    roles: [
      {
        name: "Creator",
        color: 0xf97316,
        hoist: true,
        mentionable: true,
        permissions: ADMIN_PERMS,
      },
      {
        name: "Moderator",
        color: 0x3b82f6,
        hoist: true,
        mentionable: true,
        permissions: MOD_PERMS,
      },
      {
        name: "Editor",
        color: 0xa855f7,
        hoist: true,
        mentionable: true,
        permissions: orBits(HELPER_PERMS, bits("ATTACH_FILES", "MANAGE_MESSAGES")),
      },
      {
        name: "VIP",
        color: 0xeab308,
        hoist: true,
        mentionable: true,
        permissions: VIP_PERMS,
      },
      {
        name: "Subscriber",
        color: 0x22c55e,
        hoist: true,
        mentionable: false,
        permissions: orBits(MEMBER_BASE, bits("STREAM")),
      },
      {
        name: "Viewer",
        color: 0x94a3b8,
        hoist: false,
        mentionable: false,
        permissions: MEMBER_BASE,
      },
    ],
    categories: [
      {
        name: "Broadcast",
        channels: [
          {
            name: "announcements",
            type: "text",
            topic: "Schedule and big drops.",
            overrides: [
              { key: "@everyone", deny: ["SEND_MESSAGES"] },
              { key: "Editor", allow: ["SEND_MESSAGES", "ATTACH_FILES"] },
              { key: "Moderator", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES"] },
              { key: "Creator", allow: ["SEND_MESSAGES", "MANAGE_MESSAGES", "ATTACH_FILES"] },
            ],
          },
          {
            name: "go-live",
            type: "text",
            topic: "Live notifications only.",
            overrides: [
              { key: "@everyone", deny: ["SEND_MESSAGES"] },
              { key: "Moderator", allow: ["SEND_MESSAGES"] },
              { key: "Creator", allow: ["SEND_MESSAGES"] },
            ],
          },
          {
            name: "rules",
            type: "text",
            topic: "Chat rules for streams and VODs.",
            overrides: [{ key: "@everyone", deny: ["SEND_MESSAGES"] }],
          },
        ],
      },
      {
        name: "Community",
        channels: [
          { name: "general", type: "text", topic: "Hang with the community." },
          {
            name: "live-chat",
            type: "text",
            topic: "Active during streams — keep spoilers out.",
            slowmodeSeconds: 3,
          },
          {
            name: "clips",
            type: "text",
            topic: "Best moments from streams.",
            slowmodeSeconds: 10,
          },
          {
            name: "collabs",
            type: "text",
            topic: "Collab requests and shoutouts.",
            slowmodeSeconds: 30,
          },
          {
            name: "suggestions",
            type: "text",
            topic: "Content ideas for the creator.",
            slowmodeSeconds: 20,
          },
        ],
      },
      {
        name: "VIP",
        channels: [
          {
            name: "vip-lounge",
            type: "text",
            topic: "Perks chat for VIP / Subscriber.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Subscriber",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "VIP",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "ATTACH_FILES"],
              },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Creator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
          {
            name: "VIP Voice",
            type: "voice",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL", "CONNECT"] },
              { key: "Subscriber", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"] },
              { key: "VIP", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "STREAM"] },
              { key: "Moderator", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
              { key: "Creator", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
            ],
          },
        ],
      },
      {
        name: "Voice",
        channels: [
          { name: "Waiting Room", type: "voice" },
          { name: "Collab VC", type: "voice" },
          {
            name: "After Party",
            type: "stage",
            topic: "Post-stream hangouts and AMAs.",
          },
        ],
      },
      {
        name: "Team",
        channels: [
          {
            name: "mod-chat",
            type: "text",
            topic: "Moderation during live.",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL"] },
              {
                key: "Editor",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Moderator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
              {
                key: "Creator",
                allow: ["VIEW_CHANNEL", "SEND_MESSAGES", "MANAGE_MESSAGES", "READ_MESSAGE_HISTORY"],
              },
            ],
          },
          {
            name: "Team Voice",
            type: "voice",
            overrides: [
              { key: "@everyone", deny: ["VIEW_CHANNEL", "CONNECT"] },
              { key: "Editor", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"] },
              { key: "Moderator", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
              { key: "Creator", allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "MUTE_MEMBERS"] },
            ],
          },
        ],
      },
    ],
  },
];

const BLANK_ID = "blank";

function listTemplateSummaries() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    accent: t.accent,
    icon: t.icon,
    highlights: t.highlights,
    roleCount: (t.roles || []).length + 1, // + @everyone
    channelCount: countChannels(t),
    categoryCount: (t.categories || []).length,
  }));
}

function countChannels(template) {
  let n = 0;
  for (const cat of template.categories || []) {
    n += 1; // category itself
    n += (cat.channels || []).length;
  }
  return n;
}

function getTemplate(id) {
  const key = String(id || "").trim().toLowerCase();
  if (!key || key === BLANK_ID || key === "scratch" || key === "from_scratch") {
    return null; // blank
  }
  return TEMPLATES.find((t) => t.id === key) || undefined;
}

function cleanTextChannelName(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function cleanOtherChannelName(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
}

function permListToBits(list) {
  if (!Array.isArray(list) || !list.length) return 0n;
  return bits(...list);
}

/**
 * Seed roles, channels, overrides, and optional server metadata for a template.
 * @returns {Promise<{ roles: object[], channels: object[], everyoneRole: object }>}
 */
async function seedServerFromTemplate(supabase, { serverId, template, deleteServerCascade }) {
  if (!template) {
    // Blank: @everyone only, no channels
    const { data: everyoneRole, error: rErr } = await supabase
      .from("server_roles")
      .insert({
        server_id: serverId,
        name: "@everyone",
        color: 0,
        position: 0,
        permissions: toPgBigint(EVERYONE_DEFAULT),
        hoist: false,
        mentionable: false,
        is_everyone: true,
      })
      .select("*")
      .single();
    if (rErr) {
      await deleteServerCascade(serverId);
      throw rErr;
    }
    return { roles: [everyoneRole], channels: [], everyoneRole };
  }

  // Optional server metadata
  const serverPatch = {};
  if (template.descriptionSeed) serverPatch.description = template.descriptionSeed.slice(0, 500);
  if (template.rulesText) serverPatch.rules_text = String(template.rulesText).slice(0, 4000);
  if (typeof template.communityEnabled === "boolean") {
    serverPatch.community_enabled = template.communityEnabled;
  }
  if (typeof template.verificationLevel === "number") {
    serverPatch.verification_level = template.verificationLevel;
  }
  if (Object.keys(serverPatch).length) {
    const { error: patchErr } = await supabase.from("servers").update(serverPatch).eq("id", serverId);
    if (patchErr) {
      // Non-fatal if columns missing on older DBs — log and continue
      console.warn("[serverTemplates] server patch skipped:", patchErr.message);
    }
  }

  const everyonePerms = template.everyonePermissions || EVERYONE_DEFAULT;
  const { data: everyoneRole, error: rErr } = await supabase
    .from("server_roles")
    .insert({
      server_id: serverId,
      name: "@everyone",
      color: 0,
      position: 0,
      permissions: toPgBigint(everyonePerms),
      hoist: false,
      mentionable: false,
      is_everyone: true,
    })
    .select("*")
    .single();
  if (rErr) {
    await deleteServerCascade(serverId);
    throw rErr;
  }

  // Roles: highest listed first → highest position numbers
  const roleDefs = template.roles || [];
  const roleRows = [];
  for (let i = 0; i < roleDefs.length; i += 1) {
    const def = roleDefs[i];
    const position = roleDefs.length - i; // Admin highest
    const { data: role, error } = await supabase
      .from("server_roles")
      .insert({
        server_id: serverId,
        name: String(def.name).slice(0, 100),
        color: Number(def.color) || 0,
        position,
        permissions: toPgBigint(def.permissions || MEMBER_BASE),
        hoist: Boolean(def.hoist),
        mentionable: Boolean(def.mentionable),
        is_everyone: false,
      })
      .select("*")
      .single();
    if (error) {
      await deleteServerCascade(serverId);
      throw error;
    }
    roleRows.push(role);
  }

  const roleByName = new Map(roleRows.map((r) => [r.name, r]));
  roleByName.set("@everyone", everyoneRole);

  const channels = [];
  let position = 0;

  for (const cat of template.categories || []) {
    const { data: category, error: catErr } = await supabase
      .from("server_channels")
      .insert({
        server_id: serverId,
        name: cleanOtherChannelName(cat.name) || "Category",
        type: "category",
        position: position++,
      })
      .select("*")
      .single();
    if (catErr) {
      await deleteServerCascade(serverId);
      throw catErr;
    }
    channels.push(category);

    for (const ch of cat.channels || []) {
      const type = ["text", "voice", "stage", "category"].includes(ch.type) ? ch.type : "text";
      const name =
        type === "text" ? cleanTextChannelName(ch.name) : cleanOtherChannelName(ch.name);
      if (!name) continue;

      const row = {
        server_id: serverId,
        name,
        type,
        position: position++,
        parent_id: category.id,
        nsfw: Boolean(ch.nsfw),
      };
      if (type === "text" || type === "stage") {
        if (ch.topic) row.topic = String(ch.topic).slice(0, 1024);
      }
      if (type === "text" && ch.slowmodeSeconds != null) {
        row.slowmode_seconds = Math.max(0, Math.min(21600, Number(ch.slowmodeSeconds) || 0));
      }

      const { data: channel, error: chErr } = await supabase
        .from("server_channels")
        .insert(row)
        .select("*")
        .single();
      if (chErr) {
        await deleteServerCascade(serverId);
        throw chErr;
      }
      channels.push(channel);

      // Permission overrides
      for (const ov of ch.overrides || []) {
        const targetRole = roleByName.get(ov.key);
        if (!targetRole) continue;
        const allow = permListToBits(ov.allow);
        const deny = permListToBits(ov.deny);
        if (allow === 0n && deny === 0n) continue;
        const { error: ovErr } = await supabase.from("server_channel_overrides").upsert(
          {
            channel_id: channel.id,
            target_type: "role",
            target_id: targetRole.id,
            allow_permissions: toPgBigint(allow),
            deny_permissions: toPgBigint(deny),
          },
          { onConflict: "channel_id,target_type,target_id" }
        );
        if (ovErr) {
          console.warn("[serverTemplates] override failed:", ovErr.message);
        }
      }
    }
  }

  // Point rules_channel_id at #rules if present
  const rulesChannel = channels.find((c) => c.type === "text" && c.name === "rules");
  if (rulesChannel) {
    const { error: rulesErr } = await supabase
      .from("servers")
      .update({ rules_channel_id: rulesChannel.id })
      .eq("id", serverId);
    if (rulesErr) {
      console.warn("[serverTemplates] rules_channel_id skipped:", rulesErr.message);
    }
  }

  return {
    roles: [everyoneRole, ...roleRows],
    channels,
    everyoneRole,
  };
}

module.exports = {
  TEMPLATES,
  BLANK_ID,
  listTemplateSummaries,
  getTemplate,
  seedServerFromTemplate,
  countChannels,
};
