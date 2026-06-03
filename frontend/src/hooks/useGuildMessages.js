import { useCallback, useEffect, useRef, useState } from "react";
import {
  getGuildMessages,
  sendGuildMessage as apiSendMessage,
  editGuildMessage as apiEditMessage,
  deleteGuildMessage as apiDeleteMessage,
  addGuildReaction as apiAddReaction,
  removeGuildReaction as apiRemoveReaction,
} from "../api/guilds";

export function useGuildMessages(socket, guildId, channelId, myId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const messagesRef = useRef([]);
  const typingTimeoutRef = useRef({});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load initial messages when channel changes
  useEffect(() => {
    if (!guildId || !channelId) {
      setMessages([]);
      setHasMore(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setHasMore(true);

    getGuildMessages(guildId, channelId, { limit: 50 })
      .then(({ messages: fetched }) => {
        if (cancelled) return;
        setMessages(fetched || []);
        setHasMore((fetched || []).length >= 50);
      })
      .catch((err) => {
        console.error("[useGuildMessages] load error:", err);
      })
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [guildId, channelId]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !guildId || !channelId) return;

    const onNewMessage = ({ guildId: gId, channelId: cId, message }) => {
      if (gId !== guildId || cId !== channelId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    const onEditMessage = ({ guildId: gId, channelId: cId, message }) => {
      if (gId !== guildId || cId !== channelId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, ...message } : m))
      );
    };

    const onDeleteMessage = ({ guildId: gId, channelId: cId, messageId }) => {
      if (gId !== guildId || cId !== channelId) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const onReactionAdded = ({ guildId: gId, channelId: cId, messageId, reaction }) => {
      if (gId !== guildId || cId !== channelId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existing = m.reactions?.find((r) => r.emoji === reaction.emoji);
          if (existing) {
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === reaction.emoji
                  ? { ...r, count: r.count + 1, users: [...r.users, reaction.user_id] }
                  : r
              ),
            };
          }
          return {
            ...m,
            reactions: [...(m.reactions || []), { emoji: reaction.emoji, count: 1, users: [reaction.user_id] }],
          };
        })
      );
    };

    const onReactionRemoved = ({ guildId: gId, channelId: cId, messageId, userId, emoji }) => {
      if (gId !== guildId || cId !== channelId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: (m.reactions || [])
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: Math.max(0, r.count - 1), users: r.users.filter((u) => u !== userId) }
                  : r
              )
              .filter((r) => r.count > 0),
          };
        })
      );
    };

    const onTyping = ({ guildId: gId, channelId: cId, user }) => {
      if (gId !== guildId || cId !== channelId) return;
      if (user.id === myId) return;
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.id !== user.id);
        return [...filtered, user];
      });

      // Clear typing after 3 seconds
      if (typingTimeoutRef.current[user.id]) {
        clearTimeout(typingTimeoutRef.current[user.id]);
      }
      typingTimeoutRef.current[user.id] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u.id !== user.id));
      }, 3000);
    };

    socket.on("guild:message:new", onNewMessage);
    socket.on("guild:message:edited", onEditMessage);
    socket.on("guild:message:deleted", onDeleteMessage);
    socket.on("guild:reaction:added", onReactionAdded);
    socket.on("guild:reaction:removed", onReactionRemoved);
    socket.on("guild:typing", onTyping);

    return () => {
      socket.off("guild:message:new", onNewMessage);
      socket.off("guild:message:edited", onEditMessage);
      socket.off("guild:message:deleted", onDeleteMessage);
      socket.off("guild:reaction:added", onReactionAdded);
      socket.off("guild:reaction:removed", onReactionRemoved);
      socket.off("guild:typing", onTyping);
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
    };
  }, [socket, guildId, channelId, myId]);

  const loadMore = useCallback(async () => {
    if (!guildId || !channelId || loading || !hasMore || messagesRef.current.length === 0) return;
    const oldest = messagesRef.current[0];
    setLoading(true);
    try {
      const { messages: fetched } = await getGuildMessages(guildId, channelId, {
        before: oldest.created_at,
        limit: 50,
      });
      if ((fetched || []).length === 0) {
        setHasMore(false);
      } else {
        setMessages((prev) => [...fetched, ...prev]);
        setHasMore(fetched.length >= 50);
      }
    } catch (err) {
      console.error("[useGuildMessages] loadMore error:", err);
    } finally {
      setLoading(false);
    }
  }, [guildId, channelId, loading, hasMore]);

  const sendMessage = useCallback(
    async ({ content, mediaUrl, mediaType, replyTo }) => {
      if (!socket || !guildId || !channelId) return;
      socket.emit("guild:message", { guildId, channelId, content, mediaUrl, mediaType, replyTo });
    },
    [socket, guildId, channelId]
  );

  const editMessage = useCallback(
    async (messageId, content) => {
      if (!socket || !guildId || !channelId) return;
      socket.emit("guild:message:edit", { guildId, channelId, messageId, content });
    },
    [socket, guildId, channelId]
  );

  const deleteMessage = useCallback(
    async (messageId) => {
      if (!socket || !guildId || !channelId) return;
      socket.emit("guild:message:delete", { guildId, channelId, messageId });
    },
    [socket, guildId, channelId]
  );

  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      if (!socket || !guildId || !channelId) return;
      const msg = messagesRef.current.find((m) => m.id === messageId);
      const existing = msg?.reactions?.find((r) => r.emoji === emoji);
      const userReacted = existing?.users?.includes(myId);
      if (userReacted) {
        socket.emit("guild:message:reaction:remove", { guildId, channelId, messageId, emoji });
      } else {
        socket.emit("guild:message:reaction", { guildId, channelId, messageId, emoji });
      }
    },
    [socket, guildId, channelId, myId]
  );

  const sendTyping = useCallback(() => {
    if (!socket || !guildId || !channelId) return;
    socket.emit("guild:typing", { guildId, channelId });
  }, [socket, guildId, channelId]);

  return {
    messages,
    loading,
    hasMore,
    typingUsers,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    sendTyping,
  };
}
