import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, X } from "lucide-react";
import { useT } from "../../context/LocaleContext";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏", "🤔", "👎"];

const BURST_PARTICLES = [
  { x: -22, y: -28, r: -18, d: 0 },
  { x: 18, y: -30, r: 14, d: 0.04 },
  { x: -28, y: 6, r: -28, d: 0.08 },
  { x: 26, y: 4, r: 22, d: 0.06 },
  { x: 4, y: -36, r: 6, d: 0.02 },
];

export default function MessageReactions({
  messageId,
  conversationType,
  conversationId,
  reactions = [],
  currentUserId,
  socket,
  onReact,
  burstKey = null,
}) {
  const t = useT();
  const [showPicker, setShowPicker] = useState(false);
  const [localReactions, setLocalReactions] = useState(reactions);
  const [burst, setBurst] = useState(null);

  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  const groupedReactions = (Array.isArray(localReactions) ? localReactions : []).reduce((acc, reaction) => {
    const emoji = reaction?.emoji;
    const userId = reaction?.userId;
    if (!emoji || !userId) return acc;
    if (!acc[emoji]) {
      acc[emoji] = { count: 0, users: [], hasMine: false };
    }
    acc[emoji].count++;
    acc[emoji].users.push(userId);
    if (userId === currentUserId) {
      acc[emoji].hasMine = true;
    }
    return acc;
  }, {});

  const triggerBurst = useCallback((emoji) => {
    const id = `${Date.now()}-${emoji}`;
    setBurst({ id, emoji });
    window.setTimeout(() => {
      setBurst((prev) => (prev?.id === id ? null : prev));
    }, 520);
  }, []);

  const handleAddReaction = useCallback(
    (emoji) => {
      const reactionData = {
        messageId,
        conversationType,
        conversationId,
        emoji,
      };
      setLocalReactions((prev) => {
        const exists = prev.find((r) => r.emoji === emoji && r.userId === currentUserId);
        if (exists) return prev;
        return [...prev, { emoji, userId: currentUserId, messageId }];
      });
      triggerBurst(emoji);

      if (socket) {
        socket.emit("reaction:add", reactionData);
      }
      onReact?.(reactionData);
      setShowPicker(false);
    },
    [messageId, conversationType, conversationId, currentUserId, socket, onReact, triggerBurst]
  );

  const handleRemoveReaction = useCallback(
    (emoji) => {
      const reactionData = {
        messageId,
        conversationType,
        conversationId,
        emoji,
      };

      setLocalReactions((prev) => prev.filter((r) => !(r.emoji === emoji && r.userId === currentUserId)));

      socket?.emit("reaction:remove", reactionData);
      onReact?.(reactionData);
    },
    [messageId, conversationType, conversationId, currentUserId, socket, onReact]
  );

  const handleReactionClick = (emoji) => {
    const hasReacted = groupedReactions[emoji]?.hasMine;
    if (hasReacted) {
      handleRemoveReaction(emoji);
    } else {
      handleAddReaction(emoji);
    }
  };

  return (
    <div className={`message-reactions${burstKey ? ` cosmetic-reaction-burst burst-${burstKey}` : ""}`}>
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.id}
            className="reaction-burst-pop"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          >
            {BURST_PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                className="reaction-burst-pop-emoji"
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: p.x,
                  y: p.y,
                  scale: [0.4, 1.15, 0.7],
                  rotate: p.r,
                }}
                transition={{ duration: 0.48, delay: p.d, ease: [0.16, 1, 0.3, 1] }}
              >
                {burst.emoji}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="reactions-list">
        {Object.entries(groupedReactions).map(([emoji, data]) => (
          <motion.button
            key={emoji}
            className={`reaction-chip ${data.hasMine ? "reaction-mine" : ""}${
              data.hasMine && burstKey ? ` burst-chip-${burstKey}` : ""
            }`}
            onClick={() => handleReactionClick(emoji)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={t(data.count === 1 ? "{count} reaction" : "{count} reactions", { count: data.count })}
          >
            <span className="reaction-emoji">{emoji}</span>
            <span className="reaction-count">{data.count}</span>
          </motion.button>
        ))}
      </div>

      <div className="reaction-add-wrapper">
        <motion.button
          className="reaction-add-btn"
          onClick={() => setShowPicker(!showPicker)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={t("Add reaction")}
        >
          <Smile size={16} />
        </motion.button>

        <AnimatePresence>
          {showPicker && (
            <>
              <motion.div
                className="reaction-picker-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPicker(false)}
              />
              <motion.div
                className="reaction-picker"
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
              >
                <div className="reaction-picker-header">
                  <span>{t("Add Reaction")}</span>
                  <button className="reaction-picker-close" onClick={() => setShowPicker(false)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="reaction-picker-grid">
                  {COMMON_EMOJIS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      className="reaction-picker-emoji"
                      onClick={() => handleAddReaction(emoji)}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
