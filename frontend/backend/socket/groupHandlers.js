/**
 * Modern Group Socket Handlers
 * Simple, reliable, works with 2-15 people
 */

const { appendErrorLog, activeGroupCalls, screenShareSessions, presence, usernameById } = require("../runtime/sharedState");
const supabase = require("../db/supabase");
const { handleGameCommand, createGameMessage } = require("./gameHandlers");
const { getCachedPublicUser, getAvatarUrl } = require("../lib/userProfile");
const {
  broadcastToGroupMembers,
  emitBannerUpdate,
  endGroupCall,
  removeUserFromGroupCall,
  removeUserFromAllGroupCalls,
} = require("./groupCallLifecycle");

function resolveSocketAvatar(socket) {
  const cached = getCachedPublicUser(socket.user?.id);
  return (
    cached?.avatarUrl ||
    cached?.avatar_url ||
    getAvatarUrl(socket.user?.id) ||
    socket.user?.avatar_url ||
    null
  );
}

const MENTION_PATTERN = /@(\w{1,32})/g;

// Game commands that should be intercepted
const GAME_COMMANDS = ['bj', 'blackjack', 'hit', 'stand', 'stay', 'double', 'credits', 'bakiye', 'balance', 'top', 'lider', 'help', 'yardım', 'commands', 'jb', 'daily'];
const COMMAND_REGEX = /^\/(\w+)(?:\s+(\S+))?/;

function extractMentionedUsernames(text) {
  if (!text) return [];
  const matches = [...text.matchAll(MENTION_PATTERN)];
  return [...new Set(matches.map((m) => m[1].toLowerCase()))];
}

function emitMentionToUser(io, userId, payload) {
  const p = presence.get(userId);
  if (p?.socketId) io.to(p.socketId).emit("mention:received", payload);
}

function registerGroupHandlers(io, socket, state) {
  const myId = socket.user?.id;
  if (!myId) return;

  // activeGroupCalls is imported from sharedState — shared across all socket connections

  // Join group room
  socket.on("group:join", (groupId) => {
    if (!groupId) return;
    socket.join(`group:${groupId}`);

    // Notify user if there's an active call in this group
    const activeCall = activeGroupCalls.get(groupId);
    if (activeCall && activeCall.participants.size > 0) {
      socket.emit("group:call:active-banner", {
        groupId,
        initiatorId: activeCall.initiatorId,
        initiatorUsername: activeCall.initiatorUsername,
        callType: activeCall.callType,
        participantCount: activeCall.participants.size,
        participants: Array.from(activeCall.participants),
        startTime: activeCall.startTime,
      });
    }
  });

  // Bulk rejoin all group rooms at once (used on connect / reconnect)
  // Restores active-banner state without requiring a page reload
  socket.on("groups:rejoin", (groupIds) => {
    if (!Array.isArray(groupIds)) return;
    groupIds.forEach((groupId) => {
      if (!groupId) return;
      socket.join(`group:${groupId}`);
      const activeCall = activeGroupCalls.get(groupId);
      if (activeCall && activeCall.participants.size > 0) {
        socket.emit("group:call:active-banner", {
          groupId,
          initiatorId: activeCall.initiatorId,
          initiatorUsername: activeCall.initiatorUsername,
          callType: activeCall.callType,
          participantCount: activeCall.participants.size,
          participants: Array.from(activeCall.participants),
          startTime: activeCall.startTime,
        });
      }
    });
  });

  // Leave group room
  socket.on("group:leave", (groupId) => {
    if (!groupId) return;
    socket.leave(`group:${groupId}`);
    console.log(`[Socket] ${myId} left group: ${groupId}`);
  });

  // Group message — persist to DB then broadcast
  socket.on("group:message", async ({ groupId, tempId, content, mediaUrl, mediaType, duration, replyTo }) => {
    if (!groupId || (!content?.trim() && !mediaUrl)) {
      appendErrorLog("group:message", "Missing required parameters", { groupId, hasContent: !!content, hasMedia: !!mediaUrl }, myId, socket.user?.username);
      if (tempId) {
        socket.emit("group:message:error", { groupId, tempId, message: "Missing message content." });
      }
      return;
    }

    const isVoice = mediaType === "voice" || mediaType === "audio";
    let trimmedContent = content?.trim() || null;
    if (isVoice && mediaUrl) {
      const dur = Math.max(0, Math.round(Number(duration) || 0));
      // Persist duration in content so it survives page reload (no DB column needed)
      if (!trimmedContent || !trimmedContent.startsWith("__voice__:")) {
        trimmedContent = `__voice__:${dur || 1}`;
      }
    }

    // Check if this is a game command (starts with /)
    if (trimmedContent && trimmedContent.startsWith('/')) {
      const match = trimmedContent.match(COMMAND_REGEX);
      if (match) {
        const [, cmd] = match;
        const commandLower = cmd.toLowerCase();
        if (GAME_COMMANDS.includes(commandLower)) {
          // Game command — handle via casino bot; do NOT echo as a chat bubble
          // (echoing /bj caused a flash then delete that also raced the board message).
          console.log(`[Game] Intercepted command: ${trimmedContent} from ${socket.user.username}`);
          await handleGameCommand(io, socket, myId, socket.user.username, groupId, trimmedContent);
          // Ack only: clear optimistic "/bj …" bubble without inserting a real message
          socket.emit("group:message:ack", {
            groupId,
            tempId: tempId || null,
            suppress: true,
            isGameCommand: true,
          });
          return;
        }
      }
    }

    const { data: row, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: groupId,
        sender_id: myId,
        content: trimmedContent,
        media_url: mediaUrl || null,
        media_type: isVoice ? "voice" : (mediaType || null),
        message_type: "text",
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[GroupMessage] DB insert error:", error.message);
      socket.emit("group:message:error", {
        groupId,
        tempId: tempId || null,
        message: "Failed to send message. Please try again.",
      });
      return;
    }

    const replyMeta = replyTo && typeof replyTo === "object"
      ? {
          id: replyTo.id || null,
          text: replyTo.text || "",
          mediaType: replyTo.mediaType || null,
          from: replyTo.from || null,
        }
      : null;

    const message = {
      id: row?.id ?? crypto.randomUUID(),
      sender_id: myId,
      content: trimmedContent,
      media_url: mediaUrl,
      media_type: isVoice ? "voice" : mediaType,
      duration: isVoice
        ? Math.max(0, Math.round(Number(duration) || Number(String(trimmedContent || "").replace(/^__voice__:/, "")) || 0))
        : null,
      created_at: row?.created_at ?? new Date().toISOString(),
      reply_to: replyMeta,
      replyTo: replyMeta,
      sender: (() => {
        const cached = getCachedPublicUser(myId);
        const avatar = resolveSocketAvatar(socket);
        const displayName = cached?.displayName || socket.user.display_name || socket.user.displayName || null;
        return {
          id: myId,
          username: cached?.username || socket.user.username,
          displayName,
          display_name: displayName,
          avatar_url: avatar,
          avatarUrl: avatar,
          avatarVersion: cached?.avatarVersion || cached?.updated_at || null,
          updated_at: cached?.updated_at || null,
        };
      })(),
    };

    // Broadcast to all group members except sender
    socket.to(`group:${groupId}`).emit("group:message", { groupId, message });
    // Echo back to sender with tempId for optimistic message replacement
    socket.emit("group:message", { groupId, message, tempId });

    // Detect @mentions and notify mentioned users
    if (trimmedContent) {
      const mentionedUsernames = extractMentionedUsernames(trimmedContent);
      if (mentionedUsernames.length > 0) {
        const { data: groupMeta } = await supabase
          .from("groups")
          .select("name")
          .eq("id", groupId)
          .single();

        const { data: mentionedUsers } = await supabase
          .from("users")
          .select("id, username")
          .in("username", mentionedUsernames);

        for (const mentioned of (mentionedUsers || [])) {
          if (mentioned.id === myId) continue;
          emitMentionToUser(io, mentioned.id, {
            groupId,
            groupName: groupMeta?.name || "Grup",
            from: socket.user.username,
            text: trimmedContent,
          });
        }
      }
    }
  });

  // ========== GROUP CALL ==========

  // Check if there's an active call in the group
  socket.on("group:call:check", ({ groupId }) => {
    if (!groupId) return;
    
    const activeCall = activeGroupCalls.get(groupId);
    if (activeCall) {
      // There's an active call, notify the user to join instead
      socket.emit("group:call:active", {
        groupId,
        initiatorId: activeCall.initiatorId,
        callType: activeCall.callType,
        participants: Array.from(activeCall.participants),
      });
    } else {
      // No active call — tell client to clear any stale banner
      socket.emit("group:call:banner-update", { groupId, banner: null });
    }
  });

  // Start group call
  socket.on("group:call:start", async ({ groupId, callType, memberIds = [] } = {}) => {
    if (!groupId || !callType) {
      appendErrorLog("group:call:start", "Missing required parameters", { groupId, callType }, myId, socket.user?.username);
      return;
    }

    // Check if there's already an active call in this group
    const existingCall = activeGroupCalls.get(groupId);
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

    // Resolve targets: client memberIds, else DB group_members (never rely only on room).
    let targets = Array.isArray(memberIds)
      ? [...new Set(memberIds)].filter((id) => id && id !== myId)
      : [];
    if (targets.length === 0) {
      try {
        const { data: rows, error } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", groupId);
        if (error) {
          console.error("[GroupCall] member lookup failed:", error.message);
        } else {
          targets = (rows || [])
            .map((r) => r.user_id)
            .filter((id) => id && id !== myId);
        }
      } catch (err) {
        console.error("[GroupCall] member lookup error:", err);
      }
    }

    // Persist call start to DB
    supabase
      .from("group_calls")
      .insert({ group_id: groupId, started_by: myId, call_type: callType, status: "active" })
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) console.error("[GroupCall] DB insert error:", error.message);
        else {
          const call = activeGroupCalls.get(groupId);
          if (call) call.dbCallId = data.id;
          // Insert initiator as first participant
          supabase.from("group_call_participants").insert({ call_id: data.id, user_id: myId }).then(() => {});
        }
      });

    // Track this call as active
    activeGroupCalls.set(groupId, {
      initiatorId: myId,
      initiatorUsername: socket.user.username,
      initiatorAvatarUrl: resolveSocketAvatar(socket),
      callType,
      participants: new Set([myId]),
      allParticipants: new Set([myId]),
      startTime: Date.now(),
      dbCallId: null,
    });

    const payload = {
      groupId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: resolveSocketAvatar(socket),
      },
      callType,
    };

    // Dual delivery: per-user rooms + group room (open chats).
    targets.forEach((targetUserId) => {
      io.to(`user:${targetUserId}`).emit("group:call:incoming", payload);
    });
    socket.to(`group:${groupId}`).emit("group:call:incoming", payload);

    io.to(`group:${groupId}`).emit("group:call:started", {
      groupId,
      fromUserId: myId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: resolveSocketAvatar(socket),
      },
      callType,
    });
    void emitBannerUpdate(io, groupId);
  });

  // Accept call and send offer
  socket.on("group:call:accept", ({ groupId, toUserId }) => {
    if (!groupId || !toUserId) {
      appendErrorLog("group:call:accept", "Missing required parameters", { groupId, toUserId }, myId, socket.user?.username);
      return;
    }

    // Add participant to active call tracking
    const activeCall = activeGroupCalls.get(groupId);
    if (activeCall) {
      activeCall.participants.add(myId);
      activeCall.allParticipants.add(myId);
      if (activeCall.dbCallId) {
        supabase.from("group_call_participants")
          .insert({ call_id: activeCall.dbCallId, user_id: myId })
          .then(({ error }) => { if (error) console.error("[GroupCall] Participant insert error:", error.message); });
      }
    }

    // Notify the initiator that someone accepted
    io.to(`user:${toUserId}`).emit("group:call:accepted", {
      groupId,
      fromUserId: myId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: resolveSocketAvatar(socket),
      },
    });

    // Also notify other participants in the group that a new person joined
    socket.to(`group:${groupId}`).emit("group:call:participant-joined", {
      groupId,
      fromUserId: myId,
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: resolveSocketAvatar(socket),
      },
    });
    void emitBannerUpdate(io, groupId);
  });

  // Join existing call (new handler for joining active calls)
  socket.on("group:call:join", ({ groupId, callType }) => {
    if (!groupId) return;

    const activeCall = activeGroupCalls.get(groupId);
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
        avatar_url: resolveSocketAvatar(socket),
      },
    });

    // Send enriched participant list to the joining user
    const otherParticipantIds = Array.from(activeCall.participants).filter(id => id !== myId);
    const enrichedParticipants = otherParticipantIds.map((id) => {
      const presenceEntry = state.presence?.get(id);
      return {
        id,
        username: presenceEntry?.username || "Member",
        avatar_url: presenceEntry?.avatar_url || null,
        isScreenSharing: screenShareSessions.has(`${groupId}:${id}`),
      };
    });
    socket.emit("group:call:participants", {
      groupId,
      participants: enrichedParticipants,
      callType: activeCall.callType,
    });
    void emitBannerUpdate(io, groupId);
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
      fromUser: {
        id: myId,
        username: socket.user.username,
        avatar_url: resolveSocketAvatar(socket),
      },
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
  socket.on("group:call:leave", async ({ groupId }) => {
    if (!groupId) return;
    await removeUserFromGroupCall(io, groupId, myId, socket);
  });

  // Force-end call for everyone (initiator only)
  socket.on("group:call:end", async ({ groupId }) => {
    if (!groupId) return;

    const activeCall = activeGroupCalls.get(groupId);
    if (!activeCall) {
      await broadcastToGroupMembers(io, groupId, "group:call:banner-update", { groupId, banner: null });
      return;
    }
    if (activeCall.initiatorId !== myId) return;

    await endGroupCall(io, groupId, myId, activeCall);
  });

  // Screen share started — persist session
  socket.on("group:screen:start", ({ groupId }) => {
    if (!groupId) return;

    const activeCall = activeGroupCalls.get(groupId);
    const dbCallId = activeCall?.dbCallId ?? null;

    supabase.from("screen_share_sessions")
      .insert({ group_id: groupId, call_id: dbCallId, user_id: myId })
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) console.error("[ScreenShare] DB insert error:", error.message);
        else {
          // Store session id keyed by userId so we can close it on stop
          screenShareSessions.set(`${groupId}:${myId}`, data.id);
        }
      });

    socket.to(`group:${groupId}`).emit("group:screen:started", { groupId, fromUserId: myId });
  });

  // Screen share stopped — close DB session
  socket.on("group:screen:stop", ({ groupId }) => {
    if (!groupId) return;

    const sessionId = screenShareSessions.get(`${groupId}:${myId}`);
    if (sessionId) {
      supabase.from("screen_share_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", sessionId)
        .then(({ error }) => { if (error) console.error("[ScreenShare] DB stop error:", error.message); });
      screenShareSessions.delete(`${groupId}:${myId}`);
    }

    socket.to(`group:${groupId}`).emit("group:screen:stopped", { groupId, fromUserId: myId });
  });
}

module.exports = { registerGroupHandlers, removeUserFromAllGroupCalls };
