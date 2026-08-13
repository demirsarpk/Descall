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
  Permissions.REQUEST_TO_SPEAK |
  Permissions.USE_VAD |
  Permissions.STREAM |
  Permissions.CHANGE_NICKNAME |
  Permissions.USE_APPLICATION_COMMANDS |
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

async function getMemberHighestPosition(supabase, serverId, userId) {
  if (!serverId || !userId) return 0;

  // Prefer a plain join shape — nested `role:role_id(...)` embeds are flaky
  // across PostgREST versions and silently returned position 0 before.
  const { data: assigned, error } = await supabase
    .from("server_member_roles")
    .select("role_id")
    .eq("server_id", serverId)
    .eq("user_id", userId);
  if (error) throw error;
  const roleIds = (assigned || []).map((r) => r.role_id).filter(Boolean);
  if (!roleIds.length) return 0;

  const { data: roles, error: rErr } = await supabase
    .from("server_roles")
    .select("id, position")
    .eq("server_id", serverId)
    .in("id", roleIds);
  if (rErr) throw rErr;

  return (roles || []).reduce((top, row) => {
    const pos = Number(row?.position);
    return Number.isFinite(pos) ? Math.max(top, pos) : top;
  }, 0);
}

function canModerateTarget(
  actorResolved,
  targetResolved,
  { actorPos = 0, targetPos = 0, actorIsOwner = false, targetIsOwner = false } = {}
) {
  if (!actorResolved?.isMember || !targetResolved?.isMember) return false;
  if (targetIsOwner || targetResolved?.isOwner) return false;
  if (actorIsOwner || actorResolved?.isOwner) return true;
  return Number(actorPos) > Number(targetPos);
}

async function assertHierarchy(supabase, serverId, actorId, targetUserId) {
  const [actorResolved, targetResolved, actorPos, targetPos] = await Promise.all([
    resolveMemberPermissions(supabase, serverId, actorId),
    resolveMemberPermissions(supabase, serverId, targetUserId),
    getMemberHighestPosition(supabase, serverId, actorId),
    getMemberHighestPosition(supabase, serverId, targetUserId),
  ]);

  if (!targetResolved.isMember) {
    const err = new Error("Member not found in this server.");
    err.status = 404;
    err.code = "MEMBER_NOT_FOUND";
    throw err;
  }

  if (
    !canModerateTarget(actorResolved, targetResolved, {
      actorPos,
      targetPos,
      actorIsOwner: actorResolved.isOwner,
      targetIsOwner: targetResolved.isOwner,
    })
  ) {
    const err = new Error("You cannot manage a member with an equal or higher role.");
    err.status = 403;
    err.code = "HIERARCHY";
    throw err;
  }

  return { actorResolved, targetResolved, actorPos, targetPos };
}

async function assertCanManageRole(supabase, serverId, actorId, role) {
  if (!role) {
    const err = new Error("Role not found.");
    err.status = 404;
    err.code = "ROLE_NOT_FOUND";
    throw err;
  }

  const actorResolved = await resolveMemberPermissions(supabase, serverId, actorId);
  if (!actorResolved.isMember) {
    const err = new Error("You are not a member of this server.");
    err.status = 403;
    throw err;
  }
  if (actorResolved.isOwner) return { actorResolved, actorPos: Number.MAX_SAFE_INTEGER };

  const actorPos = await getMemberHighestPosition(supabase, serverId, actorId);
  const rolePos = Number(role.position) || 0;
  if (rolePos >= actorPos) {
    const err = new Error("You cannot manage a role at or above your highest role.");
    err.status = 403;
    err.code = "HIERARCHY";
    throw err;
  }
  return { actorResolved, actorPos };
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

/**
 * Apply Discord-style channel overwrites onto base member bits.
 * Order: @everyone role override → other role overrides (by position) → member override.
 * Deny clears bits, then allow sets bits.
 */
function applyOverwrites(baseBits, overwrites, { everyoneRoleId, memberRoleIds, userId }) {
  let bits = typeof baseBits === "bigint" ? baseBits : fromPgBigint(baseBits);
  const list = Array.isArray(overwrites) ? overwrites : [];

  const applyOne = (row) => {
    if (!row) return;
    const deny = fromPgBigint(row.deny_permissions);
    const allow = fromPgBigint(row.allow_permissions);
    bits = (bits & ~deny) | allow;
  };

  if (everyoneRoleId) {
    applyOne(
      list.find((o) => o.target_type === "role" && String(o.target_id) === String(everyoneRoleId))
    );
  }

  const roleOverrides = list
    .filter(
      (o) =>
        o.target_type === "role" &&
        String(o.target_id) !== String(everyoneRoleId || "") &&
        memberRoleIds.has(String(o.target_id))
    )
    .sort((a, b) => (Number(a._position) || 0) - (Number(b._position) || 0));
  for (const row of roleOverrides) applyOne(row);

  applyOne(list.find((o) => o.target_type === "member" && String(o.target_id) === String(userId)));
  return bits;
}

/**
 * Resolve effective permissions for a member in a specific channel.
 * Owner / ADMINISTRATOR ignore channel denies.
 * Discord-like: category overwrites apply first, then the channel's own overwrites.
 */
async function resolveChannelPermissions(supabase, serverId, userId, channelId) {
  const base = await resolveMemberPermissions(supabase, serverId, userId);
  if (!base.isMember) {
    return { ...base, channelId, overwritesApplied: false };
  }
  if (base.isOwner || hasPermission(base.bits, Permissions.ADMINISTRATOR)) {
    return { bits: ALL_PERMISSIONS, isOwner: base.isOwner, isMember: true, channelId, overwritesApplied: false };
  }

  const { data: channelRow, error: chErr } = await supabase
    .from("server_channels")
    .select("id, parent_id")
    .eq("id", channelId)
    .eq("server_id", serverId)
    .maybeSingle();
  if (chErr) throw chErr;

  const parentId = channelRow?.parent_id || null;
  const overrideChannelIds = parentId ? [parentId, channelId] : [channelId];

  const [{ data: overrides, error: oErr }, { data: roles, error: rErr }, { data: assigned, error: aErr }] =
    await Promise.all([
      supabase
        .from("server_channel_overrides")
        .select("id, channel_id, target_type, target_id, allow_permissions, deny_permissions")
        .in("channel_id", overrideChannelIds),
      supabase
        .from("server_roles")
        .select("id, position, is_everyone")
        .eq("server_id", serverId),
      supabase
        .from("server_member_roles")
        .select("role_id")
        .eq("server_id", serverId)
        .eq("user_id", userId),
    ]);
  if (oErr) throw oErr;
  if (rErr) throw rErr;
  if (aErr) throw aErr;

  const everyoneRoleId = (roles || []).find((r) => r.is_everyone)?.id || null;
  const rolePos = new Map((roles || []).map((r) => [String(r.id), Number(r.position) || 0]));
  const memberRoleIds = new Set((assigned || []).map((r) => String(r.role_id)));
  if (everyoneRoleId) memberRoleIds.add(String(everyoneRoleId));

  const decorate = (rows) =>
    (rows || []).map((o) => ({
      ...o,
      _position: o.target_type === "role" ? rolePos.get(String(o.target_id)) || 0 : 0,
    }));

  const ctx = { everyoneRoleId, memberRoleIds, userId };
  let bits = base.bits;
  if (parentId) {
    bits = applyOverwrites(
      bits,
      decorate((overrides || []).filter((o) => String(o.channel_id) === String(parentId))),
      ctx
    );
  }
  bits = applyOverwrites(
    bits,
    decorate((overrides || []).filter((o) => String(o.channel_id) === String(channelId))),
    ctx
  );

  return {
    bits,
    isOwner: false,
    isMember: true,
    channelId,
    overwritesApplied: (overrides || []).length > 0,
  };
}

module.exports = {
  Permissions,
  ALL_PERMISSIONS,
  EVERYONE_DEFAULT,
  toPgBigint,
  fromPgBigint,
  hasPermission,
  resolveMemberPermissions,
  getMemberHighestPosition,
  canModerateTarget,
  assertHierarchy,
  assertCanManageRole,
  resolveChannelPermissions,
  applyOverwrites,
  permissionsToFlags,
};
