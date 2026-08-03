"use strict";

const supabase = require("../db/supabase");

/** @type {Map<string, object>} key = `${callerId}:${calleeId}` */
const pendingDmCalls = new Map();

function pendingKey(callerId, calleeId) {
  return `${callerId}:${calleeId}`;
}

function findPending(userA, userB) {
  const direct = pendingDmCalls.get(pendingKey(userA, userB));
  if (direct) return { key: pendingKey(userA, userB), call: direct };
  const swapped = pendingDmCalls.get(pendingKey(userB, userA));
  if (swapped) return { key: pendingKey(userB, userA), call: swapped };
  return null;
}

function trackOffer({ callerId, calleeId, callType }) {
  if (!callerId || !calleeId) return;
  const key = pendingKey(callerId, calleeId);
  pendingDmCalls.set(key, {
    callerId,
    calleeId,
    callType: callType === "video" ? "video" : "voice",
    status: "ringing",
    offeredAt: new Date().toISOString(),
    startedAt: null,
  });
}

function markAnswered({ callerId, calleeId }) {
  const hit = findPending(callerId, calleeId);
  if (!hit) return;
  hit.call.status = "active";
  hit.call.startedAt = new Date().toISOString();
}

async function persistCall(row) {
  try {
    const { data, error } = await supabase
      .from("dm_calls")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) {
      console.warn("[dmCallLog] insert failed:", error.message || error);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.warn("[dmCallLog] insert error:", err?.message || err);
    return null;
  }
}

/**
 * Finalize a pending DM call and persist it.
 * @returns {Promise<object|null>} public call record (without peer join)
 */
async function finalizeCall(userA, userB, status) {
  const hit = findPending(userA, userB);
  if (!hit) return null;
  pendingDmCalls.delete(hit.key);

  const call = hit.call;
  const endedAt = new Date();
  const startedAt = call.startedAt ? new Date(call.startedAt) : null;
  let finalStatus = status;
  if (!finalStatus) {
    finalStatus = startedAt ? "completed" : "missed";
  }
  if (finalStatus === "completed" && !startedAt) {
    finalStatus = "missed";
  }
  if ((finalStatus === "cancelled" || finalStatus === "missed") && startedAt) {
    finalStatus = "completed";
  }

  const durationSeconds =
    startedAt && finalStatus === "completed"
      ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
      : null;

  const row = {
    caller_id: call.callerId,
    callee_id: call.calleeId,
    call_type: call.callType,
    status: finalStatus,
    started_at: startedAt ? startedAt.toISOString() : null,
    ended_at: endedAt.toISOString(),
    duration_seconds: durationSeconds,
  };

  const id = await persistCall(row);
  return {
    id: id || `local-${endedAt.getTime()}`,
    callerId: call.callerId,
    calleeId: call.calleeId,
    callType: call.callType,
    status: finalStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds,
    createdAt: endedAt.toISOString(),
  };
}

function mapCallRow(row, meId, peersById = {}) {
  const iAmCaller = row.caller_id === meId;
  const peerId = iAmCaller ? row.callee_id : row.caller_id;
  const peer = peersById[peerId] || null;
  return {
    id: row.id,
    direction: iAmCaller ? "outgoing" : "incoming",
    callType: row.call_type,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at || row.ended_at,
    peer: peer
      ? {
          id: peer.id,
          username: peer.username,
          displayName: peer.display_name || peer.displayName || null,
          avatarUrl: peer.avatar_url || peer.avatarUrl || null,
          updated_at: peer.updated_at || null,
        }
      : {
          id: peerId,
          username: "Unknown",
          displayName: null,
          avatarUrl: null,
        },
  };
}

async function listCallsForUser(userId, { limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { data, error } = await supabase
    .from("dm_calls")
    .select("id, caller_id, callee_id, call_type, status, started_at, ended_at, duration_seconds, created_at")
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(capped);

  if (error) throw error;

  const rows = data || [];
  const peerIds = [
    ...new Set(rows.flatMap((r) => [r.caller_id, r.callee_id]).filter((id) => id && id !== userId)),
  ];
  let peersById = {};
  if (peerIds.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url, updated_at")
      .in("id", peerIds);
    peersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  }
  return rows.map((r) => mapCallRow(r, userId, peersById));
}

module.exports = {
  trackOffer,
  markAnswered,
  finalizeCall,
  listCallsForUser,
};
