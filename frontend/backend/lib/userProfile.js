/**
 * Server-side user profile cache and broadcast helpers.
 */
const supabase = require("../db/supabase");
const { friends, presence, usernameById, lastSeenByUserId } = require("../runtime/sharedState");

/** userId -> { id, username, avatar_url, display_name, updated_at } */
const userProfileById = new Map();

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
    is_admin: profile.is_admin,
    avatarVersion: profile.updated_at,
    updated_at: profile.updated_at,
    created_at: profile.created_at,
  };
}

async function loadUserProfile(userId) {
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

  const profile = normalizeProfileRow(data);
  userProfileById.set(userId, profile);
  if (profile.username) usernameById.set(userId, profile.username);
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
  const profile = await loadUserProfile(userId);
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
  return {
    id: userId,
    username: cached?.username || usernameById.get(userId) || p?.username || "?",
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
  broadcastUserProfileUpdate,
  enrichFriendEntry,
  publicPresenceStatus,
};
