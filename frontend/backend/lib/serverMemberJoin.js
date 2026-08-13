"use strict";

const supabase = require("../db/supabase");

const APP_BOT = {
  id: "descall-apps",
  username: "Descall Apps",
  displayName: "Descall Apps",
  display_name: "Descall Apps",
  avatar_url: "/brand/descall-logo.png",
  avatarUrl: "/brand/descall-logo.png",
  isBot: true,
};

const TEMP_MEMBER_GRACE_MS = 60_000;
const pendingTempRemovals = new Map();

/**
 * Socket-only welcome message from Descall Apps (not persisted — sender is app bot).
 */
async function postWelcomeMessage(io, server, userId) {
  const channelId = server?.welcome_channel_id || server?.welcomeChannelId;
  if (!channelId || !io || !server?.id) return;

  const { data: user, error } = await supabase
    .from("users")
    .select("username, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[ServerJoin] welcome user lookup failed:", error.message);
  }

  const label = user?.display_name || user?.username || "there";
  void label;
  const content = `Welcome <@${userId}> to **${server.name}**!`;
  const now = new Date().toISOString();
  const message = {
    id: `welcome-${Date.now()}-${userId}`,
    server_id: server.id,
    channel_id: channelId,
    sender_id: APP_BOT.id,
    sender: { ...APP_BOT },
    content,
    text: content,
    type: "system",
    isBot: true,
    isAppMessage: true,
    created_at: now,
    timestamp: now,
  };

  const payload = { serverId: server.id, channelId, message };
  io.to(`server-channel:${channelId}`).emit("server:channel:message", payload);
  io.to(`server:${server.id}`).emit("server:channel:message", payload);
}

function userHasLiveSockets(io, userId) {
  const room = io.sockets?.adapter?.rooms?.get(`user:${userId}`);
  return Boolean(room && room.size > 0);
}

function userIsInServerVoice(userId) {
  try {
    const { findUserVoiceChannel } = require("../socket/serverVoiceHandlers");
    return Boolean(findUserVoiceChannel(userId));
  } catch {
    return false;
  }
}

async function removeTemporaryMembership(userId, serverId) {
  const { error } = await supabase
    .from("server_members")
    .delete()
    .eq("server_id", serverId)
    .eq("user_id", userId)
    .eq("temporary", true);
  if (error) {
    console.warn("[ServerJoin] temp member removal failed:", error.message);
    return false;
  }
  return true;
}

/**
 * After full socket disconnect, drop temporary memberships once offline 60s.
 */
function scheduleTemporaryMemberCleanup(io, userId) {
  if (!io || !userId) return;
  const key = String(userId);
  const prev = pendingTempRemovals.get(key);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(async () => {
    pendingTempRemovals.delete(key);
    if (userHasLiveSockets(io, userId) || userIsInServerVoice(userId)) return;

    const { data: rows, error } = await supabase
      .from("server_members")
      .select("server_id")
      .eq("user_id", userId)
      .eq("temporary", true);
    if (error) {
      console.warn("[ServerJoin] temp member scan failed:", error.message);
      return;
    }

    for (const row of rows || []) {
      if (userHasLiveSockets(io, userId) || userIsInServerVoice(userId)) break;
      const removed = await removeTemporaryMembership(userId, row.server_id);
      if (removed) {
        io.to(`server:${row.server_id}`).emit("server:member:left", {
          serverId: row.server_id,
          userId,
          reason: "temporary_expired",
        });
      }
    }
  }, TEMP_MEMBER_GRACE_MS);

  pendingTempRemovals.set(key, timer);
}

module.exports = {
  postWelcomeMessage,
  scheduleTemporaryMemberCleanup,
  TEMP_MEMBER_GRACE_MS,
};
