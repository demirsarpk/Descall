"use strict";

/**
 * Discord-parity permission bitfield + member permission resolution (Step 6).
 * Values mirror Discord's documented flags where practical.
 */
const Permissions = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 1n << 41n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSIONS: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n,
};

/** All known permission bits OR'd together (server owner / ADMINISTRATOR). */
const ALL_PERMISSIONS = Object.values(Permissions).reduce((acc, bit) => acc | bit, 0n);

/** Default @everyone permissions for a fresh server (Discord-like baseline). */
const EVERYONE_DEFAULT =
  Permissions.VIEW_CHANNEL |
  Permissions.SEND_MESSAGES |
  Permissions.EMBED_LINKS |
  Permissions.ATTACH_FILES |
  Permissions.READ_MESSAGE_HISTORY |
  Permissions.ADD_REACTIONS |
  Permissions.USE_EXTERNAL_EMOJIS |
  Permissions.CONNECT |
  Permissions.SPEAK |
  Permissions.USE_VAD |
  Permissions.STREAM |
  Permissions.CHANGE_NICKNAME |
  Permissions.CREATE_INSTANT_INVITE |
  Permissions.SEND_VOICE_MESSAGES;

function toPgBigint(value) {
  return String(typeof value === "bigint" ? value : BigInt(value || 0));
}

function fromPgBigint(value) {
  if (value == null) return 0n;
  return BigInt(value);
}

function hasPermission(bits, flag) {
  const b = typeof bits === "bigint" ? bits : fromPgBigint(bits);
  const f = typeof flag === "bigint" ? flag : Permissions[flag];
  if (f == null) return false;
  if ((b & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) return true;
  return (b & f) === f;
}

/**
 * Resolve effective permissions for a member.
 * Owner → all bits. Else OR(@everyone, assigned roles). ADMINISTRATOR → all.
 *
 * @param {object} supabase
 * @param {string} serverId
 * @param {string} userId
 * @returns {Promise<{ bits: bigint, isOwner: boolean, isMember: boolean }>}
 */
async function resolveMemberPermissions(supabase, serverId, userId) {
  const { data: server, error: sErr } = await supabase
    .from("servers")
    .select("id, owner_id")
    .eq("id", serverId)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!server) {
    return { bits: 0n, isOwner: false, isMember: false };
  }

  if (server.owner_id === userId) {
    return { bits: ALL_PERMISSIONS, isOwner: true, isMember: true };
  }

  const { data: membership, error: mErr } = await supabase
    .from("server_members")
    .select("user_id")
    .eq("server_id", serverId)
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership) {
    return { bits: 0n, isOwner: false, isMember: false };
  }

  const { data: roles, error: rErr } = await supabase
    .from("server_roles")
    .select("id, permissions, is_everyone")
    .eq("server_id", serverId);
  if (rErr) throw rErr;

  const { data: assigned, error: aErr } = await supabase
    .from("server_member_roles")
    .select("role_id")
    .eq("server_id", serverId)
    .eq("user_id", userId);
  if (aErr) throw aErr;

  const assignedIds = new Set((assigned || []).map((r) => r.role_id));
  let bits = 0n;
  for (const role of roles || []) {
    if (role.is_everyone || assignedIds.has(role.id)) {
      bits |= fromPgBigint(role.permissions);
    }
  }

  if ((bits & Permissions.ADMINISTRATOR) === Permissions.ADMINISTRATOR) {
    bits = ALL_PERMISSIONS;
  }

  return { bits, isOwner: false, isMember: true };
}

/** Compact flags object for API clients. */
function permissionsToFlags(bits) {
  const b = typeof bits === "bigint" ? bits : fromPgBigint(bits);
  const flags = {};
  for (const [key, flag] of Object.entries(Permissions)) {
    flags[key] = hasPermission(b, flag);
  }
  return flags;
}

module.exports = {
  Permissions,
  ALL_PERMISSIONS,
  EVERYONE_DEFAULT,
  toPgBigint,
  fromPgBigint,
  hasPermission,
  resolveMemberPermissions,
  permissionsToFlags,
};
