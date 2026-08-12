/**
 * Server channel text chat socket handlers (Steps 4–6).
 * Room: server-channel:${channelId}
 * Events: server:channel:join | leave | message (+ ack/error)
 * Gated by VIEW_CHANNEL (join/history) and SEND_MESSAGES (send).
 */

const supabase = require("../db/supabase");
const { getCachedPublicUser, getAvatarUrl, pickChatCosmetics, ensureCosmeticsCached } = require("../lib/userProfile");
const { toUtcIso } = require("../lib/datetime");
const descoin = require("../lib/descoin");
const { shouldCreditMessage } = require("../lib/descoinMessageGuard");
const {
  Permissions,
  hasPermission,
  resolveChannelPermissions,
  resolveMemberPermissions,
} = require("../lib/serverPermissions");
const {
  executeSlashCommand,
  emitAppMessage,
  parseSlashCommand,
  isCasinoCommand,
} = require("../lib/slashCommands");

const slowmodeLastSend = new Map();

function slowmodeKey(channelId, userId) {
  return `${channelId}:${userId}`;
}

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

function buildSenderPayload(socket) {
  const myId = socket.user?.id;
  const cached = getCachedPublicUser(myId);
  const avatar = resolveSocketAvatar(socket);
  const displayName = cached?.displayName || socket.user?.display_name || socket.user?.displayName || null;
  const username = cached?.username || socket.user?.username;
  const isAdmin =
    Boolean(cached?.is_admin || cached?.isAdmin || socket.user?.is_admin) || username === "admin";
  return {
    id: myId,
    username,
    displayName,
    display_name: displayName,
    avatar_url: avatar,
    avatarUrl: avatar,
    avatarVersion: cached?.avatarVersion || cached?.updated_at || null,
    updated_at: cached?.updated_at || null,
    is_admin: isAdmin,
    isAdmin,
    ...pickChatCosmetics(cached),
  };
}

async function assertTextChannelAccess(userId, channelId, requiredFlag) {
  const { data: channel, error: cErr } = await supabase
    .from("server_channels")
    .select("id, server_id, type, name, slowmode_seconds")
    .eq("id", channelId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!channel) {
    const err = new Error("Channel not found.");
    err.status = 404;
    throw err;
  }
  if (channel.type !== "text") {
    const err = new Error("Only text channels support chat messages.");
    err.status = 400;
    err.code = "NOT_TEXT_CHANNEL";
    throw err;
  }

  const resolved = await resolveChannelPermissions(
    supabase,
    channel.server_id,
    userId,
    channelId
  );
  if (!resolved.isMember) {
    const err = new Error("You are not a member of this server.");
    err.status = 403;
    throw err;
  }
  if (requiredFlag && !hasPermission(resolved.bits, requiredFlag)) {
    const err = new Error("Missing permission.");
    err.status = 403;
    err.code = "MISSING_PERMISSION";
    throw err;
  }
  return { channel, permissions: resolved.bits, resolved };
}

async function assertServerTimeout({ userId, serverId, channelId, tempId, socket }) {
  const { data: membership, error } = await supabase
    .from("server_members")
    .select("timeout_until, timeout_reason")
    .eq("server_id", serverId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!membership?.timeout_until) return false;

  const until = new Date(membership.timeout_until);
  if (!Number.isFinite(until.getTime()) || until <= new Date()) return false;

  socket.emit("server:channel:message:error", {
    channelId,
    tempId: tempId || null,
    message: `You are timed out until ${until.toLocaleString("en-US")}.`,
    code: "TIMED_OUT",
    timeout: {
      until: until.toISOString(),
      reason: membership.timeout_reason || null,
    },
  });
  return true;
}

async function assertSlowmode({ userId, channel, channelId, channelBits, tempId, socket }) {
  const slowmodeSeconds = Math.max(0, Math.floor(Number(channel?.slowmode_seconds) || 0));
  if (!slowmodeSeconds) return false;
  if (
    hasPermission(channelBits, Permissions.ADMINISTRATOR) ||
    hasPermission(channelBits, Permissions.MANAGE_MESSAGES)
  ) {
    return false;
  }

  const { data: lastMessage, error } = await supabase
    .from("server_messages")
    .select("created_at")
    .eq("server_id", channel.server_id)
    .eq("channel_id", channelId)
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const dbTime = lastMessage?.created_at ? new Date(lastMessage.created_at).getTime() : 0;
  const memTime = slowmodeLastSend.get(slowmodeKey(channelId, userId)) || 0;
  const lastTime = Math.max(dbTime, memTime);
  if (!lastTime) return false;

  const elapsedSeconds = Math.floor((Date.now() - lastTime) / 1000);
  const retryAfterSeconds = slowmodeSeconds - elapsedSeconds;
  if (retryAfterSeconds <= 0) return false;

  socket.emit("server:channel:message:error", {
    channelId,
    tempId: tempId || null,
    message: `Slowmode is on. Try again in ${retryAfterSeconds}s.`,
    code: "SLOWMODE",
    retryAfterSeconds,
  });
  return true;
}

function markSlowmodeSend(channelId, userId) {
  slowmodeLastSend.set(slowmodeKey(channelId, userId), Date.now());
}

function registerServerChannelHandlers(io, socket) {
  const myId = socket.user?.id;
  if (!myId) return;

  /** Join the server room for structure/member live updates (not voice-only). */
  socket.on("server:subscribe", async ({ serverId } = {}) => {
    if (!serverId) return;
    try {
      const resolved = await resolveMemberPermissions(supabase, serverId, myId);
      if (!resolved.isMember) return;
      socket.join(`server:${serverId}`);
    } catch (err) {
      console.error("[ServerChannel] subscribe error:", err.message || err);
    }
  });

  socket.on("server:unsubscribe", ({ serverId } = {}) => {
    if (!serverId) return;
    socket.leave(`server:${serverId}`);
  });

  socket.on("server:channel:join", async (channelId) => {
    if (!channelId) return;
    try {
      await assertTextChannelAccess(myId, channelId, Permissions.VIEW_CHANNEL);
      socket.join(`server-channel:${channelId}`);
    } catch (err) {
      socket.emit("server:channel:error", {
        channelId,
        message: err.message || "Failed to join channel.",
        code: err.code || null,
      });
    }
  });

  socket.on("server:channels:rejoin", async (channelIds) => {
    if (!Array.isArray(channelIds)) return;
    for (const channelId of channelIds) {
      if (!channelId) continue;
      try {
        await assertTextChannelAccess(myId, channelId, Permissions.VIEW_CHANNEL);
        socket.join(`server-channel:${channelId}`);
      } catch {
        /* skip unauthorized */
      }
    }
  });

  socket.on("server:channel:leave", (channelId) => {
    if (!channelId) return;
    socket.leave(`server-channel:${channelId}`);
  });

  /** Delete a channel message (author or MANAGE_MESSAGES). */
  socket.on("server:channel:message:delete", async ({ serverId, channelId, messageId } = {}) => {
    if (!channelId || !messageId) return;
    try {
      const { channel, permissions: bits } = await assertTextChannelAccess(
        myId,
        channelId,
        Permissions.VIEW_CHANNEL
      );
      if (serverId && serverId !== channel.server_id) {
        socket.emit("server:channel:message:error", {
          channelId,
          message: "Channel does not belong to this server.",
        });
        return;
      }
      const { data: row, error } = await supabase
        .from("server_messages")
        .select("id, sender_id, channel_id, server_id")
        .eq("id", messageId)
        .eq("channel_id", channelId)
        .maybeSingle();
      if (error) throw error;
      if (!row) {
        socket.emit("server:channel:message:error", {
          channelId,
          message: "Message not found.",
        });
        return;
      }
      const canManage = hasPermission(bits, Permissions.MANAGE_MESSAGES);
      if (row.sender_id !== myId && !canManage) {
        socket.emit("server:channel:message:error", {
          channelId,
          message: "Missing permission.",
          code: "MISSING_PERMISSION",
        });
        return;
      }
      const { error: delErr } = await supabase
        .from("server_messages")
        .delete()
        .eq("id", messageId)
        .eq("channel_id", channelId);
      if (delErr) throw delErr;
      const payload = { serverId: channel.server_id, channelId, messageId };
      io.to(`server-channel:${channelId}`).emit("server:channel:message:deleted", payload);
      socket.emit("server:channel:message:deleted", payload);
    } catch (err) {
      socket.emit("server:channel:message:error", {
        channelId,
        message: err.message || "Failed to delete message.",
        code: err.code || null,
      });
    }
  });

  socket.on(
    "server:channel:message",
    async ({ serverId, channelId, tempId, content, mediaUrl, mediaType, duration, replyTo } = {}) => {
      try {
        try {
          const { getActiveTimeout } = require("../lib/moderation");
          const to = getActiveTimeout(myId);
          if (to) {
            socket.emit("server:channel:message:error", {
              channelId,
              tempId: tempId || null,
              message: to.message || "You are timed out and cannot send messages.",
              code: "TIMED_OUT",
              timeout: to,
            });
            return;
          }
        } catch {
          /* ignore */
        }

        if (!channelId || (!content?.trim() && !mediaUrl)) {
          if (tempId) {
            socket.emit("server:channel:message:error", {
              channelId,
              tempId,
              message: "Missing message content.",
            });
          }
          return;
        }

        const { channel, permissions: channelBits } = await assertTextChannelAccess(
          myId,
          channelId,
          Permissions.SEND_MESSAGES
        );
        if (!hasPermission(channelBits, Permissions.VIEW_CHANNEL)) {
          socket.emit("server:channel:message:error", {
            channelId,
            tempId: tempId || null,
            message: "Missing permission.",
            code: "MISSING_PERMISSION",
          });
          return;
        }

        if (
          await assertServerTimeout({
            userId: myId,
            serverId: channel.server_id,
            channelId,
            tempId,
            socket,
          })
        ) {
          return;
        }

        if (
          await assertSlowmode({
            userId: myId,
            channel,
            channelId,
            channelBits,
            tempId,
            socket,
          })
        ) {
          return;
        }

        if (serverId && serverId !== channel.server_id) {
          socket.emit("server:channel:message:error", {
            channelId,
            tempId: tempId || null,
            message: "Channel does not belong to this server.",
          });
          return;
        }

        const isVoice = mediaType === "voice" || mediaType === "audio";
        let trimmedContent = content?.trim() || null;
        if (isVoice && mediaUrl) {
          const dur = Math.max(0, Math.round(Number(duration) || 0));
          if (!trimmedContent || !trimmedContent.startsWith("__voice__:")) {
            trimmedContent = `__voice__:${dur || 1}`;
          }
        }

        // Gate @everyone / @here without MENTION_EVERYONE
        if (
          trimmedContent &&
          /(^|\s)@(everyone|here)\b/i.test(trimmedContent) &&
          !hasPermission(channelBits, Permissions.MENTION_EVERYONE)
        ) {
          socket.emit("server:channel:message:error", {
            channelId,
            tempId: tempId || null,
            message: "You cannot mention @everyone here.",
            code: "MISSING_PERMISSION",
          });
          return;
        }

        // Slash commands — casino stays delegated to gameHandlers; app commands use the registry.
        if (trimmedContent && trimmedContent.startsWith("/")) {
          const parsed = parseSlashCommand(trimmedContent);
          if (parsed && (isCasinoCommand(parsed.name) || parsed.name)) {
            const sender = buildSenderPayload(socket);
            const result = await executeSlashCommand({
              io,
              socket,
              context: "server",
              userId: myId,
              roomId: channelId,
              serverId: channel.server_id,
              channelId,
              channel,
              permissions: channelBits,
              sender,
              content: trimmedContent,
              gameOptions: {
                channelId,
                serverId: channel.server_id,
              },
            });
            if (!result.handled) {
              // Unknown slash command is treated like normal text for compatibility.
            } else {
              if (result.message && result.message.sender_id !== myId) {
                emitAppMessage({
                  io,
                  socket,
                  context: "server",
                  roomId: channelId,
                  message: result.message,
                });
              }
              if (result.message?.id && result.message?.sender_id === myId) {
                socket.to(`server-channel:${channelId}`).emit("server:channel:message", {
                  serverId: channel.server_id,
                  channelId,
                  message: result.message,
                });
              }
              if (result.message?.sender_id !== myId) {
                socket.emit("server:channel:message:ack", {
                  channelId,
                  tempId: tempId || null,
                  suppress: true,
                  isGameCommand: isCasinoCommand(parsed.name),
                  isAppCommand: !isCasinoCommand(parsed.name),
                });
              } else {
                socket.emit("server:channel:message", {
                  serverId: channel.server_id,
                  channelId,
                  message: result.message,
                  tempId,
                });
              }
              markSlowmodeSend(channelId, myId);
              if (result.message?.sender_id === myId) {
                return;
              }
              return;
            }
          }
        }

        const replyMeta =
          replyTo && typeof replyTo === "object"
            ? {
                id: replyTo.id || null,
                text: replyTo.text || "",
                mediaType: replyTo.mediaType || null,
                from: replyTo.from || null,
              }
            : null;

        const { data: row, error } = await supabase
          .from("server_messages")
          .insert({
            server_id: channel.server_id,
            channel_id: channelId,
            sender_id: myId,
            content: trimmedContent,
            media_url: mediaUrl || null,
            media_type: isVoice ? "voice" : mediaType || null,
            reply_to: replyMeta,
          })
          .select("id, created_at")
          .single();

        if (error) {
          console.error("[ServerChannel] DB insert error:", error.message);
          socket.emit("server:channel:message:error", {
            channelId,
            tempId: tempId || null,
            message: "Failed to send message. Please try again.",
          });
          return;
        }
        markSlowmodeSend(channelId, myId);

        if (trimmedContent && shouldCreditMessage(myId, trimmedContent)) {
          descoin
            .creditCapped(myId, 1, "message_activity", {
              context: "server_channel",
              serverId: channel.server_id,
              channelId,
            })
            .then((result) => {
              if (result.credited > 0) {
                socket.emit("descoin:balance", {
                  balance: result.balance,
                  delta: result.credited,
                  reason: "message_activity",
                });
              }
            })
            .catch((err) =>
              console.warn("[DesCoin] server channel message credit failed:", err?.message || err)
            );
        }

        await ensureCosmeticsCached([myId]).catch(() => {});

        const message = {
          id: row?.id ?? crypto.randomUUID(),
          server_id: channel.server_id,
          channel_id: channelId,
          sender_id: myId,
          content: trimmedContent,
          media_url: mediaUrl,
          media_type: isVoice ? "voice" : mediaType,
          duration: isVoice
            ? Math.max(
                0,
                Math.round(
                  Number(duration) ||
                    Number(String(trimmedContent || "").replace(/^__voice__:/, "")) ||
                    0
                )
              )
            : null,
          created_at: toUtcIso(row?.created_at) || new Date().toISOString(),
          reply_to: replyMeta,
          replyTo: replyMeta,
          sender: buildSenderPayload(socket),
        };

        const room = `server-channel:${channelId}`;
        socket.to(room).emit("server:channel:message", {
          serverId: channel.server_id,
          channelId,
          message,
        });
        socket.emit("server:channel:message", {
          serverId: channel.server_id,
          channelId,
          message,
          tempId,
        });

        // Direct @mention alerts (works even if the target is not in the channel room)
        if (trimmedContent) {
          const mentionedUsernames = [
            ...new Set(
              [...trimmedContent.matchAll(/@(\w{1,32})/g)].map((m) => m[1].toLowerCase())
            ),
          ];
          if (mentionedUsernames.length > 0) {
            const [{ data: serverMeta }, { data: mentionedUsers }] = await Promise.all([
              supabase.from("servers").select("name").eq("id", channel.server_id).maybeSingle(),
              supabase
                .from("users")
                .select("id, username")
                .or(mentionedUsernames.map((u) => `username.ilike.${u}`).join(",")),
            ]);
            const candidates = (mentionedUsers || []).filter((u) => {
              if (!u?.id || u.id === myId) return false;
              return mentionedUsernames.includes(String(u.username || "").toLowerCase());
            });
            const candidateIds = candidates.map((u) => u.id);
            if (candidateIds.length > 0) {
              const { data: memberRows } = await supabase
                .from("server_members")
                .select("user_id")
                .eq("server_id", channel.server_id)
                .in("user_id", candidateIds);
              const memberSet = new Set((memberRows || []).map((r) => r.user_id));
              const fromName =
                message.sender?.username || socket.user?.username || "Someone";
              for (const uid of candidateIds) {
                if (!memberSet.has(uid)) continue;
                io.to(`user:${uid}`).emit("mention:received", {
                  serverId: channel.server_id,
                  channelId,
                  channelName: channel.name || null,
                  serverName: serverMeta?.name || null,
                  messageId: message.id,
                  from: fromName,
                  text: trimmedContent,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("[ServerChannel] message error:", err);
        socket.emit("server:channel:message:error", {
          channelId,
          tempId: tempId || null,
          message: err.message || "Failed to send message.",
          code: err.code || null,
        });
      }
    }
  );
}

module.exports = {
  registerServerChannelHandlers,
  assertTextChannelAccess,
};
