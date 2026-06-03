"use strict";

const supabase = require("../db/supabase");

function emitToUser(io, userId, event, payload) {
  for (const [socketId, socket] of io.sockets.sockets) {
    if (socket.userId === userId) {
      socket.emit(event, payload);
    }
  }
}

function broadcastToGuild(io, guildId, event, payload) {
  io.to(`guild:${guildId}`).emit(event, payload);
}

async function fetchGuildPayload(guildId) {
  const { data: guild, error: guildError } = await supabase
    .from("guilds")
    .select("id, name, icon_url, owner_id, created_at")
    .eq("id", guildId)
    .single();
  if (guildError || !guild) return null;

  const { data: channels } = await supabase
    .from("guild_channels")
    .select("id, name, type, position, parent_id")
    .eq("guild_id", guildId)
    .order("position", { ascending: true });

  const { data: members } = await supabase
    .from("guild_members")
    .select("user_id, nickname, joined_at")
    .eq("guild_id", guildId);

  const memberUserIds = members?.map((m) => m.user_id) || [];
  let memberUsers = [];
  if (memberUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, avatar_url, status")
      .in("id", memberUserIds);
    memberUsers = users || [];
  }

  const enrichedMembers = members?.map((m) => {
    const user = memberUsers.find((u) => u.id === m.user_id);
    return { ...m, user: user || { id: m.user_id, username: "Unknown" } };
  }) || [];

  return { ...guild, channels: channels || [], members: enrichedMembers };
}

async function isGuildMember(guildId, userId) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("guild_id")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .single();
  return !error && !!data;
}

function registerGuildHandlers(io, socket) {
  const myId = socket.userId;
  if (!myId) return;

  // Join guild rooms on connect (client sends guild IDs after connection)
  socket.on("guilds:subscribe", async (guildIds) => {
    if (!Array.isArray(guildIds)) return;
    for (const guildId of guildIds) {
      const member = await isGuildMember(guildId, myId);
      if (member) {
        socket.join(`guild:${guildId}`);
      }
    }
  });

  // Guild created — broadcast to creator only (others will see via refresh)
  socket.on("guild:create", async ({ name, iconUrl }) => {
    if (!name || typeof name !== "string" || name.trim().length === 0) return;

    const trimmedName = name.trim();
    const { data: guild, error } = await supabase
      .from("guilds")
      .insert({ name: trimmedName, icon_url: iconUrl || null, owner_id: myId })
      .select()
      .single();

    if (error || !guild) {
      socket.emit("guild:error", { message: "Failed to create guild" });
      return;
    }

    // Add owner as member
    await supabase.from("guild_members").insert({ guild_id: guild.id, user_id: myId });

    // Create default channels
    await supabase.from("guild_channels").insert([
      { guild_id: guild.id, name: "general", type: "text", position: 0 },
      { guild_id: guild.id, name: "General", type: "voice", position: 1 },
    ]);

    const payload = await fetchGuildPayload(guild.id);
    socket.join(`guild:${guild.id}`);
    socket.emit("guild:created", { guild: payload });
  });

  // Guild deleted
  socket.on("guild:delete", async ({ guildId }) => {
    if (!guildId) return;

    const { data: guild } = await supabase
      .from("guilds")
      .select("owner_id")
      .eq("id", guildId)
      .single();

    if (!guild || guild.owner_id !== myId) {
      socket.emit("guild:error", { message: "Only the owner can delete the guild" });
      return;
    }

    await supabase.from("guilds").delete().eq("id", guildId);
    broadcastToGuild(io, guildId, "guild:deleted", { guildId });
    io.socketsLeave(`guild:${guildId}`);
  });

  // Member joined via invite
  socket.on("guild:join", async ({ inviteCode }) => {
    if (!inviteCode || typeof inviteCode !== "string") return;

    const { data: invite, error: inviteError } = await supabase
      .from("guild_invites")
      .select("code, guild_id, max_uses, uses, expires_at")
      .eq("code", inviteCode)
      .single();

    if (inviteError || !invite) {
      socket.emit("guild:error", { message: "Invalid or expired invite code" });
      return;
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabase.from("guild_invites").delete().eq("code", inviteCode);
      socket.emit("guild:error", { message: "Invite has expired" });
      return;
    }

    // Check max uses
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) {
      await supabase.from("guild_invites").delete().eq("code", inviteCode);
      socket.emit("guild:error", { message: "Invite has reached maximum uses" });
      return;
    }

    // Check if already member
    const alreadyMember = await isGuildMember(invite.guild_id, myId);
    if (alreadyMember) {
      socket.emit("guild:error", { message: "You are already a member of this guild" });
      return;
    }

    // Add member
    const { error: memberError } = await supabase
      .from("guild_members")
      .insert({ guild_id: invite.guild_id, user_id: myId });

    if (memberError) {
      socket.emit("guild:error", { message: "Failed to join guild" });
      return;
    }

    // Update invite uses
    await supabase
      .from("guild_invites")
      .update({ uses: invite.uses + 1 })
      .eq("code", inviteCode);

    if (invite.max_uses !== null && invite.uses + 1 >= invite.max_uses) {
      await supabase.from("guild_invites").delete().eq("code", inviteCode);
    }

    const payload = await fetchGuildPayload(invite.guild_id);
    socket.join(`guild:${invite.guild_id}`);
    socket.emit("guild:joined", { guild: payload });
    broadcastToGuild(io, invite.guild_id, "guild:member:joined", {
      guildId: invite.guild_id,
      userId: myId,
    });
  });

  // Member left
  socket.on("guild:leave", async ({ guildId }) => {
    if (!guildId) return;

    const { data: guild } = await supabase
      .from("guilds")
      .select("owner_id")
      .eq("id", guildId)
      .single();

    if (guild && guild.owner_id === myId) {
      socket.emit("guild:error", { message: "Owner must transfer ownership or delete the guild" });
      return;
    }

    await supabase
      .from("guild_members")
      .delete()
      .eq("guild_id", guildId)
      .eq("user_id", myId);

    socket.leave(`guild:${guildId}`);
    socket.emit("guild:left", { guildId });
    broadcastToGuild(io, guildId, "guild:member:left", { guildId, userId: myId });
  });

  // Channel created
  socket.on("guild:channel:create", async ({ guildId, name, type, parentId }) => {
    if (!guildId || !name || !type) return;

    const member = await isGuildMember(guildId, myId);
    if (!member) {
      socket.emit("guild:error", { message: "You are not a member of this guild" });
      return;
    }

    const { data: maxPos } = await supabase
      .from("guild_channels")
      .select("position")
      .eq("guild_id", guildId)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const position = (maxPos?.position ?? -1) + 1;

    const { data: channel, error } = await supabase
      .from("guild_channels")
      .insert({
        guild_id: guildId,
        name: name.trim(),
        type,
        position,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error || !channel) {
      socket.emit("guild:error", { message: "Failed to create channel" });
      return;
    }

    broadcastToGuild(io, guildId, "guild:channel:created", { guildId, channel });
  });

  // Channel deleted
  socket.on("guild:channel:delete", async ({ guildId, channelId }) => {
    if (!guildId || !channelId) return;

    const member = await isGuildMember(guildId, myId);
    if (!member) {
      socket.emit("guild:error", { message: "You are not a member of this guild" });
      return;
    }

    await supabase
      .from("guild_channels")
      .delete()
      .eq("id", channelId)
      .eq("guild_id", guildId);

    broadcastToGuild(io, guildId, "guild:channel:deleted", { guildId, channelId });
  });

  // Invite created (socket event for real-time notification)
  socket.on("guild:invite:create", async ({ guildId, maxUses, expiresInHours }) => {
    if (!guildId) return;

    const member = await isGuildMember(guildId, myId);
    if (!member) {
      socket.emit("guild:error", { message: "You are not a member of this guild" });
      return;
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const { data: invite, error } = await supabase
      .from("guild_invites")
      .insert({
        code,
        guild_id: guildId,
        creator_id: myId,
        max_uses: maxUses || null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error || !invite) {
      socket.emit("guild:error", { message: "Failed to create invite" });
      return;
    }

    socket.emit("guild:invite:created", { invite });
  });

  // ─── Guild Messages (Real-time) ───

  // Send message in a guild channel
  socket.on("guild:message", async ({ guildId, channelId, content, mediaUrl, mediaType, replyTo }) => {
    if (!guildId || !channelId) return;
    const member = await isGuildMember(guildId, myId);
    if (!member) {
      socket.emit("guild:error", { message: "You are not a member of this guild" });
      return;
    }

    const { data: message, error } = await supabase
      .from("guild_messages")
      .insert({
        guild_id: guildId,
        channel_id: channelId,
        sender_id: myId,
        content: content || null,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        reply_to: replyTo || null,
      })
      .select()
      .single();

    if (error || !message) {
      socket.emit("guild:error", { message: "Failed to send message" });
      return;
    }

    // Fetch sender info
    const { data: sender } = await supabase
      .from("users")
      .select("id, username, avatar_url, status")
      .eq("id", myId)
      .single();

    const payload = { ...message, sender: sender || { id: myId, username: "Unknown" }, reactions: [] };
    broadcastToGuild(io, guildId, "guild:message:new", { guildId, channelId, message: payload });
  });

  // Edit message
  socket.on("guild:message:edit", async ({ guildId, channelId, messageId, content }) => {
    if (!guildId || !channelId || !messageId) return;
    const member = await isGuildMember(guildId, myId);
    if (!member) return;

    const { data: existing } = await supabase
      .from("guild_messages")
      .select("sender_id")
      .eq("id", messageId)
      .single();

    if (!existing || existing.sender_id !== myId) {
      socket.emit("guild:error", { message: "You can only edit your own messages" });
      return;
    }

    const { data: message, error } = await supabase
      .from("guild_messages")
      .update({
        content: content?.trim(),
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .select()
      .single();

    if (error || !message) return;

    broadcastToGuild(io, guildId, "guild:message:edited", { guildId, channelId, message });
  });

  // Delete message
  socket.on("guild:message:delete", async ({ guildId, channelId, messageId }) => {
    if (!guildId || !channelId || !messageId) return;
    const member = await isGuildMember(guildId, myId);
    if (!member) return;

    const { data: existing } = await supabase
      .from("guild_messages")
      .select("sender_id")
      .eq("id", messageId)
      .single();

    const isOwner = await isGuildOwner(guildId, myId);
    if (!existing || (existing.sender_id !== myId && !isOwner)) {
      socket.emit("guild:error", { message: "You can only delete your own messages" });
      return;
    }

    await supabase.from("guild_messages").delete().eq("id", messageId);
    broadcastToGuild(io, guildId, "guild:message:deleted", { guildId, channelId, messageId });
  });

  // Add reaction
  socket.on("guild:message:reaction", async ({ guildId, channelId, messageId, emoji }) => {
    if (!guildId || !channelId || !messageId || !emoji) return;
    const member = await isGuildMember(guildId, myId);
    if (!member) return;

    const { data: reaction, error } = await supabase
      .from("guild_message_reactions")
      .insert({ message_id: messageId, user_id: myId, emoji })
      .select()
      .single();

    if (error) return;
    broadcastToGuild(io, guildId, "guild:reaction:added", { guildId, channelId, messageId, reaction });
  });

  // Remove reaction
  socket.on("guild:message:reaction:remove", async ({ guildId, channelId, messageId, emoji }) => {
    if (!guildId || !channelId || !messageId || !emoji) return;
    const member = await isGuildMember(guildId, myId);
    if (!member) return;

    await supabase
      .from("guild_message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", myId)
      .eq("emoji", emoji);

    broadcastToGuild(io, guildId, "guild:reaction:removed", { guildId, channelId, messageId, userId: myId, emoji });
  });

  // Typing indicator
  socket.on("guild:typing", async ({ guildId, channelId }) => {
    if (!guildId || !channelId) return;
    const member = await isGuildMember(guildId, myId);
    if (!member) return;

    const { data: user } = await supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", myId)
      .single();

    socket.to(`guild:${guildId}`).emit("guild:typing", { guildId, channelId, user: user || { id: myId, username: "Unknown" } });
  });
}

module.exports = { registerGuildHandlers };
