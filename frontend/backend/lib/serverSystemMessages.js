"use strict";

const supabase = require("../db/supabase");

const SYSTEM_BOT = {
  id: "descall-system",
  username: "System",
  displayName: "System",
  display_name: "System",
  avatar_url: "/brand/descall-logo.png",
  avatarUrl: "/brand/descall-logo.png",
  isBot: true,
};

const KIND_CONTENT = {
  member_join: ({ username, serverName }) =>
    `**${username}** joined **${serverName}**.`,
  member_leave: ({ username }) => `**${username}** left the server.`,
  member_kick: ({ username, actorName, reason }) =>
    reason
      ? `**${username}** was kicked by **${actorName}**. Reason: ${reason}`
      : `**${username}** was kicked by **${actorName}**.`,
  member_ban: ({ username, actorName, reason }) =>
    reason
      ? `**${username}** was banned by **${actorName}**. Reason: ${reason}`
      : `**${username}** was banned by **${actorName}**.`,
  member_welcome: ({ userId, serverName }) =>
    `Welcome <@${userId}> to **${serverName}**!`,
};

async function lookupUserLabel(userId) {
  if (!userId) return "Someone";
  const { data, error } = await supabase
    .from("users")
    .select("username, display_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[SystemMsg] user lookup failed:", error.message);
  }
  return data?.display_name || data?.username || "Someone";
}

async function resolveSystemChannelId(server) {
  if (!server?.id) return null;
  let channelId = server.system_channel_id || server.systemChannelId || null;
  if (!channelId) {
    channelId = server.welcome_channel_id || server.welcomeChannelId || null;
  }
  if (channelId) return channelId;

  const { data: row } = await supabase
    .from("servers")
    .select("system_channel_id, welcome_channel_id, name")
    .eq("id", server.id)
    .maybeSingle();
  return row?.system_channel_id || row?.welcome_channel_id || null;
}

async function resolveWelcomeChannelId(server) {
  if (!server?.id) return null;
  let channelId = server.welcome_channel_id || server.welcomeChannelId || null;
  if (!channelId) {
    channelId = server.system_channel_id || server.systemChannelId || null;
  }
  if (channelId) return channelId;

  const { data: row } = await supabase
    .from("servers")
    .select("system_channel_id, welcome_channel_id")
    .eq("id", server.id)
    .maybeSingle();
  return row?.welcome_channel_id || row?.system_channel_id || null;
}

/**
 * Persist + broadcast a system channel message.
 * @returns {object|null} public message payload
 */
async function postSystemMessage(io, {
  serverId,
  serverName,
  channelId: channelIdOverride,
  kind,
  content,
  meta = {},
  targetUserId = null,
  actorId = null,
  preferWelcomeChannel = false,
} = {}) {
  if (!serverId || !kind) return null;

  let channelId = channelIdOverride || null;
  if (!channelId) {
    channelId = preferWelcomeChannel
      ? await resolveWelcomeChannelId({ id: serverId })
      : await resolveSystemChannelId({ id: serverId });
  }
  if (!channelId) return null;

  const { data: channel, error: cErr } = await supabase
    .from("server_channels")
    .select("id, type, server_id")
    .eq("id", channelId)
    .eq("server_id", serverId)
    .maybeSingle();
  if (cErr) {
    console.warn("[SystemMsg] channel lookup failed:", cErr.message);
    return null;
  }
  if (!channel || (channel.type !== "text" && channel.type !== "announcement")) {
    return null;
  }

  const builder = KIND_CONTENT[kind];
  const username = meta.username || (targetUserId ? await lookupUserLabel(targetUserId) : "Someone");
  const actorName = meta.actorName || (actorId ? await lookupUserLabel(actorId) : "a moderator");
  const resolvedServerName = serverName || meta.serverName || "the server";
  const text =
    content ||
    (builder
      ? builder({
          username,
          actorName,
          reason: meta.reason || null,
          userId: targetUserId,
          serverName: resolvedServerName,
        })
      : `System: ${kind}`);

  const systemMeta = {
    kind,
    targetUserId: targetUserId || null,
    actorId: actorId || null,
    username,
    actorName,
    reason: meta.reason || null,
    ...meta,
  };

  const { data: row, error } = await supabase
    .from("server_messages")
    .insert({
      server_id: serverId,
      channel_id: channelId,
      sender_id: null,
      content: text,
      message_type: "system",
      system_kind: kind,
      system_meta: systemMeta,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[SystemMsg] insert failed:", error.message);
    return null;
  }

  const now = row?.created_at || new Date().toISOString();
  const message = {
    id: row.id,
    server_id: serverId,
    channel_id: channelId,
    sender_id: SYSTEM_BOT.id,
    sender: { ...SYSTEM_BOT },
    content: text,
    text,
    message_type: "system",
    system_kind: kind,
    system_meta: systemMeta,
    type: "system",
    isSystemMessage: true,
    isBot: true,
    created_at: now,
    timestamp: now,
  };

  const payload = { serverId, channelId, message };
  if (io) {
    try {
      io.to(`server-channel:${channelId}`).emit("server:channel:message", payload);
      io.to(`server:${serverId}`).emit("server:channel:message", payload);
    } catch (err) {
      console.warn("[SystemMsg] emit failed:", err?.message || err);
    }
  }
  return message;
}

async function postMemberJoinSystem(io, server, userId) {
  if (!server?.id || !userId) return null;
  const username = await lookupUserLabel(userId);
  const welcomeId = await resolveWelcomeChannelId(server);
  const systemId = await resolveSystemChannelId(server);

  // Prefer a welcome message when a welcome channel is configured.
  if (welcomeId) {
    await postSystemMessage(io, {
      serverId: server.id,
      serverName: server.name,
      channelId: welcomeId,
      kind: "member_welcome",
      targetUserId: userId,
      meta: { username, serverName: server.name },
    });
  }

  // Compact join line on the system channel when it differs from welcome.
  if (systemId && systemId !== welcomeId) {
    return postSystemMessage(io, {
      serverId: server.id,
      serverName: server.name,
      channelId: systemId,
      kind: "member_join",
      targetUserId: userId,
      meta: { username, serverName: server.name },
    });
  }

  // No welcome channel — fall back to a join line on system (or first available).
  if (!welcomeId) {
    return postSystemMessage(io, {
      serverId: server.id,
      serverName: server.name,
      kind: "member_join",
      targetUserId: userId,
      meta: { username, serverName: server.name },
    });
  }
  return null;
}

module.exports = {
  SYSTEM_BOT,
  postSystemMessage,
  postMemberJoinSystem,
  resolveSystemChannelId,
  resolveWelcomeChannelId,
  lookupUserLabel,
};
