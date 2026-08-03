import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smile, X } from "lucide-react";
import { useT } from "../../context/LocaleContext";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏", "🤔", "👎"];

export default function MessageReactions({ 
  messageId, 
  conversationType, 
  conversationId, 
  reactions = [], 
  currentUserId,
  socket,
  onReact
}) {
  const t = useT();
  const [showPicker, setShowPicker] = useState(false);
  const [localReactions, setLocalReactions] = useState(reactions);

  // Update local state when props change
  useEffect(() => {
    setLocalReactions(reactions);
  }, [reactions]);

  // Group reactions by emoji
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

  const handleAddReaction = useCallback((emoji) => {
    const reactionData = {
      messageId,
      conversationType,
      conversationId,
      emoji,
    };
    // Optimistic update
    setLocalReactions(prev => {
      const exists = prev.find(r => r.emoji === emoji && r.userId === currentUserId);
      if (exists) return prev;
      return [...prev, { emoji, userId: currentUserId, messageId }];
    });

    if (socket) {
      socket.emit("reaction:add", reactionData);
    }
    onReact?.(reactionData);
    setShowPicker(false);
  }, [messageId, conversationType, conversationId, currentUserId, socket, onReact]);

  const handleRemoveReaction = useCallback((emoji) => {
    const reactionData = {
      messageId,
      conversationType,
      conversationId,
      emoji,
    };

    // Optimistic update
    setLocalReactions(prev => prev.filter(r => !(r.emoji === emoji && r.userId === currentUserId)));

    socket?.emit("reaction:remove", reactionData);
    onReact?.(reactionData);
  }, [messageId, conversationType, conversationId, currentUserId, socket, onReact]);

  const handleReactionClick = (emoji) => {
    const hasReacted = groupedReactions[emoji]?.hasMine;
    if (hasReacted) {
      handleRemoveReaction(emoji);
    } else {
      handleAddReaction(emoji);
    }
  };

  return (
    <div className="message-reactions">
      {/* Existing reactions */}
      <div className="reactions-list">
        {Object.entries(groupedReactions).map(([emoji, data]) => (
          <motion.button
            key={emoji}
            className={`reaction-chip ${data.hasMine ? "reaction-mine" : ""}`}
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

      {/* Add reaction button */}
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
                  {COMMON_EMOJIS.map(emoji => (
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
