import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { FileText, Download, Smile, Reply, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import CallSummaryBubble from "./CallSummaryBubble";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import ActiveCallBanner from "../ActiveCallBanner";
import UserProfileModal from "../social/UserProfileModal";
import GameMessageBubble from "./GameMessageBubble";
import MessageReactions from "./MessageReactions";
import MessageContent from "./MessageContent";
import { MessageSkeleton } from "../ui/Skeleton";
import { getPresenceStatus } from "../../lib/presence";
import UserHoverCard from "../social/UserHoverCard";
import { mergeUserProfiles, pickAvatarUrl, resolveDisplayName } from "../../lib/userProfile";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];
const PICKER_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏", "🤔", "👎"];

function dmConversationId(a, b) {
  if (!a || !b) return null;
  return [a, b].sort().join("::");
}

/** Fill / preserve avatar fields from friends / presence / me so letters don't stick. */
function enrichAvatarUser(user, { me, friends, onlineUsers, currentUser } = {}) {
  if (!user) return user;
  const id = user.id;
  const fromMe =
    id && (me?.id === id || currentUser?.id === id)
      ? me || currentUser
      : null;
  const fromFriend = id && Array.isArray(friends) ? friends.find((f) => f.id === id) : null;
  const fromOnline = id && Array.isArray(onlineUsers) ? onlineUsers.find((u) => u.id === id) : null;
  return mergeUserProfiles(user, fromOnline, fromFriend, fromMe) || user;
}

function hoverAnchorFromRect(rect) {
  if (!rect) return null;
  return {
    x: rect.right + 8,
    y: Math.max(8, rect.top - 8),
    // If the card would overflow right, flip to the left of the avatar.
    flipX: rect.left - 8,
  };
}

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
  activeDmUser = null,
  loading = false,
  unreadCount = 0,
  onReply,
}) {
  const messagesEndRef = useRef(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [hoverUser, setHoverUser] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);

  const conversationType = activeGroup ? "group" : "dm";
  const conversationId = activeGroup?.id
    || dmConversationId(currentUser?.id || me?.id, activeDmUser?.id);

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
        const avatarUser = enrichAvatarUser(group.user, { me, friends, onlineUsers, currentUser });
        const openProfile = () => {
          if (avatarUser?.id) setProfileTarget(avatarUser);
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
                  style={{ cursor: avatarUser?.id ? "pointer" : "default" }}
                  onMouseEnter={(e) => {
                    if (!avatarUser?.id) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const friend = (friends || []).find((f) => f.id === avatarUser.id);
                    const online = (onlineUsers || []).find((u) => u.id === avatarUser.id);
                    setHoverUser(
                      mergeUserProfiles(avatarUser, friend, online, {
                        status: online?.status || friend?.status || "offline",
                      })
                    );
                    setHoverPos(hoverAnchorFromRect(rect));
                  }}
                  onMouseLeave={() => {
                    setHoverUser(null);
                    setHoverPos(null);
                  }}
                >
                  <Avatar
                    name={resolveDisplayName(avatarUser)}
                    size={40}
                    user={avatarUser}
                    imageUrl={pickAvatarUrl(avatarUser)}
                    animate="hover"
                  />
                  <StatusBadge status={getPresenceStatus(onlineUsers, avatarUser?.id)} />
                </div>
                <div className="message-meta">
                  <span
                    className="message-author"
                    onClick={openProfile}
                    style={{ cursor: avatarUser?.id ? "pointer" : "default" }}
                    onMouseEnter={(e) => { if (avatarUser?.id) e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = ""; }}
                  >
                    {resolveDisplayName(avatarUser)}
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
                  currentUserId={currentUser?.id || me?.id}
                  socket={socket}
                  conversationType={conversationType}
                  conversationId={conversationId}
                  onReply={onReply}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />

      {hoverUser && hoverPos && (
        <UserHoverCard user={hoverUser} anchor={hoverPos} />
      )}

      <UserProfileModal
        open={!!profileTarget}
        onClose={() => setProfileTarget(null)}
        userId={profileTarget?.id}
        username={profileTarget?.username}
        avatarUrl={pickAvatarUrl(profileTarget)}
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
  onReply,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const hideTimer = useRef(null);
  const x = useMotionValue(0);
  const replyHintOpacity = useTransform(
    x,
    isOwn ? [-56, -20, 0] : [0, 20, 56],
    isOwn ? [1, 0.4, 0] : [0, 0.4, 1]
  );
  const reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const reply = message.replyTo || message.reply_to || null;

  const resetSwipe = useCallback(() => {
    setSwiping(false);
    x.stop();
    x.set(0);
  }, [x]);

  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const openMenu = () => {
    clearHide();
    setMenuOpen(true);
  };

  const scheduleClose = () => {
    clearHide();
    hideTimer.current = setTimeout(() => {
      setMenuOpen(false);
      setPickerOpen(false);
    }, 180);
  };

  useEffect(() => () => clearHide(), []);

  const triggerReply = useCallback(() => {
    onReply?.({
      id: message.id,
      text: message.text || "",
      mediaType: message.mediaType,
      from: message.from || {
        id: message.sender_id || message.from?.id,
        username: message.from?.username || message.username,
      },
    });
    setMenuOpen(false);
    setPickerOpen(false);
    resetSwipe();
  }, [message, onReply, resetSwipe]);

  const emitReact = useCallback((emoji) => {
    if (!message?.id || !conversationType || !conversationId || !emoji) return;
    if (String(message.id).startsWith("temp-")) return;

    const mine = reactions.some((r) => r.emoji === emoji && r.userId === currentUserId);
    if (mine) {
      socket?.emit("reaction:remove", {
        messageId: message.id,
        conversationType,
        conversationId,
        emoji,
      });
    } else {
      socket?.emit("reaction:add", {
        messageId: message.id,
        conversationType,
        conversationId,
        emoji,
      });
    }
    setPickerOpen(false);
  }, [message?.id, conversationType, conversationId, reactions, currentUserId, socket]);

  return (
    <div className={`message-swipe-wrap ${isOwn ? "own" : ""}${swiping ? " is-swiping" : ""}`}>
      {swiping && (
        <motion.div
          className="message-swipe-hint"
          style={{ opacity: replyHintOpacity }}
          aria-hidden="true"
        >
          <Reply size={16} />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragSnapToOrigin
        dragConstraints={isOwn ? { left: -72, right: 0 } : { left: 0, right: 72 }}
        dragElastic={0.18}
        onDragStart={() => setSwiping(true)}
        onDragEnd={(_, info) => {
          const dx = info.offset.x;
          const shouldReply = (isOwn && dx <= -48) || (!isOwn && dx >= 48);
          // Always snap hint away — cancel / incomplete swipe must not leave the icon stuck
          resetSwipe();
          if (shouldReply) triggerReply();
        }}
        className={`message-bubble ${isOwn ? "own" : ""} ${isCompact ? "compact" : ""} ${menuOpen ? "menu-open" : ""}`}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onClick={(e) => {
          // Touch / click toggle for devices without hover
          if (e.target.closest("a, button, video, .message-hover-bar, .message-reactions")) return;
          if (window.matchMedia("(hover: none)").matches) {
            setMenuOpen((v) => !v);
            setPickerOpen(false);
          }
        }}
      >
        {reply && (
          <button
            type="button"
            className="message-reply-quote"
            onClick={(e) => {
              e.stopPropagation();
              onReply?.(reply.id ? { ...reply, id: reply.id } : reply);
            }}
            title="Replying to"
          >
            <span className="message-reply-author">
              {reply.from?.username || reply.username || "Message"}
            </span>
            <span className="message-reply-text">
              {reply.text
                ? String(reply.text).slice(0, 120)
                : reply.mediaType
                ? `📎 ${reply.mediaType}`
                : "Original message"}
            </span>
          </button>
        )}

        {message.text && <MessageContent text={message.text} />}

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
                className="message-file-chip"
              >
                <div className="message-file-ico">
                  <FileText size={18} />
                </div>
                <div className="message-file-meta">
                  <div className="message-file-name">{message.originalName || "File"}</div>
                  {message.size && (
                    <div className="message-file-size">
                      {message.size < 1024 * 1024
                        ? `${Math.round(message.size / 1024)} KB`
                        : `${(message.size / (1024 * 1024)).toFixed(1)} MB`}
                    </div>
                  )}
                </div>
                <Download size={16} />
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
          {menuOpen && (
            <motion.div
              className={`message-hover-bar ${isOwn ? "own" : "other"}`}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              transition={{ duration: 0.14 }}
              onMouseEnter={openMenu}
              onMouseLeave={scheduleClose}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="msg-quick-react">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="emoji-chip"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      emitReact(e);
                    }}
                    title={`React ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`hover-bar-btn ${pickerOpen ? "active" : ""}`}
                title="More reactions"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setPickerOpen((v) => !v);
                }}
              >
                <Smile size={14} />
              </button>
              <button
                type="button"
                className="hover-bar-btn"
                title="Reply"
                onClick={(ev) => {
                  ev.stopPropagation();
                  triggerReply();
                }}
              >
                <Reply size={14} />
              </button>

              <AnimatePresence>
                {pickerOpen && (
                  <motion.div
                    className="message-inline-picker"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="message-inline-picker-head">
                      <span>React</span>
                      <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="message-inline-picker-grid">
                      {PICKER_EMOJIS.map((e) => (
                        <button key={e} type="button" onClick={() => emitReact(e)}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
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
