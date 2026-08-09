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

/** True when userA and userB are in a genuinely connected DM call right now. */
function isActiveDmCall(userA, userB) {
  const hit = findPending(userA, userB);
  return Boolean(hit && hit.call.status === "active");
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
    kind: "dm",
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
    kind: "dm",
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

async function listDmCallsForUser(userId, { limit = 50 } = {}) {
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
  return rows.map((r) => ({
    ...mapCallRow(r, userId, peersById),
    kind: "dm",
  }));
}

function mapGroupCallRow(row, userId, { joined = true } = {}) {
  const status =
    row.status === "active" && !row.ended_at
      ? "active"
      : joined
        ? "completed"
        : "missed";
  const direction = row.started_by === userId ? "outgoing" : "incoming";
  return {
    id: `group-${row.id}`,
    kind: "group",
    direction,
    callType: row.call_type === "video" ? "video" : "voice",
    status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds ?? null,
    createdAt: row.ended_at || row.started_at || row.created_at,
    participantCount: row.participant_count ?? null,
    initiatorId: row.started_by,
    peer: null,
    group: {
      id: row.group_id,
      name: row.group_name || "Group",
      avatarUrl: row.group_avatar_url || null,
    },
  };
}

async function listGroupCallsForUser(userId, { limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);

  // Calls the user actually joined
  const joined = await supabase
    .from("group_call_participants")
    .select(
      `
      call_id,
      group_calls (
        id, group_id, started_by, call_type, started_at, ended_at,
        duration_seconds, participant_count, status
      )
    `
    )
    .eq("user_id", userId)
    .limit(capped);

  let joinedRows = [];
  if (!joined.error) {
    joinedRows = (joined.data || [])
      .map((r) => r.group_calls)
      .filter(Boolean);
  } else {
    // Fallback without embed: two-step query
    console.warn("[callLog] group participant embed failed:", joined.error.message);
    const { data: parts } = await supabase
      .from("group_call_participants")
      .select("call_id")
      .eq("user_id", userId)
      .limit(capped);
    const callIds = [...new Set((parts || []).map((p) => p.call_id).filter(Boolean))];
    if (callIds.length) {
      const { data: calls } = await supabase
        .from("group_calls")
        .select("id, group_id, started_by, call_type, started_at, ended_at, duration_seconds, participant_count, status")
        .in("id", callIds);
      joinedRows = calls || [];
    }
  }

  const joinedIds = new Set(joinedRows.map((r) => r.id));

  // Missed: ended group calls in my groups that I never joined
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = (memberships || []).map((m) => m.group_id).filter(Boolean);

  let missedRows = [];
  if (groupIds.length) {
    const { data: endedCalls, error: endedErr } = await supabase
      .from("group_calls")
      .select("id, group_id, started_by, call_type, started_at, ended_at, duration_seconds, participant_count, status")
      .in("group_id", groupIds)
      .not("ended_at", "is", null)
      .order("ended_at", { ascending: false })
      .limit(capped);
    if (!endedErr) {
      missedRows = (endedCalls || []).filter((c) => !joinedIds.has(c.id) && c.started_by !== userId);
    }
  }

  const allRows = [...joinedRows, ...missedRows];
  const uniqueById = new Map();
  for (const row of allRows) {
    if (!row?.id || uniqueById.has(row.id)) continue;
    uniqueById.set(row.id, {
      row,
      joined: joinedIds.has(row.id),
    });
  }

  const groupIdSet = [...new Set([...uniqueById.values()].map((x) => x.row.group_id).filter(Boolean))];
  let groupsById = {};
  if (groupIdSet.length) {
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name, avatar_url")
      .in("id", groupIdSet);
    groupsById = Object.fromEntries((groups || []).map((g) => [g.id, g]));
  }

  const mapped = [...uniqueById.values()].map(({ row, joined: didJoin }) => {
    const g = groupsById[row.group_id];
    return mapGroupCallRow(
      {
        ...row,
        group_name: g?.name,
        group_avatar_url: g?.avatar_url,
      },
      userId,
      { joined: didJoin }
    );
  });

  mapped.sort((a, b) => {
    const ta = new Date(a.endedAt || a.startedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.endedAt || b.startedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });

  return mapped.slice(0, capped);
}

/**
 * Unified DM + group call history for the Calls tab.
 */
async function listCallsForUser(userId, { limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const [dms, groups] = await Promise.all([
    listDmCallsForUser(userId, { limit: capped }),
    listGroupCallsForUser(userId, { limit: capped }).catch((err) => {
      console.warn("[callLog] group list failed:", err?.message || err);
      return [];
    }),
  ]);

  const merged = [...dms, ...groups].sort((a, b) => {
    const ta = new Date(a.endedAt || a.createdAt || a.startedAt || 0).getTime();
    const tb = new Date(b.endedAt || b.createdAt || b.startedAt || 0).getTime();
    return tb - ta;
  });

  return merged.slice(0, capped);
}

/** Build a public group-call history record after a call ends (for socket push). */
function buildGroupCallHistoryRecord({ callRow, group, meId, joined = true }) {
  if (!callRow?.id) return null;
  return mapGroupCallRow(
    {
      ...callRow,
      group_name: group?.name,
      group_avatar_url: group?.avatarUrl || group?.avatar_url,
    },
    meId,
    { joined }
  );
}

module.exports = {
  trackOffer,
  markAnswered,
  isActiveDmCall,
  finalizeCall,
  listCallsForUser,
  listDmCallsForUser,
  listGroupCallsForUser,
  buildGroupCallHistoryRecord,
  mapGroupCallRow,
};
