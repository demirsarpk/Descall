import { useRef, useEffect, useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Download, Smile, Reply } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import CallSummaryBubble from "./CallSummaryBubble";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import ActiveCallBanner from "../ActiveCallBanner";
import UserProfileModal from "../social/UserProfileModal";
import GameMessageBubble from "./GameMessageBubble";
import MessageReactions from "./MessageReactions";
import { MessageSkeleton } from "../ui/Skeleton";
import { getPresenceStatus } from "../../lib/presence";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

function dayKeyOf(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  } catch {
    return "";
  }
}

function formatDayLabel(iso) {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const that = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - that) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/**
 * Discord-style message list with day / unread separators.
 */
export default function MessageList({
  messages,
  currentUser,
  onJoinActiveCall,
  onDismissActiveBanner,
  me,
  friends,
  onlineUsers,
  onStartDm,
  socket,
  activeGroup,
  loading = false,
  unreadCount = 0,
}) {
  const messagesEndRef = useRef(null);
  const [profileTarget, setProfileTarget] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [messages, loading]);

  const groupedMessages = useMemo(() => {
    const msgs = Array.isArray(messages) ? messages : [];
    if (!msgs.length) return [];

    const grouped = [];
    let currentGroup = null;
    const unreadStartIndex =
      unreadCount > 0 ? Math.max(0, msgs.length - unreadCount) : -1;

    const flush = () => {
      if (currentGroup) {
        grouped.push(currentGroup);
        currentGroup = null;
      }
    };

    msgs.forEach((msg, index) => {
      const dayKey = dayKeyOf(msg?.timestamp);
      const prevDay = index > 0 ? dayKeyOf(msgs[index - 1]?.timestamp) : null;
      if (dayKey && dayKey !== prevDay) {
        flush();
        grouped.push({
          isDaySep: true,
          label: formatDayLabel(msg.timestamp),
          id: `day-${dayKey}-${index}`,
        });
      }

      if (index === unreadStartIndex) {
        flush();
        grouped.push({ isUnreadSep: true, id: `unread-${index}` });
      }

      // Call summary and active call bubbles break grouping — render standalone
      // Also recover legacy rows that were stored/rendered as raw JSON text.
      let summaryMsg = msg;
      if (msg?.type !== "call_summary" && typeof msg?.text === "string" && msg.text.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(msg.text);
          if (parsed && (parsed.type === "call_summary" || parsed.callType || parsed.durationSeconds !== undefined)) {
            summaryMsg = {
              ...parsed,
              id: parsed.id || msg.id,
              timestamp: msg.timestamp || parsed.endedAt,
              type: "call_summary",
            };
          }
        } catch {
          /* ignore */
        }
      }

      if (summaryMsg.type === "call_summary") {
        flush();
        grouped.push({ isSummary: true, summary: summaryMsg, id: summaryMsg.id });
        return;
      }
      if (msg.type === "active_call") {
        flush();
        grouped.push({ isActiveBanner: true, banner: msg, id: msg.id });
        return;
      }
      // Game messages render standalone (no grouping)
      if (msg.isGameMessage || msg.type?.startsWith("game_")) {
        flush();
        grouped.push({ isGame: true, gameMsg: msg, id: msg.id });
        return;
      }

      const prevMsg = msgs[index - 1];
      const crossedDay = Boolean(dayKey && prevDay && dayKey !== prevDay);
      const crossedUnread = index === unreadStartIndex;
      const isSameSender = prevMsg?.from?.id === msg.from?.id && prevMsg?.type !== "call_summary";
      const timeDiff = prevMsg ? new Date(msg.timestamp) - new Date(prevMsg.timestamp) : Infinity;
      const isCompact =
        isSameSender && timeDiff < 5 * 60 * 1000 && !crossedDay && !crossedUnread;

      if (isCompact && currentGroup) {
        currentGroup.messages.push(msg);
      } else {
        flush();
        currentGroup = { user: msg.from, messages: [msg], isCompact: false };
      }
    });

    flush();
    return grouped;
  }, [messages, unreadCount]);

  if (loading) {
    return (
      <div className="message-list">
        <MessageSkeleton count={7} />
      </div>
    );
  }

  return (
    <div className="message-list">
      {groupedMessages.map((group, groupIndex) => {
        if (group.isDaySep) {
          return (
            <div key={group.id || `day-${groupIndex}`} className="message-day-sep">
              <span>{group.label}</span>
            </div>
          );
        }
        if (group.isUnreadSep) {
          return (
            <div key={group.id || `unread-${groupIndex}`} className="message-unread-sep">
              <span>New messages</span>
            </div>
          );
        }
        if (group.isSummary) {
          return <CallSummaryBubble key={group.id || `summary-${groupIndex}`} summary={group.summary} />;
        }
        if (group.isActiveBanner) {
          return (
            <ActiveCallBanner
              key={group.id || `active-call-${groupIndex}`}
              banner={group.banner}
              onJoin={onJoinActiveCall}
              onDismiss={onDismissActiveBanner}
            />
          );
        }
        if (group.isGame) {
          return (
            <GameMessageBubble
              key={group.id || `game-${groupIndex}`}
              message={group.gameMsg}
              isOwn={group.gameMsg.from?.id === currentUser?.id}
              currentUserId={currentUser?.id}
              socket={socket}
              onGameAction={() => {}}
            />
          );
        }

        const isOwn = group.user?.id === currentUser?.id;
        const openProfile = () => {
          if (group.user?.id) setProfileTarget(group.user);
        };

        return (
          <div
            key={`group-${groupIndex}`}
            className={`message-group ${isOwn ? "own" : ""}`}
          >
            {!group.isCompact && (
              <div className="message-header">
                <div
                  className="message-avatar"
                  onClick={openProfile}
                  style={{ cursor: group.user?.id ? "pointer" : "default" }}
                >
                  <Avatar
                    name={group.user?.username || "Unknown"}
                    size={40}
                    user={group.user}
                  />
                  <StatusBadge status={getPresenceStatus(onlineUsers, group.user?.id)} />
                </div>
                <div className="message-meta">
                  <span
                    className="message-author"
                    onClick={openProfile}
                    style={{ cursor: group.user?.id ? "pointer" : "default" }}
                    onMouseEnter={(e) => { if (group.user?.id) e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = ""; }}
                  >
                    {group.user?.username || "Unknown"}
                  </span>
                  <span className="message-timestamp">
                    {formatTimestamp(group.messages[0]?.timestamp)}
                  </span>
                </div>
              </div>
            )}

            <div className="message-content-wrapper">
              {group.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={isOwn}
                  isCompact={group.isCompact}
                  currentUserId={currentUser?.id}
                  socket={socket}
                  conversationType={activeGroup ? "group" : "dm"}
                  conversationId={activeGroup?.id || group.user?.id}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />

      <UserProfileModal
        open={!!profileTarget}
        onClose={() => setProfileTarget(null)}
        userId={profileTarget?.id}
        username={profileTarget?.username}
        avatarUrl={profileTarget?.avatarUrl}
        me={me}
        friends={friends}
        onlineUsers={onlineUsers}
        onStartDm={onStartDm}
      />
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  isCompact,
  currentUserId,
  socket,
  conversationType,
  conversationId,
}) {
  const [hover, setHover] = useState(false);
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];

  const emitReact = (emoji) => {
    if (!socket || !message.id) return;
    socket.emit("reaction:add", {
      messageId: message.id,
      conversationType,
      conversationId,
      emoji,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`message-bubble ${isOwn ? "own" : ""} ${isCompact ? "compact" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {message.text && (
        <div className="message-text">
          {message.text}
        </div>
      )}

      {message.mediaUrl && (
        <div className="message-media">
          {message.mediaType === "gif" ? (
            <img
              src={message.mediaUrl}
              alt="GIF"
              className="message-image"
              style={{ maxWidth: 320, maxHeight: 240, borderRadius: 8, display: "block" }}
            />
          ) : message.mediaType === "image" ? (
            <img
              src={message.mediaUrl}
              alt={message.originalName || "Image"}
              className="message-image"
              style={{ maxWidth: 400, maxHeight: 300, borderRadius: 8, display: "block", cursor: "pointer" }}
              onClick={() => window.open(message.mediaUrl, "_blank")}
            />
          ) : message.mediaType === "video" ? (
            <video
              src={message.mediaUrl}
              controls
              className="message-video"
              style={{ maxWidth: 400, borderRadius: 8, display: "block" }}
            />
          ) : message.mediaType === "audio" || message.mediaType === "voice" ? (
            <VoiceMessagePlayer
              audioUrl={message.mediaUrl}
              duration={message.duration || message.durationSeconds || 0}
              isOwn={isOwn}
            />
          ) : (message.mediaType === "document" || message.mediaType === "file") ? (
            <a
              href={message.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={message.originalName || true}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderRadius: 10,
                background: "var(--surface-3)", border: "1px solid var(--border-2)",
                textDecoration: "none", maxWidth: 320, cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-active)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface-3)"}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={18} style={{ color: "var(--primary)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {message.originalName || "File"}
                </div>
                {message.size && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    {message.size < 1024 * 1024
                      ? `${Math.round(message.size / 1024)} KB`
                      : `${(message.size / (1024 * 1024)).toFixed(1)} MB`}
                  </div>
                )}
              </div>
              <Download size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </a>
          ) : null}
        </div>
      )}

      {reactions.length > 0 && (
        <MessageReactions
          messageId={message.id}
          conversationType={conversationType}
          conversationId={conversationId}
          reactions={reactions}
          currentUserId={currentUserId}
          socket={socket}
        />
      )}

      {!isCompact && isOwn && (
        <div className="message-footer">
          <span
            className="message-status"
            title={message.sending ? "Sending…" : message.deliveredAt ? "Delivered" : "Sent"}
            style={{ opacity: message.sending ? 0.4 : 1 }}
          >
            {message.deliveredAt ? "✓✓" : "✓"}
          </span>
        </div>
      )}

      <AnimatePresence>
        {hover && (
          <motion.div
            className="message-hover-bar"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            <div className="msg-quick-react">
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="emoji-chip"
                  onClick={() => emitReact(e)}
                  title={`React ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
            <button type="button" className="hover-bar-btn" title="Add reaction" onClick={() => emitReact("👍")}>
              <Smile size={14} />
            </button>
            <button type="button" className="hover-bar-btn" title="Reply" disabled>
              <Reply size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  } catch {
    return "";
  }
}
