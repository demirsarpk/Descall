/**
 * Server-side user profile cache and broadcast helpers.
 * Includes chat-visible equipped cosmetics so message lists match profile cards.
 */
const supabase = require("../db/supabase");
const { friends, presence, usernameById, lastSeenByUserId } = require("../runtime/sharedState");

/** userId -> profile row (+ optional equipped* cosmetics) */
const userProfileById = new Map();

const CHAT_COSMETIC_KEYS = [
  "equippedAvatarFrame",
  "equippedBadge",
  "equippedTitle",
  "equippedNameEffect",
  "equippedAvatarEffect",
  "equippedChatBubble",
  "equippedPresenceFlare",
];

const ALL_COSMETIC_KEYS = [
  "equippedAvatarFrame",
  "equippedBanner",
  "equippedBackground",
  "equippedTheme",
  "equippedBadge",
  "equippedTitle",
  "equippedNameEffect",
  "equippedAvatarEffect",
  "equippedChatBubble",
  "equippedPresenceFlare",
  "equippedProfileAura",
  "equippedSoundPack",
  "equippedTypingFlare",
  "equippedReactionBurst",
  "equippedCallOverlay",
  "_cosmeticsLoaded",
];

function normalizeProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    avatar_url: row.avatar_url || null,
    display_name: row.display_name || null,
    bio: row.bio || null,
    custom_status: row.custom_status || null,
    banner_url: row.banner_url || null,
    presence_status: row.presence_status || "online",
    is_admin: Boolean(row.is_admin),
    updated_at: row.updated_at || new Date().toISOString(),
    created_at: row.created_at || null,
  };
}

function isAdminProfile(profile) {
  if (!profile) return false;
  return Boolean(profile.is_admin) || profile.username === "admin";
}

function cosmeticsFromEquipped(equipped) {
  if (!equipped) return {};
  return {
    equippedAvatarFrame: equipped.avatarFrame || null,
    equippedBanner: equipped.banner || null,
    equippedBackground: equipped.background || null,
    equippedTheme: equipped.theme || null,
    equippedBadge: equipped.badge || null,
    equippedTitle: equipped.title || null,
    equippedNameEffect: equipped.nameEffect || null,
    equippedAvatarEffect: equipped.avatarEffect || null,
    equippedChatBubble: equipped.chatBubble || null,
    equippedPresenceFlare: equipped.presenceFlare || null,
    equippedProfileAura: equipped.profileAura || null,
    equippedSoundPack: equipped.soundPack || null,
    equippedTypingFlare: equipped.typingFlare || null,
    equippedReactionBurst: equipped.reactionBurst || null,
    equippedCallOverlay: equipped.callOverlay || null,
  };
}

function pickChatCosmetics(profile) {
  if (!profile) return {};
  const out = {};
  for (const key of CHAT_COSMETIC_KEYS) {
    if (profile[key]) out[key] = profile[key];
  }
  // Reaction burst is used on message reactions in chat
  if (profile.equippedReactionBurst) out.equippedReactionBurst = profile.equippedReactionBurst;
  return out;
}

function applyCosmeticsToProfile(profile, equipped) {
  if (!profile) return null;
  const cos = cosmeticsFromEquipped(equipped);
  Object.assign(profile, cos);
  return profile;
}

function preserveCosmetics(target, prev) {
  if (!target || !prev) return target;
  for (const key of ALL_COSMETIC_KEYS) {
    if (prev[key] !== undefined) target[key] = prev[key];
  }
  return target;
}

function toPublicUser(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatar_url || null,
    avatar_url: profile.avatar_url || null,
    displayName: profile.display_name || null,
    bio: profile.bio || null,
    customStatus: profile.custom_status || null,
    bannerUrl: profile.banner_url || null,
    is_admin: isAdminProfile(profile),
    isAdmin: isAdminProfile(profile),
    avatarVersion: profile.updated_at,
    updated_at: profile.updated_at,
    created_at: profile.created_at,
    equippedAvatarFrame: profile.equippedAvatarFrame || null,
    equippedBanner: profile.equippedBanner || null,
    equippedBackground: profile.equippedBackground || null,
    equippedTheme: profile.equippedTheme || null,
    equippedBadge: profile.equippedBadge || null,
    equippedTitle: profile.equippedTitle || null,
    equippedNameEffect: profile.equippedNameEffect || null,
    equippedAvatarEffect: profile.equippedAvatarEffect || null,
    equippedChatBubble: profile.equippedChatBubble || null,
    equippedPresenceFlare: profile.equippedPresenceFlare || null,
    equippedProfileAura: profile.equippedProfileAura || null,
    equippedSoundPack: profile.equippedSoundPack || null,
    equippedTypingFlare: profile.equippedTypingFlare || null,
    equippedReactionBurst: profile.equippedReactionBurst || null,
    equippedCallOverlay: profile.equippedCallOverlay || null,
  };
}

async function loadEquippedCosmetics(userId) {
  if (!userId) return null;
  try {
    const shop = require("./shop");
    return await shop.getEquippedCosmeticsForUser(userId);
  } catch (err) {
    console.warn("[profile] load cosmetics failed:", err?.message || err);
    return null;
  }
}

async function cacheEquippedCosmetics(userId) {
  const equipped = await loadEquippedCosmetics(userId);
  const cached = userProfileById.get(userId);
  if (cached && equipped) {
    applyCosmeticsToProfile(cached, equipped);
    cached._cosmeticsLoaded = true;
    userProfileById.set(userId, cached);
  }
  return equipped;
}

/** Batch-load cosmetics for many users (DM/group history). */
async function ensureCosmeticsCached(userIds = []) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(
    ids.map(async (id) => {
      const cached = userProfileById.get(id);
      if (
        cached?._cosmeticsLoaded ||
        cached?.equippedAvatarFrame ||
        cached?.equippedBadge ||
        cached?.equippedNameEffect ||
        cached?.equippedChatBubble
      ) {
        if (cached && !cached._cosmeticsLoaded) cached._cosmeticsLoaded = true;
        return;
      }
      const equipped = await loadEquippedCosmetics(id);
      const profile = userProfileById.get(id) || { id };
      applyCosmeticsToProfile(profile, equipped || {});
      profile._cosmeticsLoaded = true;
      userProfileById.set(id, profile);
    })
  );
}

async function loadUserProfile(userId, { withCosmetics = true } = {}) {
  if (!userId) return null;
  // Prefer presence_status; fall back if column not migrated yet
  let data = null;
  let error = null;
  ({ data, error } = await supabase
    .from("users")
    .select("id, username, avatar_url, display_name, bio, custom_status, banner_url, updated_at, presence_status, is_admin, created_at")
    .eq("id", userId)
    .single());

  if (error) {
    ({ data, error } = await supabase
      .from("users")
      .select("id, username, avatar_url, display_name, updated_at, is_admin")
      .eq("id", userId)
      .single());
  }

  if (error || !data) return userProfileById.get(userId) || null;

  const prev = userProfileById.get(userId);
  const profile = normalizeProfileRow(data);
  preserveCosmetics(profile, prev);
  userProfileById.set(userId, profile);
  if (profile.username) usernameById.set(userId, profile.username);

  if (withCosmetics) {
    const equipped = await loadEquippedCosmetics(userId);
    if (equipped) {
      applyCosmeticsToProfile(profile, equipped);
      profile._cosmeticsLoaded = true;
      userProfileById.set(userId, profile);
    }
  }

  return profile;
}

async function savePresenceStatus(userId, status) {
  if (!userId || !status) return false;
  const { error } = await supabase
    .from("users")
    .update({ presence_status: status })
    .eq("id", userId);
  if (error) {
    console.warn("[presence] save failed (run presenceStatusMigration.sql?):", error.message);
    return false;
  }
  const cached = userProfileById.get(userId);
  if (cached) {
    cached.presence_status = status;
    userProfileById.set(userId, cached);
  }
  return true;
}

function cacheUserProfile(row) {
  const profile = normalizeProfileRow(row);
  if (!profile?.id) return null;
  const prev = userProfileById.get(profile.id);
  preserveCosmetics(profile, prev);
  // Also keep cosmetics if the incoming row already carries them
  for (const key of ALL_COSMETIC_KEYS) {
    if (row?.[key] !== undefined) profile[key] = row[key];
  }
  userProfileById.set(profile.id, profile);
  if (profile.username) usernameById.set(profile.id, profile.username);
  return profile;
}

function getCachedPublicUser(userId) {
  return toPublicUser(userProfileById.get(userId));
}

function getAvatarUrl(userId) {
  return userProfileById.get(userId)?.avatar_url || null;
}

async function broadcastUserProfileUpdate(io, userId) {
  const profile = await loadUserProfile(userId, { withCosmetics: true });
  if (!profile) return;

  const p = presence.get(userId);
  if (p) {
    p.avatar_url = profile.avatar_url;
    presence.set(userId, p);
  }

  // Keep live socket.user in sync so group messages / calls don't emit stale avatars.
  try {
    const room = io.sockets?.adapter?.rooms?.get(`user:${userId}`);
    if (room) {
      for (const sid of room) {
        const sock = io.sockets.sockets.get(sid);
        if (sock?.user) {
          sock.user.avatar_url = profile.avatar_url;
          sock.user.username = profile.username || sock.user.username;
          sock.user.display_name = profile.display_name;
          sock.user.displayName = profile.display_name;
        }
      }
    } else if (p?.socketId) {
      const sock = io.sockets.sockets.get(p.socketId);
      if (sock?.user) {
        sock.user.avatar_url = profile.avatar_url;
        sock.user.username = profile.username || sock.user.username;
        sock.user.display_name = profile.display_name;
        sock.user.displayName = profile.display_name;
      }
    }
  } catch (err) {
    console.warn("[profile] socket.user sync failed:", err?.message || err);
  }

  const payload = { user: toPublicUser(profile) };

  io.to(`user:${userId}`).emit("user:profile:updated", payload);

  const friendSet = friends.get(userId);
  if (friendSet) {
    for (const fid of friendSet) {
      io.to(`user:${fid}`).emit("user:profile:updated", payload);
    }
  }

  const list = [];
  for (const [id, pres] of presence) {
    if (pres.status === "invisible") continue;
    const cached = userProfileById.get(id);
    list.push({
      id,
      username: cached?.username || pres.username,
      displayName: cached?.display_name || null,
      display_name: cached?.display_name || null,
      status: publicPresenceStatus(pres.status),
      avatarUrl: cached?.avatar_url || pres.avatar_url || null,
      avatar_url: cached?.avatar_url || pres.avatar_url || null,
      avatarVersion: cached?.updated_at || null,
      updated_at: cached?.updated_at || null,
      is_admin: isAdminProfile(cached) || (pres.username === "admin"),
      isAdmin: isAdminProfile(cached) || (pres.username === "admin"),
      ...pickChatCosmetics(cached),
    });
  }
  io.emit("users:update", list);
}

function publicPresenceStatus(status) {
  if (status === "invisible") return "offline";
  return status || "online";
}

function enrichFriendEntry(userId) {
  const p = presence.get(userId);
  const cached = userProfileById.get(userId);
  const lastSeen = lastSeenByUserId.get(userId) || null;
  const username = cached?.username || usernameById.get(userId) || p?.username || "?";
  const admin = isAdminProfile(cached) || username === "admin";
  return {
    id: userId,
    username,
    displayName: cached?.display_name || null,
    avatarUrl: cached?.avatar_url || p?.avatar_url || null,
    status: p ? publicPresenceStatus(p.status) : "offline",
    customStatus: cached?.custom_status || null,
    custom_status: cached?.custom_status || null,
    bio: cached?.bio || null,
    bannerUrl: cached?.banner_url || null,
    banner_url: cached?.banner_url || null,
    lastSeen: p ? null : lastSeen,
    avatarVersion: cached?.updated_at || null,
    updated_at: cached?.updated_at || null,
    is_admin: admin,
    isAdmin: admin,
    ...pickChatCosmetics(cached),
  };
}

module.exports = {
  userProfileById,
  loadUserProfile,
  savePresenceStatus,
  cacheUserProfile,
  getCachedPublicUser,
  getAvatarUrl,
  toPublicUser,
  isAdminProfile,
  broadcastUserProfileUpdate,
  enrichFriendEntry,
  publicPresenceStatus,
  cacheEquippedCosmetics,
  ensureCosmeticsCached,
  pickChatCosmetics,
  cosmeticsFromEquipped,
  applyCosmeticsToProfile,
};
