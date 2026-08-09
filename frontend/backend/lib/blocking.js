"use strict";

const supabase = require("../db/supabase");
const { friends, pendingRequests } = require("../runtime/sharedState");

/** userId -> Set of blocked user ids, hydrated from users.blocked_users on demand. */
const blockedSetCache = new Map();

function sanitizeArray(arr) {
  return Array.isArray(arr) ? arr.filter((v) => typeof v === "string" && v) : [];
}

async function loadBlockedSet(userId) {
  if (blockedSetCache.has(userId)) return blockedSetCache.get(userId);
  const { data } = await supabase
    .from("users")
    .select("blocked_users")
    .eq("id", userId)
    .maybeSingle();
  const set = new Set(sanitizeArray(data?.blocked_users));
  blockedSetCache.set(userId, set);
  return set;
}

function invalidate(userId) {
  blockedSetCache.delete(userId);
}

/** True if either user has blocked the other. */
async function isBlockedEitherWay(userA, userB) {
  if (!userA || !userB || userA === userB) return false;
  const [aSet, bSet] = await Promise.all([loadBlockedSet(userA), loadBlockedSet(userB)]);
  return aSet.has(userB) || bSet.has(userA);
}

async function getBlockedList(userId) {
  const set = await loadBlockedSet(userId);
  return [...set];
}

async function blockUser(userId, targetId) {
  if (!userId || !targetId || userId === targetId) {
    return { ok: false, error: "Invalid target." };
  }
  const set = await loadBlockedSet(userId);
  set.add(targetId);
  const next = [...set];
  await supabase.from("users").update({ blocked_users: next }).eq("id", userId);
  blockedSetCache.set(userId, set);

  // Blocking severs any existing friendship and pending requests immediately.
  friends.get(userId)?.delete(targetId);
  friends.get(targetId)?.delete(userId);
  pendingRequests.get(userId)?.delete(targetId);
  pendingRequests.get(targetId)?.delete(userId);
  try {
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${userId})`
      );
  } catch {
    /* best-effort cleanup */
  }

  return { ok: true, blockedUsers: next };
}

async function unblockUser(userId, targetId) {
  if (!userId || !targetId) return { ok: false, error: "Invalid target." };
  const set = await loadBlockedSet(userId);
  set.delete(targetId);
  const next = [...set];
  await supabase.from("users").update({ blocked_users: next }).eq("id", userId);
  blockedSetCache.set(userId, set);
  return { ok: true, blockedUsers: next };
}

module.exports = {
  isBlockedEitherWay,
  getBlockedList,
  blockUser,
  unblockUser,
  invalidate,
};
