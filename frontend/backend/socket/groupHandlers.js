/**
 * Modern Group Socket Handlers
 * Simple, reliable, works with 2-15 people
 */

const { appendErrorLog } = require("../runtime/sharedState");

function registerGroupHandlers(io, socket, state) {
  const myId = socket.user?.id;
  if (!myId) return;

  // Track active group calls: groupId -> { initiatorId, initiatorUsername, callType, participants: Set(userIds), allParticipants: Set(userIds), startTime: Date }
  if (!state.activeGroupCalls) {
    state.activeGroupCalls = new Map();
  }

  // Join group room
  socket.on("group:join", (groupId) => {
    if (!groupId) return;
    socket.join(`group:${groupId}`);

    // Notify user if there's an active call in this group
    const activeCall = state.activeGroupCalls.get(groupId);
    if (activeCall && activeCall.participants.size > 0) {
      socket.emit("group:call:active-banner", {
        groupId,
        initiatorId: activeCall.initiatorId,
        initiatorUsername: activeCall.initiatorUsername,
        callType: activeCall.callType,
        participantCount: activeCall.participants.size,
        participants: Array.from(activeCall.participants),
      });
    }
  });

  // Leave group room
  socket.on("group:leave", (groupId) => {
    if (!groupId) return;
    socket.leave(`group:${groupId}`);
    console.log(`[Socket] ${myId} left group: ${groupId}`);
  });

  // Group message
  socket.on("group:message", ({ groupId, content, mediaUrl, mediaType }) => {
    if (!groupId || (!content?.trim() && !mediaUrl)) {
      appendErrorLog("group:message", "Missing required parameters", { groupId, hasContent: !!content, hasMedia: !!mediaUrl }, myId, socket.user?.username);
      return;
    }

    const message = {
      id: crypto.randomUUID(),
      sender_id: myId,
      content: content?.trim(),
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: new Date().toISOString(),
      sender: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
    };

    // Broadcast to group (including sender for consistency)
    io.to(`group:${groupId}`).emit("group:message", { groupId, message });
  });

  // ========== GROUP CALL ==========

  // Check if there's an active call in the group
  socket.on("group:call:check", ({ groupId }) => {
    if (!groupId) return;
    
    const activeCall = state.activeGroupCalls.get(groupId);
    if (activeCall) {
      // There's an active call, notify the user to join instead
      socket.emit("group:call:active", {
        groupId,
        initiatorId: activeCall.initiatorId,
        callType: activeCall.callType,
        participants: Array.from(activeCall.participants),
      });
    } else {
      // No active call
      socket.emit("group:call:active", { groupId, active: false });
    }
  });

  // Start group call
  socket.on("group:call:start", ({ groupId, callType, memberIds = [] }) => {
    if (!groupId || !callType) {
      appendErrorLog("group:call:start", "Missing required parameters", { groupId, callType }, myId, socket.user?.username);
      return;
    }

    // Check if there's already an active call in this group
    const existingCall = state.activeGroupCalls.get(groupId);
    if (existingCall) {
      console.log(`[GroupCall] ${myId} trying to start call but existing call found in group ${groupId}`);
      // Notify user to join existing call instead
      socket.emit("group:call:join-existing", {
        groupId,
        initiatorId: existingCall.initiatorId,
        callType: existingCall.callType,
        participants: Array.from(existingCall.participants),
      });
      return;
    }

    console.log(`[GroupCall] ${myId} started ${callType} call in group ${groupId}`);

    // Track this call as active
    state.activeGroupCalls.set(groupId, {
      initiatorId: myId,
      initiatorUsername: socket.user.username,
      callType,
      participants: new Set([myId]),
      allParticipants: new Set([myId]),
      startTime: Date.now(),
    });

    const payload = {
      groupId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
      callType,
    };

    // Prefer direct user-targeted delivery (DM call style reliability).
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const uniqueTargets = [...new Set(memberIds)].filter((id) => id && id !== myId);
      uniqueTargets.forEach((targetUserId) => {
        io.to(`user:${targetUserId}`).emit("group:call:incoming", payload);
      });
      
      // Also broadcast to the group room for participant sync
      io.to(`group:${groupId}`).emit("group:call:started", {
        groupId,
        fromUserId: myId,
        fromUser: {
          id: myId,
          username: socket.user.username,
          avatar_url: socket.user.avatar_url,
        },
        callType,
      });
      
      return;
    }

    // Fallback room broadcast if member list is not available.
    socket.to(`group:${groupId}`).emit("group:call:incoming", payload);
  });

  // Accept call and send offer
  socket.on("group:call:accept", ({ groupId, toUserId }) => {
    if (!groupId || !toUserId) {
      appendErrorLog("group:call:accept", "Missing required parameters", { groupId, toUserId }, myId, socket.user?.username);
      return;
    }

    // Add participant to active call tracking
    const activeCall = state.activeGroupCalls.get(groupId);
    if (activeCall) {
      activeCall.participants.add(myId);
      activeCall.allParticipants.add(myId);
    }

    // Notify the initiator that someone accepted
    io.to(`user:${toUserId}`).emit("group:call:accepted", {
      groupId,
      fromUserId: myId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
    });

    // Also notify other participants in the group that a new person joined
    socket.to(`group:${groupId}`).emit("group:call:participant-joined", {
      groupId,
      fromUserId: myId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
    });
  });

  // Join existing call (new handler for joining active calls)
  socket.on("group:call:join", ({ groupId, callType }) => {
    if (!groupId) return;

    const activeCall = state.activeGroupCalls.get(groupId);
    if (!activeCall) {
      socket.emit("group:call:error", { groupId, message: "No active call in this group" });
      return;
    }

    // Add participant to tracking
    activeCall.participants.add(myId);
    activeCall.allParticipants.add(myId);

    // Notify all participants that someone is joining
    io.to(`group:${groupId}`).emit("group:call:participant-joined", {
      groupId,
      fromUserId: myId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url,
      },
    });

    // Send the list of current participants to the joining user
    socket.emit("group:call:participants", {
      groupId,
      participants: Array.from(activeCall.participants).filter(id => id !== myId),
      callType: activeCall.callType,
    });
  });

  // Send answer
  socket.on("group:call:answer", ({ groupId, toUserId, answer }) => {
    if (!groupId || !toUserId || !answer) return;

    io.to(`user:${toUserId}`).emit("group:call:answer", {
      groupId,
      fromUserId: myId,
      answer,
    });
  });

  // Send ICE candidate
  socket.on("group:call:ice", ({ groupId, toUserId, candidate }) => {
    if (!groupId || !toUserId || !candidate) return;

    io.to(`user:${toUserId}`).emit("group:call:ice", {
      groupId,
      fromUserId: myId,
      candidate,
    });
  });

  // Send offer (for renegotiation or camera toggle)
  socket.on("group:call:offer", ({ groupId, toUserId, offer, callType }) => {
    if (!groupId || !toUserId || !offer) return;

    io.to(`user:${toUserId}`).emit("group:call:offer", {
      groupId,
      fromUserId: myId,
      offer,
      callType,
    });
  });

  // Decline call
  socket.on("group:call:decline", ({ groupId, toUserId }) => {
    if (!groupId || !toUserId) return;

    io.to(`user:${toUserId}`).emit("group:call:declined", {
      groupId,
      fromUserId: myId,
    });
  });

  // Busy signal
  socket.on("group:call:busy", ({ groupId, toUserId }) => {
    if (!groupId || !toUserId) return;

    io.to(`user:${toUserId}`).emit("group:call:busy", {
      groupId,
      fromUserId: myId,
    });
  });

  // Leave call
  socket.on("group:call:leave", ({ groupId }) => {
    if (!groupId) return;

    const activeCall = state.activeGroupCalls.get(groupId);
    if (activeCall) {
      activeCall.participants.delete(myId);

      // Notify remaining participants this user left
      socket.to(`group:${groupId}`).emit("group:call:left", {
        groupId,
        userId: myId,
      });

      // Last participant left — end the call and emit summary
      if (activeCall.participants.size === 0) {
        const durationSeconds = Math.floor((Date.now() - activeCall.startTime) / 1000);
        const durationMinutes = Math.floor(durationSeconds / 60);
        const summary = {
          id: `call-summary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: "call_summary",
          callType: activeCall.callType,
          initiatorId: activeCall.initiatorId,
          initiatorUsername: activeCall.initiatorUsername,
          participantCount: activeCall.allParticipants.size,
          durationSeconds,
          durationMinutes,
          endedAt: new Date().toISOString(),
        };

        state.activeGroupCalls.delete(groupId);

        // Broadcast ended event with summary to everyone in the group room
        io.to(`group:${groupId}`).emit("group:call:ended", {
          groupId,
          endedBy: myId,
          summary,
        });

        // Emit the call summary as a chat message so it persists in message list
        io.to(`group:${groupId}`).emit("group:call:summary", {
          groupId,
          summary,
        });
      }
    } else {
      socket.to(`group:${groupId}`).emit("group:call:left", {
        groupId,
        userId: myId,
      });
    }
  });

  // Force-end call for everyone (initiator only action)
  socket.on("group:call:end", ({ groupId }) => {
    if (!groupId) return;

    const activeCall = state.activeGroupCalls.get(groupId);
    const durationSeconds = activeCall ? Math.floor((Date.now() - activeCall.startTime) / 1000) : 0;
    const summary = activeCall ? {
      id: `call-summary-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "call_summary",
      callType: activeCall.callType,
      initiatorId: activeCall.initiatorId,
      initiatorUsername: activeCall.initiatorUsername,
      participantCount: activeCall.allParticipants.size,
      durationSeconds,
      durationMinutes: Math.floor(durationSeconds / 60),
      endedAt: new Date().toISOString(),
    } : null;

    state.activeGroupCalls.delete(groupId);

    io.to(`group:${groupId}`).emit("group:call:ended", {
      groupId,
      endedBy: myId,
      summary,
    });

    if (summary) {
      io.to(`group:${groupId}`).emit("group:call:summary", {
        groupId,
        summary,
      });
    }
  });

  // Screen share started
  socket.on("group:screen:start", ({ groupId }) => {
    if (!groupId) return;

    socket.to(`group:${groupId}`).emit("group:screen:started", {
      groupId,
      fromUserId: myId,
    });
  });

  // Screen share stopped
  socket.on("group:screen:stop", ({ groupId }) => {
    if (!groupId) return;

    socket.to(`group:${groupId}`).emit("group:screen:stopped", {
      groupId,
      fromUserId: myId,
    });
  });
}

module.exports = { registerGroupHandlers };
