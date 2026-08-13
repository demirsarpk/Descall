"use strict";

const supabase = require("../db/supabase");
const { postMemberJoinSystem } = require("./serverSystemMessages");

const TEMP_MEMBER_GRACE_MS = 60_000;
const pendingTempRemovals = new Map();

/**
 * Persist welcome / join system messages (survives reload).
 */
async function postWelcomeMessage(io, server, userId) {
  if (!server?.id || !userId) return;
  try {
    await postMemberJoinSystem(io, server, userId);
  } catch (err) {
    console.warn("[ServerJoin] system welcome failed:", err?.message || err);
  }
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
