import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Smile, Hash, Loader2, Edit3, Trash2, Check, X } from "lucide-react";
import { useGuildMessages } from "../../hooks/useGuildMessages";
import { Avatar } from "../ui/Avatar";

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

function GuildMessageBubble({
  message,
  isOwn,
  myId,
  onReact,
  onEdit,
  onDelete,
  compact,
}) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content || "");

  const sender = message.sender || {};
  const reactions = message.reactions || [];

  const saveEdit = () => {
    const t = draft.trim();
    if (t && t !== message.content) onEdit?.(message.id, t);
    setEditing(false);
  };

  return (
    <motion.div
      className={`msg-row ${isOwn ? "msg-own" : ""} ${compact ? "msg-compact" : ""}`}
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!compact ? (
        <div className="msg-avatar-wrap">
          <Avatar name={sender.username || "?"} size={40} user={sender} />
        </div>
      ) : (
        <div className="msg-avatar-spacer" aria-hidden />
      )}
      <div className="msg-body">
        {!compact && (
          <header className="msg-meta">
            <span className="msg-author">{sender.username || "Unknown"}</span>
            <span className="msg-time-wrap">
              <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
            </span>
            {message.is_edited && <span className="msg-edited">(edited)</span>}
          </header>
        )}
        {compact && (
          <span className="msg-time-inline msg-time-wrap">{formatTime(message.created_at)}</span>
        )}

        {editing ? (
          <div className="msg-edit-box">
            <input
              className="msg-edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") {
                  setDraft(message.content || "");
                  setEditing(false);
                }
              }}
              autoFocus
            />
            <div className="msg-edit-actions">
              <button type="button" className="btn-ghost sm" onClick={saveEdit}>
                <Check size={14} /> Save
              </button>
              <button
                type="button"
                className="btn-ghost sm"
                onClick={() => {
                  setDraft(message.content || "");
                  setEditing(false);
                }}
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="msg-text">{message.content}</p>
        )}

        <AnimatePresence>
          {reactions.length > 0 && (
            <motion.div
              className="msg-reactions"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {reactions.map((r) => {
                const mine = r.users?.includes(myId);
                return (
                  <button
                    key={r.emoji}
                    type="button"
                    className={`reaction-pill ${mine ? "mine" : ""}`}
                    onClick={() => onReact?.(message.id, r.emoji)}
                  >
                    <span>{r.emoji}</span>
                    <span className="reaction-count">{r.count}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hover && !editing && (
            <motion.div
              className="msg-toolbar"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
            >
              <div className="msg-quick-react">
                {QUICK_EMOJIS.map((e) => (
                  <button key={e} type="button" className="emoji-chip" onClick={() => onReact?.(message.id, e)}>
                    {e}
                  </button>
                ))}
              </div>
              {isOwn && (
                <>
                  <button type="button" className="toolbar-btn" onClick={() => setEditing(true)}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <button type="button" className="toolbar-btn danger" onClick={() => onDelete?.(message.id)}>
                    <Trash2 size={12} /> Delete
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function GuildChatView({ socket, me, guildId, channelId, channelName }) {
  const myId = me?.id;
  const {
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
  } = useGuildMessages(socket, guildId, channelId, myId);

  const containerRef = useRef(null);
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimerRef = useRef(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage({ content: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    sendTyping();
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {}, 3000);
  };

  const handleLoadMore = () => {
    if (containerRef.current) {
      const prevHeight = containerRef.current.scrollHeight;
      loadMore().then(() => {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const newHeight = containerRef.current.scrollHeight;
            containerRef.current.scrollTop = newHeight - prevHeight;
          }
        });
      });
    }
  };

  const EMOJI_CATEGORIES = [
    { name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"] },
    { name: "Gestures", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦿","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","💋","🩸"] },
  ];

  return (
    <div className="guild-chat-view">
      {/* Messages */}
      <div className="guild-messages-container" ref={containerRef}>
        {hasMore && (
          <div className="guild-load-more">
            <button className="btn-ghost sm" onClick={handleLoadMore} disabled={loading}>
              {loading ? <Loader2 size={14} className="spin" /> : "Load more messages"}
            </button>
          </div>
        )}
        {messages.map((msg, idx) => {
          const prev = messages[idx - 1];
          const compact =
            prev &&
            prev.sender?.id === msg.sender?.id &&
            isSameDay(prev.created_at, msg.created_at) &&
            new Date(msg.created_at) - new Date(prev.created_at) < 5 * 60 * 1000;
          const showDate = !prev || !isSameDay(prev.created_at, msg.created_at);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="guild-date-divider">
                  <span>{formatDate(msg.created_at)}</span>
                </div>
              )}
              <GuildMessageBubble
                message={msg}
                isOwn={msg.sender_id === myId}
                myId={myId}
                onReact={toggleReaction}
                onEdit={editMessage}
                onDelete={deleteMessage}
                compact={compact}
              />
            </div>
          );
        })}
        {messages.length === 0 && !loading && (
          <div className="empty-state">
            <Hash size={48} />
            <h3>#{channelName}</h3>
            <p>This is the start of the channel. Send a message to get started!</p>
          </div>
        )}
      </div>

      {/* Typing indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="guild-typing-bar"
          >
            <div className="typing-dots">
              <span />
              <span />
              <span />
            </div>
            <span className="typing-names">
              {typingUsers.map((u) => u.username).join(", ")} typing…
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div className="guild-composer">
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="emoji-picker"
            >
              <div className="emoji-picker-header">
                <span>Emojis</span>
                <button className="emoji-picker-close" onClick={() => setShowEmojiPicker(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="emoji-picker-body">
                {EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.name} className="emoji-category">
                    <span className="emoji-category-name">{cat.name}</span>
                    <div className="emoji-grid">
                      {cat.emojis.map((em) => (
                        <button
                          key={em}
                          className="emoji-btn"
                          onClick={() => {
                            setInput((v) => v + em);
                            setShowEmojiPicker(false);
                          }}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="guild-composer-inner">
          <button
            className="composer-action-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emoji"
          >
            <Smile size={22} />
          </button>
          <textarea
            className="guild-composer-input"
            placeholder={`Message #${channelName || "channel"}`}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ minHeight: "44px", maxHeight: "120px", resize: "none" }}
          />
          <motion.button
            className={`composer-send-btn ${input.trim() ? "active" : ""}`}
            onClick={handleSend}
            disabled={!input.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Send size={20} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
