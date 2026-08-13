/**
 * Client-side helpers mirroring backend permission flags.
 * Keep bit positions in sync with frontend/backend/lib/serverPermissions.js.
 */

export const PERM_BITS = {
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
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MODERATE_MEMBERS: 1n << 40n,
};

export function bitsFromPermissions(permissions) {
  try {
    return BigInt(permissions ?? "0");
  } catch {
    return 0n;
  }
}

export function permissionsToFlagMap(permissions, keys) {
  const bits = bitsFromPermissions(permissions);
  const isAdmin = (bits & PERM_BITS.ADMINISTRATOR) === PERM_BITS.ADMINISTRATOR;
  const flags = {};
  for (const key of keys) {
    const bit = PERM_BITS[key];
    if (bit == null) {
      flags[key] = false;
      continue;
    }
    // ADMINISTRATOR implies every editable permission in the role editor UI.
    flags[key] = isAdmin || (bits & bit) === bit;
  }
  return flags;
}

/**
 * Effective permission check for the open server payload.
 * - Owner always allowed
 * - Missing myPermissions.flags → deny (fail-closed); use serverPermissionsLoaded() to detect
 * - ADMINISTRATOR grants all
 */
export function serverHasPermission(server, key) {
  if (!server) return false;
  if (server.isOwner || server?.myPermissions?.isOwner) return true;
  const flags = server?.myPermissions?.flags;
  if (!flags || typeof flags !== "object") return false;
  if (flags.ADMINISTRATOR) return true;
  return Boolean(flags[key]);
}

export function serverPermissionsLoaded(server) {
  return Boolean(server?.myPermissions?.flags);
}
