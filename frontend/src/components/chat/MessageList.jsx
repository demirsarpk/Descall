import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import CallSummaryBubble from "./CallSummaryBubble";

/**
 * COMPLETELY REBUILT MESSAGE LIST
 * Discord-style message display
 * No old layout remnants
 */
export default function MessageList({ messages, currentUser }) {
  const messagesEndRef = useRef(null);

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
      // Call summary bubbles break grouping — render standalone
      if (msg.type === "call_summary") {
        if (currentGroup) { grouped.push(currentGroup); currentGroup = null; }
        grouped.push({ isSummary: true, summary: msg, id: msg.id });
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

        const isOwn = group.user?.id === currentUser?.id;

        return (
          <div
            key={`group-${groupIndex}`}
            className={`message-group ${isOwn ? "own" : ""}`}
          >
            {!group.isCompact && (
              <div className="message-header">
                <div className="message-avatar">
                  <Avatar
                    name={group.user?.username || "Unknown"}
                    size={40}
                    imageUrl={group.user?.avatarUrl}
                  />
                  <StatusBadge status="online" />
                </div>
                <div className="message-meta">
                  <span className="message-author">{group.user?.username || "Unknown"}</span>
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
              alt="Attachment" 
              className="message-image"
            />
          ) : message.mediaType === "video" ? (
            <video 
              src={message.mediaUrl} 
              controls 
              className="message-video"
            />
          ) : (
            <a 
              href={message.mediaUrl} 
              download 
              className="message-file"
            >
              📎 Attachment
            </a>
          )}
        </div>
      )}
      
      {!isCompact && isOwn && (
        <div className="message-footer">
          <span className="message-status">✓✓</span>
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
