/**
 * Server voice channel hangouts (Step 10).
 * Mesh WebRTC signaling keyed by channelId — same model as group hangouts,
 * no SFU yet (Step 11).
 *
 * Events:
 *  server:voice:join | leave | check | subscribe
 *  server:voice:offer | answer | ice | media-state
 * Server emits:
 *  server:voice:joined | error | member-joined | member-left | channel-state | states
 */

"use strict";

const supabase = require("../db/supabase");
const { activeServerVoiceCalls } = require("../runtime/sharedState");
const { getCachedPublicUser, getAvatarUrl, pickChatCosmetics } = require("../lib/userProfile");
const {
  Permissions,
  hasPermission,
  resolveMemberPermissions,
} = require("../lib/serverPermissions");

function resolvePublicUser(socket) {
  const myId = socket.user?.id;
  const cached = getCachedPublicUser(myId);
  const avatar =
    cached?.avatarUrl ||
    cached?.avatar_url ||
    getAvatarUrl(myId) ||
    socket.user?.avatar_url ||
    null;
  const displayName =
    cached?.displayName || socket.user?.display_name || socket.user?.displayName || null;
  const username = cached?.username || socket.user?.username;
  return {
    id: myId,
    username,
    displayName,
    display_name: displayName,
    avatarUrl: avatar,
    avatar_url: avatar,
    muted: false,
    ...pickChatCosmetics(cached),
  };
}

function roomMembers(channelId) {
  const call = activeServerVoiceCalls.get(channelId);
  if (!call) return [];
  return Array.from(call.participants.values());
}

function emitChannelState(io, serverId, channelId) {
  const members = roomMembers(channelId);
  const payload = {
    serverId,
    channelId,
    memberCount: members.length,
    members,
  };
  io.to(`server:${serverId}`).emit("server:voice:channel-state", payload);
  io.to(`server-voice:${channelId}`).emit("server:voice:channel-state", payload);
  return payload;
}

async function assertVoiceAccess(userId, channelId) {
  const { data: channel, error } = await supabase
    .from("server_channels")
    .select("id, server_id, type, name")
    .eq("id", channelId)
    .maybeSingle();
  if (error) throw error;
  if (!channel) {
    const err = new Error("Channel not found.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (channel.type !== "voice") {
    const err = new Error("Not a voice channel.");
    err.code = "NOT_VOICE_CHANNEL";
    throw err;
  }
  const resolved = await resolveMemberPermissions(supabase, channel.server_id, userId);
  if (!resolved.isMember) {
    const err = new Error("You are not a member of this server.");
    err.code = "NOT_MEMBER";
    throw err;
  }
  if (!hasPermission(resolved.bits, Permissions.CONNECT)) {
    const err = new Error("Missing CONNECT permission.");
    err.code = "MISSING_PERMISSION";
    throw err;
  }
  return { channel, resolved };
}

function removeFromVoice(io, channelId, userId) {
  const call = activeServerVoiceCalls.get(channelId);
  if (!call) return null;
  call.participants.delete(userId);
  io.to(`server-voice:${channelId}`).emit("server:voice:member-left", {
    serverId: call.serverId,
    channelId,
    userId,
  });
  const state = emitChannelState(io, call.serverId, channelId);
  if (call.participants.size === 0) {
    activeServerVoiceCalls.delete(channelId);
  }
  return state;
}

function removeUserFromAllServerVoice(io, userId) {
  for (const [channelId, call] of activeServerVoiceCalls.entries()) {
    if (call.participants.has(userId)) {
      removeFromVoice(io, channelId, userId);
    }
  }
}

function registerServerVoiceHandlers(io, socket) {
  const myId = socket.user?.id;
  if (!myId) return;

  socket.on("server:voice:subscribe", async ({ serverId } = {}) => {
    if (!serverId) return;
    try {
      const resolved = await resolveMemberPermissions(supabase, serverId, myId);
      if (!resolved.isMember) return;
      socket.join(`server:${serverId}`);
      const states = [];
      for (const [channelId, call] of activeServerVoiceCalls.entries()) {
        if (call.serverId === serverId) {
          states.push({
            serverId,
            channelId,
            memberCount: call.participants.size,
            members: Array.from(call.participants.values()),
          });
        }
      }
      socket.emit("server:voice:states", { serverId, states });
    } catch (err) {
      console.error("[ServerVoice] subscribe error:", err.message || err);
    }
  });

  socket.on("server:voice:check", async ({ channelId } = {}) => {
    if (!channelId) return;
    try {
      const { channel } = await assertVoiceAccess(myId, channelId);
      socket.join(`server:${channel.server_id}`);
      const call = activeServerVoiceCalls.get(channelId);
      socket.emit("server:voice:channel-state", {
        serverId: channel.server_id,
        channelId,
        memberCount: call ? call.participants.size : 0,
        members: call ? Array.from(call.participants.values()) : [],
      });
    } catch (err) {
      socket.emit("server:voice:error", {
        channelId,
        message: err.message || "Failed to check voice channel.",
        code: err.code || null,
      });
    }
  });

  socket.on("server:voice:join", async ({ serverId, channelId } = {}) => {
    if (!channelId) return;
    try {
      const { channel } = await assertVoiceAccess(myId, channelId);
      if (serverId && serverId !== channel.server_id) {
        socket.emit("server:voice:error", {
          channelId,
          message: "Server mismatch.",
          code: "SERVER_MISMATCH",
        });
        return;
      }

      // Leave any other server voice channel first (one at a time)
      for (const [otherId, call] of activeServerVoiceCalls.entries()) {
        if (otherId !== channelId && call.participants.has(myId)) {
          removeFromVoice(io, otherId, myId);
          socket.leave(`server-voice:${otherId}`);
        }
      }

      let call = activeServerVoiceCalls.get(channelId);
      if (!call) {
        call = {
          serverId: channel.server_id,
          channelName: channel.name,
          participants: new Map(),
          startTime: Date.now(),
        };
        activeServerVoiceCalls.set(channelId, call);
      }

      const mePublic = resolvePublicUser(socket);
      call.participants.set(myId, mePublic);

      socket.join(`server:${channel.server_id}`);
      socket.join(`server-voice:${channelId}`);

      const others = Array.from(call.participants.values()).filter((p) => p.id !== myId);
      socket.emit("server:voice:joined", {
        serverId: channel.server_id,
        channelId,
        channelName: channel.name,
        participants: others,
      });

      socket.to(`server-voice:${channelId}`).emit("server:voice:member-joined", {
        serverId: channel.server_id,
        channelId,
        user: mePublic,
      });

      emitChannelState(io, channel.server_id, channelId);
    } catch (err) {
      console.error("[ServerVoice] join error:", err.message || err);
      socket.emit("server:voice:error", {
        channelId,
        message: err.message || "Failed to join voice channel.",
        code: err.code || null,
      });
    }
  });

  socket.on("server:voice:leave", ({ channelId } = {}) => {
    if (!channelId) return;
    removeFromVoice(io, channelId, myId);
    socket.leave(`server-voice:${channelId}`);
    socket.emit("server:voice:left", { channelId });
  });

  socket.on("server:voice:offer", ({ channelId, toUserId, offer } = {}) => {
    if (!channelId || !toUserId || !offer) return;
    const call = activeServerVoiceCalls.get(channelId);
    if (!call?.participants.has(myId)) return;
    io.to(`user:${toUserId}`).emit("server:voice:offer", {
      channelId,
      fromUserId: myId,
      fromUser: call.participants.get(myId) || resolvePublicUser(socket),
      offer,
    });
  });

  socket.on("server:voice:answer", ({ channelId, toUserId, answer } = {}) => {
    if (!channelId || !toUserId || !answer) return;
    const call = activeServerVoiceCalls.get(channelId);
    if (!call?.participants.has(myId)) return;
    io.to(`user:${toUserId}`).emit("server:voice:answer", {
      channelId,
      fromUserId: myId,
      answer,
    });
  });

  socket.on("server:voice:ice", ({ channelId, toUserId, candidate } = {}) => {
    if (!channelId || !toUserId || !candidate) return;
    const call = activeServerVoiceCalls.get(channelId);
    if (!call?.participants.has(myId)) return;
    io.to(`user:${toUserId}`).emit("server:voice:ice", {
      channelId,
      fromUserId: myId,
      candidate,
    });
  });

  socket.on("server:voice:media-state", ({ channelId, muted } = {}) => {
    if (!channelId) return;
    const call = activeServerVoiceCalls.get(channelId);
    if (!call?.participants.has(myId)) return;
    const me = call.participants.get(myId);
    if (me) {
      me.muted = Boolean(muted);
      call.participants.set(myId, me);
    }
    socket.to(`server-voice:${channelId}`).emit("server:voice:media-state", {
      channelId,
      fromUserId: myId,
      muted: Boolean(muted),
    });
    emitChannelState(io, call.serverId, channelId);
  });
}

module.exports = {
  registerServerVoiceHandlers,
  removeUserFromAllServerVoice,
};
