/**
 * Shared group call lifecycle helpers — end, broadcast, disconnect cleanup.
 */
const supabase = require("../db/supabase");
const { activeGroupCalls } = require("../runtime/sharedState");

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

async function endGroupCall(io, groupId, endedBy, activeCall) {
  if (!activeCall) return;

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
  activeGroupCalls.delete(groupId);

  if (dbCallId) {
    supabase
      .from("group_calls")
      .update({
        ended_at: endedAt,
        ended_by: endedBy,
        duration_seconds: durationSeconds,
        participant_count: activeCall.allParticipants.size,
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
}

async function removeUserFromGroupCall(io, groupId, userId, socket) {
  const activeCall = activeGroupCalls.get(groupId);
  if (!activeCall || !activeCall.participants.has(userId)) return false;

  activeCall.participants.delete(userId);

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

  if (activeCall.participants.size === 0) {
    await endGroupCall(io, groupId, userId, activeCall);
  } else {
    await emitBannerUpdate(io, groupId);
  }
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
};
