import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import CallSummaryBubble from "./CallSummaryBubble";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import ActiveCallBanner from "../ActiveCallBanner";
import UserProfileModal from "../social/UserProfileModal";

/**
 * COMPLETELY REBUILT MESSAGE LIST
 * Discord-style message display
 * No old layout remnants
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
}) {
  const messagesEndRef = useRef(null);
  const [profileTarget, setProfileTarget] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const groupMessages = (msgs) => {
    if (!msgs || !Array.isArray(msgs)) return [];

    const grouped = [];
    let currentGroup = null;

    msgs.forEach((msg, index) => {
      // Call summary and active call bubbles break grouping — render standalone
      if (msg.type === "call_summary") {
        if (currentGroup) { grouped.push(currentGroup); currentGroup = null; }
        grouped.push({ isSummary: true, summary: msg, id: msg.id });
        return;
      }
      if (msg.type === "active_call") {
        if (currentGroup) { grouped.push(currentGroup); currentGroup = null; }
        grouped.push({ isActiveBanner: true, banner: msg, id: msg.id });
        return;
      }

      const prevMsg = msgs[index - 1];
      const isSameSender = prevMsg?.from?.id === msg.from?.id && prevMsg?.type !== "call_summary";
      const timeDiff = prevMsg ? new Date(msg.timestamp) - new Date(prevMsg.timestamp) : Infinity;
      const isCompact = isSameSender && timeDiff < 5 * 60 * 1000;

      if (isCompact && currentGroup) {
        currentGroup.messages.push(msg);
      } else {
        if (currentGroup) grouped.push(currentGroup);
        currentGroup = { user: msg.from, messages: [msg], isCompact: false };
      }
    });

    if (currentGroup) grouped.push(currentGroup);
    return grouped;
  };

  const groupedMessages = groupMessages(messages);

  return (
    <div className="message-list">
      {groupedMessages.map((group, groupIndex) => {
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
                    imageUrl={group.user?.avatarUrl}
                  />
                  <StatusBadge status={onlineUsers?.some(u => u.id === group.user?.id) ? "online" : "offline"} />
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

function MessageBubble({ message, isOwn, isCompact }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`message-bubble ${isOwn ? "own" : ""} ${isCompact ? "compact" : ""}`}
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
