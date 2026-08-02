import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "../ui/Avatar";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function msgTimeIso(m) {
  return m.timestamp || m.createdAt;
}

export default function MessageBubble({
  message,
  isOwn,
  myUserId,
  onReact,
  onEdit,
  onDelete,
  onOpenProfile,
  compact = false,
}) {
  const [hover, setHover] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text || "");

  const reactions = message.reactions || {};
  const reactionEntries = useMemo(() => Object.entries(reactions), [reactions]);

  const saveEdit = () => {
    const t = draft.trim();
    if (t && t !== message.text) onEdit?.(message.id, t);
    setEditing(false);
  };

  return (
    <motion.article
      className={`msg-row ${isOwn ? "msg-own" : ""} ${compact ? "msg-compact" : ""}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!compact ? (
        <div className="msg-avatar-wrap">
          <button
            type="button"
            className="msg-avatar-btn"
            onClick={() => onOpenProfile?.(message)}
            title="Profile"
          >
            <Avatar
              name={message.from?.displayName || message.displayName || message.username || "?"}
              size={40}
              user={message.from || { avatarUrl: message.avatarUrl, username: message.username, displayName: message.displayName }}
              animate="hover"
            />
          </button>
        </div>
      ) : (
        <div className="msg-avatar-spacer" aria-hidden />
      )}
      <div className="msg-body">
        {!compact && (
          <header className="msg-meta">
            <button
              type="button"
              className="msg-author"
              onClick={() => onOpenProfile?.(message)}
            >
              {message.from?.displayName || message.displayName || message.username || "Unknown"}
            </button>
            <span
              className="msg-time-wrap"
              data-tooltip={new Date(msgTimeIso(message)).toLocaleString()}
            >
              <time dateTime={msgTimeIso(message)}>{formatTime(msgTimeIso(message))}</time>
            </span>
            {message.edited && <span className="msg-edited">(edited)</span>}
          </header>
        )}
        {compact && (
          <span
            className="msg-time-inline msg-time-wrap"
            data-tooltip={new Date(msgTimeIso(message)).toLocaleString()}
          >
            {formatTime(msgTimeIso(message))}
          </span>
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
                  setDraft(message.text);
                  setEditing(false);
                }
              }}
              autoFocus
            />
            <div className="msg-edit-actions">
              <button type="button" className="btn-ghost sm" onClick={saveEdit}>
                Save
              </button>
              <button
                type="button"
                className="btn-ghost sm"
                onClick={() => {
                  setDraft(message.text);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="msg-text">{message.text}</p>
        )}

        <AnimatePresence>
          {reactionEntries.length > 0 && (
            <motion.div
              className="msg-reactions"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {reactionEntries.map(([emoji, ids]) => {
                const list = Array.isArray(ids) ? ids : [];
                const mine = list.includes(myUserId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`reaction-pill ${mine ? "mine" : ""}`}
                    onClick={() => onReact?.(message.id, emoji)}
                  >
                    <span>{emoji}</span>
                    <span className="reaction-count">{list.length}</span>
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
                    Edit
                  </button>
                  <button type="button" className="toolbar-btn danger" onClick={() => onDelete?.(message.id)}>
                    Delete
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
