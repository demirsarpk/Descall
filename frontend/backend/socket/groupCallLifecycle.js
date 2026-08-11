/**
 * Shared group call lifecycle helpers — end, broadcast, disconnect cleanup.
 */
const supabase = require("../db/supabase");
const { activeGroupCalls } = require("../runtime/sharedState");
const { mapGroupCallRow } = require("../lib/dmCallLog");

async function getGroupMemberIds(groupId) {
  const { data } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId);
  return (data || []).map((r) => r.user_id).filter(Boolean);
}

async function broadcastToGroupMembers(io, groupId, event, payload) {
  const memberIds = await getGroupMemberIds(groupId);
  const unique = new Set(memberIds);
  unique.forEach((userId) => {
    io.to(`user:${userId}`).emit(event, payload);
  });
  io.to(`group:${groupId}`).emit(event, payload);
}

function buildBannerFromCall(groupId, activeCall) {
  if (!activeCall || activeCall.participants.size === 0) return null;
  return {
    groupId,
    initiatorId: activeCall.initiatorId,
    initiatorUsername: activeCall.initiatorUsername,
    initiatorAvatarUrl: activeCall.initiatorAvatarUrl || null,
    callType: activeCall.callType,
    participantCount: activeCall.participants.size,
    participants: Array.from(activeCall.participants),
    startTime: activeCall.startTime,
  };
}

async function emitBannerUpdate(io, groupId) {
  const activeCall = activeGroupCalls.get(groupId);
  const banner = buildBannerFromCall(groupId, activeCall);
  await broadcastToGroupMembers(io, groupId, "group:call:banner-update", {
    groupId,
    banner,
  });
}

async function pushGroupCallHistory(io, groupId, activeCall, endedBy, endedAt, durationSeconds) {
  if (!activeCall?.dbCallId) return;

  let groupMeta = { id: groupId, name: "Group", avatar_url: null };
  try {
    const { data } = await supabase
      .from("groups")
      .select("id, name, avatar_url")
      .eq("id", groupId)
      .maybeSingle();
    if (data) groupMeta = data;
  } catch {
    /* ignore */
  }

  const callRow = {
    id: activeCall.dbCallId,
    group_id: groupId,
    started_by: activeCall.initiatorId,
    call_type: activeCall.callType,
    started_at: activeCall.startTime
      ? new Date(activeCall.startTime).toISOString()
      : null,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    participant_count: activeCall.allParticipants.size,
    status: "ended",
    group_name: groupMeta.name,
    group_avatar_url: groupMeta.avatar_url,
  };

  const memberIds = await getGroupMemberIds(groupId);
  const participantIds = new Set(activeCall.allParticipants || []);

  for (const userId of new Set([...memberIds, ...participantIds])) {
    const joined = participantIds.has(userId);
    const record = mapGroupCallRow(callRow, userId, { joined });
    io.to(`user:${userId}`).emit("calls:updated", { call: record });
  }
}

async function endGroupCall(io, groupId, endedBy, activeCall) {
  if (!activeCall) return;
  for (const timer of activeCall.disconnectGraceByUser?.values?.() || []) clearTimeout(timer);
  activeCall.disconnectGraceByUser?.clear?.();

  const durationSeconds = Math.floor((Date.now() - activeCall.startTime) / 1000);
  const endedAt = new Date().toISOString();
  const summary = {
    id: `call-summary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "call_summary",
    callType: activeCall.callType,
    initiatorId: activeCall.initiatorId,
    initiatorUsername: activeCall.initiatorUsername,
    participantCount: activeCall.allParticipants.size,
    durationSeconds,
    durationMinutes: Math.floor(durationSeconds / 60),
    endedAt,
  };

  const dbCallId = activeCall.dbCallId;
  // Snapshot participants before deleting active call
  const participantSnapshot = new Set(activeCall.allParticipants || []);
  activeGroupCalls.delete(groupId);

  if (dbCallId) {
    supabase
      .from("group_calls")
      .update({
        ended_at: endedAt,
        ended_by: endedBy,
        duration_seconds: durationSeconds,
        participant_count: participantSnapshot.size,
        status: "ended",
      })
      .eq("id", dbCallId)
      .then(({ error }) => {
        if (error) console.error("[GroupCall] DB end update error:", error.message);
      });

    supabase
      .from("group_call_participants")
      .update({ left_at: endedAt })
      .eq("call_id", dbCallId)
      .is("left_at", null)
      .then(({ error }) => {
        if (error) console.error("[GroupCall] Participant left_at error:", error.message);
      });
  }

  supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      sender_id: activeCall.initiatorId,
      content: JSON.stringify(summary),
      message_type: "call_summary",
    })
    .then(({ error }) => {
      if (error) console.error("[GroupCall] Summary message insert error:", error.message);
    });

  const endedPayload = { groupId, endedBy, summary };
  await broadcastToGroupMembers(io, groupId, "group:call:ended", endedPayload);
  await broadcastToGroupMembers(io, groupId, "group:call:summary", { groupId, summary });
  await broadcastToGroupMembers(io, groupId, "group:call:banner-update", { groupId, banner: null });

  try {
    await pushGroupCallHistory(
      io,
      groupId,
      { ...activeCall, allParticipants: participantSnapshot, dbCallId },
      endedBy,
      endedAt,
      durationSeconds
    );
  } catch (err) {
    console.warn("[GroupCall] history push failed:", err?.message || err);
  }
}

async function removeUserFromGroupCall(io, groupId, userId, socket) {
  const activeCall = activeGroupCalls.get(groupId);
  if (!activeCall || !activeCall.participants.has(userId)) return false;
  const graceTimer = activeCall.disconnectGraceByUser?.get(userId);
  if (graceTimer) clearTimeout(graceTimer);
  activeCall.disconnectGraceByUser?.delete(userId);

  activeCall.participants.delete(userId);

  // Tell remaining peers this user left — do NOT broadcast "ended" while anyone remains.
  if (socket) {
    socket.to(`group:${groupId}`).emit("group:call:left", { groupId, userId });
  } else {
    io.to(`group:${groupId}`).emit("group:call:left", { groupId, userId });
  }

  if (activeCall.dbCallId) {
    supabase
      .from("group_call_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("call_id", activeCall.dbCallId)
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) console.error("[GroupCall] Participant left_at error:", error.message);
      });
  }

  // Room stays alive for remaining participants (solo lobby until they leave or others join).
  if (activeCall.participants.size === 0) {
    await endGroupCall(io, groupId, userId, activeCall);
  } else {
    await emitBannerUpdate(io, groupId);
  }
  return true;
}

function scheduleParticipantDisconnectGrace(io, groupId, userId) {
  const activeCall = activeGroupCalls.get(groupId);
  if (!activeCall?.participants?.has(userId)) return;
  if (!activeCall.disconnectGraceByUser) activeCall.disconnectGraceByUser = new Map();
  const previous = activeCall.disconnectGraceByUser.get(userId);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    removeUserFromGroupCall(io, groupId, userId).catch((error) => {
      console.warn("[GroupCall] delayed disconnect cleanup failed:", error?.message || error);
    });
  }, 45_000);
  activeCall.disconnectGraceByUser.set(userId, timer);
}

function resumeParticipantInGroupCall(io, groupId, userId, socket) {
  const activeCall = activeGroupCalls.get(groupId);
  if (!activeCall?.participants?.has(userId)) return false;
  const timer = activeCall.disconnectGraceByUser?.get(userId);
  if (timer) clearTimeout(timer);
  activeCall.disconnectGraceByUser?.delete(userId);
  socket.join(`group:${groupId}`);
  socket.to(`group:${groupId}`).emit("group:call:participant-resumed", { groupId, userId });
  return true;
}

async function removeUserFromAllGroupCalls(io, userId, socket) {
  const groupIds = [...activeGroupCalls.keys()];
  for (const groupId of groupIds) {
    await removeUserFromGroupCall(io, groupId, userId, socket);
  }
}

module.exports = {
  broadcastToGroupMembers,
  buildBannerFromCall,
  emitBannerUpdate,
  endGroupCall,
  removeUserFromGroupCall,
  removeUserFromAllGroupCalls,
  scheduleParticipantDisconnectGrace,
  resumeParticipantInGroupCall,
};
