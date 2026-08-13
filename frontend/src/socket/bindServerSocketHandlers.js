import { getServer } from "../api/servers";
import { getUser } from "../lib/storage";
import { normalizeUser } from "../lib/userProfile";
import { isChannelMuted } from "../lib/serverChannelMutes";
import { parseAppDate } from "../lib/datetime";
import { parseVoiceMeta } from "../lib/voiceMessage";

const SERVER_EVENTS = [
  "server:channel:message:ack",
  "server:channel:message",
  "server:channel:message:deleted",
  "server:channel:message:error",
  "server:channel:message:edited",
  "server:channel:message:pinned",
  "server:channel:message:unpinned",
  "server:announcement",
  "server:member:removed",
  "server:channel:created",
  "server:channel:updated",
  "server:channel:deleted",
  "server:channels:resync",
  "server:role:created",
  "server:role:updated",
  "server:role:deleted",
  "server:member:joined",
  "server:member:updated",
  "server:member:roles-changed",
];

function sortMessagesChronologically(messages) {
  return [...messages].sort((a, b) => {
    const aTime = parseAppDate(a?.timestamp || a?.created_at)?.getTime() || 0;
    const bTime = parseAppDate(b?.timestamp || b?.created_at)?.getTime() || 0;
    return aTime - bTime;
  });
}

function makePatchPinState() {
  return (messageId, pinnedAt, pinnedBy) => {
    const patchList = (list) => {
      if (!Array.isArray(list)) return list;
      let changed = false;
      const next = list.map((m) => {
        if (m.id !== messageId) return m;
        changed = true;
        return { ...m, pinnedAt: pinnedAt || null, pinnedBy: pinnedBy || null };
      });
      return changed ? next : list;
    };
    return patchList;
  };
}

/**
 * Binds all `server:*` socket handlers (channel messages, roles, members,
 * channel CRUD, announcements) used while viewing a server.
 *
 * @param {import("socket.io-client").Socket} socket
 * @param {object} ctx
 * @param {Function} ctx.setChannelMessagesById
 * @param {Function} ctx.setFriendNotice
 * @param {Function} ctx.setMyServers
 * @param {Function} ctx.setActiveServer
 * @param {Function} ctx.setActiveChannel
 * @param {{current: string}} ctx.activeViewRef
 * @param {{current: object|null}} ctx.activeServerRef
 * @param {{current: object|null}} ctx.activeChannelRef
 * @param {{current: string|null}} ctx.myIdRef
 * @param {{current: Function|null}} ctx.bumpChannelUnreadRef
 * @param {{current: object|null}} ctx.serverVoiceRef
 * @param {Function} ctx.toast
 * @param {Function} ctx.t
 * @param {Function} ctx.navigate
 * @param {Function} ctx.getServerNotificationLevel
 * @param {Function} ctx.playUiSound
 * @returns {Function} unbind - removes all listeners registered by this call.
 */
export function bindServerSocketHandlers(socket, ctx) {
  const {
    setChannelMessagesById,
    setFriendNotice,
    setMyServers,
    setActiveServer,
    setActiveChannel,
    activeViewRef,
    activeServerRef,
    activeChannelRef,
    myIdRef,
    bumpChannelUnreadRef,
    serverVoiceRef,
    toast,
    t,
    navigate,
    getServerNotificationLevel,
    playUiSound,
  } = ctx;

  const patchPinState = makePatchPinState();

  const upsertServerChannel = (serverId, channel) => {
    if (!serverId || !channel?.id) return;
    const merge = (channels = []) => {
      const idx = channels.findIndex((c) => String(c.id) === String(channel.id));
      if (idx === -1) return [...channels, channel];
      const next = channels.slice();
      next[idx] = { ...next[idx], ...channel };
      return next;
    };
    setMyServers((prev) =>
      prev.map((s) =>
        String(s.id) === String(serverId) ? { ...s, channels: merge(s.channels || []) } : s
      )
    );
    setActiveServer((prev) => {
      if (!prev || String(prev.id) !== String(serverId)) return prev;
      return { ...prev, channels: merge(prev.channels || []) };
    });
    setActiveChannel((prev) =>
      prev && String(prev.id) === String(channel.id) ? { ...prev, ...channel } : prev
    );
  };

  const upsertServerRole = (serverId, role) => {
    if (!serverId || !role?.id) return;
    const merge = (roles = []) => {
      const idx = roles.findIndex((r) => String(r.id) === String(role.id));
      if (idx === -1) return [...roles, role];
      const next = roles.slice();
      next[idx] = { ...next[idx], ...role };
      return next;
    };
    setMyServers((prev) =>
      prev.map((s) =>
        String(s.id) === String(serverId) ? { ...s, roles: merge(s.roles || []) } : s
      )
    );
    setActiveServer((prev) => {
      if (!prev || String(prev.id) !== String(serverId)) return prev;
      return { ...prev, roles: merge(prev.roles || []) };
    });
  };

  const refreshServerBundle = (serverId) => {
    if (!serverId) return;
    getServer(serverId)
      .then((data) => {
        if (!data?.server) return;
        setActiveServer((prev) =>
          prev && String(prev.id) === String(serverId) ? { ...prev, ...data.server } : prev
        );
        setMyServers((prev) =>
          prev.map((s) =>
            String(s.id) === String(serverId) ? { ...s, ...data.server } : s
          )
        );
        // Drop active channel if it disappeared after permission/visibility change.
        setActiveChannel((prev) => {
          if (!prev) return prev;
          const stillThere = (data.server.channels || []).some(
            (c) => String(c.id) === String(prev.id)
          );
          return stillThere ? prev : null;
        });
      })
      .catch(() => {});
  };

  const handleChannelMessageAck = ({ channelId, tempId, suppress } = {}) => {
    if (!channelId || !tempId || !suppress) return;
    setChannelMessagesById((prev) => {
      const cur = prev[channelId] ?? [];
      return { ...prev, [channelId]: cur.filter((m) => m.id !== tempId) };
    });
  };

  const handleChannelMessage = ({ serverId, channelId, message, tempId } = {}) => {
    if (!channelId || !message) return;
    const isSystem =
      message.message_type === "system" ||
      message.type === "system" ||
      Boolean(message.isSystemMessage) ||
      Boolean(message.system_kind);
    const sender = normalizeUser(
      message.sender || {
        id: isSystem ? "descall-system" : message.sender_id,
        username: isSystem ? "System" : message.sender?.username || "Unknown",
        display_name: isSystem
          ? "System"
          : message.sender?.display_name || message.sender?.displayName,
        avatar_url: isSystem
          ? "/brand/descall-logo.png"
          : message.sender?.avatar_url,
        updated_at: message.sender?.updated_at,
      }
    );
    const voice = parseVoiceMeta(message.content, message.media_type);
    const hasEmbed = Boolean(message.embed && typeof message.embed === "object");
    const isAppBot =
      Boolean(message.isAppMessage || message.isBot || sender?.isBot) ||
      sender?.id === "descall-apps" ||
      sender?.id === "descall-system";
    const normalized = {
      id: message.id,
      from: isAppBot || isSystem ? { ...sender, isBot: true } : sender,
      username: sender?.username || "Unknown",
      displayName: sender?.displayName || null,
      avatarUrl: sender?.avatarUrl,
      // Prefer rich embed UI — keep content only as fallback when no embed.
      text: voice.isVoice ? "" : hasEmbed ? "" : (message.content || ""),
      timestamp: parseAppDate(message.created_at)?.toISOString() || new Date().toISOString(),
      mediaUrl: message.media_url,
      mediaType: voice.isVoice ? "voice" : message.media_type,
      duration: voice.duration ?? message.duration ?? null,
      replyTo: message.replyTo || message.reply_to || null,
      editedAt: message.edited_at || message.editedAt || null,
      pinnedAt: message.pinned_at || message.pinnedAt || null,
      pinnedBy: message.pinned_by || message.pinnedBy || null,
      reactions: Array.isArray(message.reactions) ? message.reactions : [],
      embed: hasEmbed ? message.embed : null,
      appType: typeof message.type === "string" ? message.type : null,
      isAppMessage: isAppBot && !isSystem,
      type: isSystem ? "system" : message.type || null,
      isSystemMessage: isSystem,
      systemKind: message.system_kind || message.systemKind || null,
      systemMeta: message.system_meta || message.systemMeta || null,
    };
    setChannelMessagesById((prev) => {
      const cur = prev[channelId] ?? [];
      if (tempId) {
        const withoutTemp = cur.filter((m) => m.id !== tempId && m.id !== normalized.id);
        return {
          ...prev,
          [channelId]: sortMessagesChronologically([...withoutTemp, normalized]),
        };
      }
      if (cur.some((m) => m.id === normalized.id)) return prev;
      return { ...prev, [channelId]: sortMessagesChronologically([...cur, normalized]) };
    });
    // System messages are quiet — visible in history, no unread/sound spam.
    if (isSystem) return;
    const isFromMe = normalized.from?.id === myIdRef.current;
    const isActive = activeChannelRef.current?.id === channelId;
    const notifLevel = getServerNotificationLevel(serverId || message.server_id);
    // all → unread+sound; mentions → mention handler only; muted → silence
    if (
      !isFromMe &&
      !isActive &&
      !isChannelMuted(channelId) &&
      notifLevel === "all"
    ) {
      bumpChannelUnreadRef.current?.(channelId, normalized.id);
      playUiSound("message");
    }
  };

  const handleChannelMessageDeleted = ({ channelId, messageId } = {}) => {
    if (!channelId || !messageId) return;
    setChannelMessagesById((prev) => {
      const cur = prev[channelId];
      if (!cur?.length) return prev;
      const next = cur.filter((m) => m.id !== messageId);
      if (next.length === cur.length) return prev;
      return { ...prev, [channelId]: next };
    });
  };

  const handleChannelMessageError = ({ channelId, tempId, message, code, retryAfterSeconds } = {}) => {
    if (channelId && tempId) {
      setChannelMessagesById((prev) => {
        const cur = prev[channelId] ?? [];
        if (!cur.some((m) => m.id === tempId)) return prev;
        return {
          ...prev,
          [channelId]: cur.map((m) =>
            m.id === tempId ? { ...m, sending: false, failed: true } : m
          ),
        };
      });
    }
    if (code === "SLOWMODE") {
      const wait = Math.max(1, Math.ceil(Number(retryAfterSeconds) || 1));
      toast(`Slowmode is on. Try again in ${wait}s.`, "warning");
      window.dispatchEvent(
        new CustomEvent("descall:slowmode", {
          detail: { channelId, retryAfterSeconds: wait },
        })
      );
    } else if (code === "RULES_REQUIRED") {
      toast(message || "You must accept the server rules before continuing.", "warning");
      window.dispatchEvent(new CustomEvent("descall:server-rules-required"));
    } else if (message) {
      toast(message, "error");
    }
  };

  const handleChannelMessageEdited = ({ channelId, messageId, newText, editedAt } = {}) => {
    if (!channelId || !messageId) return;
    setChannelMessagesById((prev) => {
      const cur = prev[channelId];
      if (!cur?.length) return prev;
      let changed = false;
      const next = cur.map((m) => {
        if (m.id !== messageId) return m;
        changed = true;
        return { ...m, text: newText, editedAt: editedAt || new Date().toISOString() };
      });
      return changed ? { ...prev, [channelId]: next } : prev;
    });
  };

  const handleChannelMessagePinned = ({ channelId, messageId, pinnedAt, pinnedBy } = {}) => {
    if (!channelId || !messageId) return;
    const patchList = patchPinState(messageId, pinnedAt, pinnedBy);
    setChannelMessagesById((prev) => {
      const cur = prev[channelId];
      if (!cur) return prev;
      const next = patchList(cur);
      return next === cur ? prev : { ...prev, [channelId]: next };
    });
  };

  const handleChannelMessageUnpinned = ({ channelId, messageId } = {}) => {
    if (!channelId || !messageId) return;
    const patchList = patchPinState(messageId, null, null);
    setChannelMessagesById((prev) => {
      const cur = prev[channelId];
      if (!cur) return prev;
      const next = patchList(cur);
      return next === cur ? prev : { ...prev, [channelId]: next };
    });
  };

  const handleAnnouncement = ({ text } = {}) => {
    setFriendNotice(`Server: ${text || ""}`);
    setTimeout(() => setFriendNotice(""), 8000);
  };

  const handleMemberRemoved = ({ serverId, userId, action, reason, serverName } = {}) => {
    if (!serverId || !userId) return;
    const meId = myIdRef.current || getUser()?.id;
    const isMe = meId && String(userId) === String(meId);

    if (isMe) {
      setMyServers((prev) => prev.filter((s) => String(s.id) !== String(serverId)));
      setActiveServer((prev) => {
        if (prev && String(prev.id) === String(serverId)) {
          setActiveChannel(null);
          return null;
        }
        return prev;
      });
      const voice = serverVoiceRef.current;
      if (voice?.activeServerId && String(voice.activeServerId) === String(serverId)) {
        voice.leave?.();
      }
      try {
        if (typeof window !== "undefined" && window.location?.pathname?.startsWith("/servers")) {
          navigate("/servers");
        }
      } catch {
        /* ignore */
      }
      const name = serverName || t("the server");
      const base =
        action === "ban"
          ? t("You were banned from {name}", { name })
          : t("You were kicked from {name}", { name });
      toast(reason ? `${base} — ${reason}` : base, "error");
      return;
    }

    // Other members: drop from active server memberCount if viewing it
    setActiveServer((prev) => {
      if (!prev || String(prev.id) !== String(serverId)) return prev;
      const nextCount = Math.max(1, (prev.memberCount || 1) - 1);
      return { ...prev, memberCount: nextCount };
    });
    setMyServers((prev) =>
      prev.map((s) =>
        String(s.id) === String(serverId)
          ? { ...s, memberCount: Math.max(1, (s.memberCount || 1) - 1) }
          : s
      )
    );
    // Notify open members panel via custom event
    try {
      window.dispatchEvent(
        new CustomEvent("descall:server-member-removed", {
          detail: { serverId, userId, action },
        })
      );
    } catch {
      /* ignore */
    }
  };

  const handleChannelCreated = ({ serverId, channel } = {}) => {
    if (!serverId || !channel?.id) return;
    // Only arrives for members with VIEW_CHANNEL (server filters recipients).
    upsertServerChannel(serverId, channel);
    if (
      channel.type === "text" &&
      activeViewRef.current === "servers" &&
      activeServerRef.current &&
      String(activeServerRef.current.id) === String(serverId)
    ) {
      socket.emit("server:channel:join", channel.id);
    }
  };

  const handleChannelUpdated = ({ serverId, channel } = {}) => {
    if (!serverId || !channel?.id) return;
    upsertServerChannel(serverId, channel);
  };

  const handleChannelDeleted = ({ serverId, channelId } = {}) => {
    if (!serverId || !channelId) return;
    const drop = (channels = []) =>
      channels.filter((c) => String(c.id) !== String(channelId));
    setMyServers((prev) =>
      prev.map((s) =>
        String(s.id) === String(serverId) ? { ...s, channels: drop(s.channels || []) } : s
      )
    );
    setActiveServer((prev) => {
      if (!prev || String(prev.id) !== String(serverId)) return prev;
      return { ...prev, channels: drop(prev.channels || []) };
    });
    setActiveChannel((prev) =>
      prev && String(prev.id) === String(channelId) ? null : prev
    );
    setChannelMessagesById((prev) => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
    socket.emit("server:channel:leave", channelId);
  };

  const handleChannelsResync = ({ serverId } = {}) => {
    if (!serverId) return;
    refreshServerBundle(serverId);
  };

  const handleRoleCreated = ({ serverId, role } = {}) => {
    upsertServerRole(serverId, role);
  };

  const handleRoleUpdated = ({ serverId, role } = {}) => {
    upsertServerRole(serverId, role);
    // Permission bits may have changed for everyone holding this role.
    if (
      activeServerRef.current &&
      String(activeServerRef.current.id) === String(serverId)
    ) {
      refreshServerBundle(serverId);
    }
  };

  const handleRoleDeleted = ({ serverId, roleId } = {}) => {
    if (!serverId || !roleId) return;
    const drop = (roles = []) => roles.filter((r) => String(r.id) !== String(roleId));
    setMyServers((prev) =>
      prev.map((s) =>
        String(s.id) === String(serverId) ? { ...s, roles: drop(s.roles || []) } : s
      )
    );
    setActiveServer((prev) => {
      if (!prev || String(prev.id) !== String(serverId)) return prev;
      return { ...prev, roles: drop(prev.roles || []) };
    });
    try {
      window.dispatchEvent(
        new CustomEvent("descall:server-role-deleted", {
          detail: { serverId, roleId },
        })
      );
    } catch {
      /* ignore */
    }
  };

  const handleMemberJoined = ({ serverId, member, memberCount } = {}) => {
    if (!serverId) return;
    if (typeof memberCount === "number") {
      setActiveServer((prev) =>
        prev && String(prev.id) === String(serverId)
          ? { ...prev, memberCount }
          : prev
      );
      setMyServers((prev) =>
        prev.map((s) =>
          String(s.id) === String(serverId) ? { ...s, memberCount } : s
        )
      );
    }
    try {
      window.dispatchEvent(
        new CustomEvent("descall:server-member-joined", {
          detail: { serverId, member, memberCount },
        })
      );
    } catch {
      /* ignore */
    }
  };

  const handleMemberUpdated = ({ serverId, member } = {}) => {
    if (!serverId || !member?.userId) return;
    try {
      window.dispatchEvent(
        new CustomEvent("descall:server-member-updated", {
          detail: { serverId, member },
        })
      );
    } catch {
      /* ignore */
    }
  };

  const handleMemberRolesChanged = ({ serverId, userId, roleId, action } = {}) => {
    if (!serverId || !userId) return;
    try {
      window.dispatchEvent(
        new CustomEvent("descall:server-member-roles-changed", {
          detail: { serverId, userId, roleId, action },
        })
      );
    } catch {
      /* ignore */
    }
    const meId = myIdRef.current || getUser()?.id;
    if (meId && String(userId) === String(meId)) {
      refreshServerBundle(serverId);
    }
  };

  const handlers = {
    "server:channel:message:ack": handleChannelMessageAck,
    "server:channel:message": handleChannelMessage,
    "server:channel:message:deleted": handleChannelMessageDeleted,
    "server:channel:message:error": handleChannelMessageError,
    "server:channel:message:edited": handleChannelMessageEdited,
    "server:channel:message:pinned": handleChannelMessagePinned,
    "server:channel:message:unpinned": handleChannelMessageUnpinned,
    "server:announcement": handleAnnouncement,
    "server:member:removed": handleMemberRemoved,
    "server:channel:created": handleChannelCreated,
    "server:channel:updated": handleChannelUpdated,
    "server:channel:deleted": handleChannelDeleted,
    "server:channels:resync": handleChannelsResync,
    "server:role:created": handleRoleCreated,
    "server:role:updated": handleRoleUpdated,
    "server:role:deleted": handleRoleDeleted,
    "server:member:joined": handleMemberJoined,
    "server:member:updated": handleMemberUpdated,
    "server:member:roles-changed": handleMemberRolesChanged,
  };

  for (const event of SERVER_EVENTS) {
    socket.on(event, handlers[event]);
  }

  return () => {
    for (const event of SERVER_EVENTS) {
      socket.off(event, handlers[event]);
    }
  };
}
