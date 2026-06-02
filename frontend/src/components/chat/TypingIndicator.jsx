import { motion, AnimatePresence } from "framer-motion";

const DOT_VARIANTS = {
  animate: (i) => ({
    y: [0, -5, 0],
    opacity: [0.4, 1, 0.4],
    scale: [1, 1.25, 1],
    transition: {
      duration: 0.9,
      repeat: Infinity,
      delay: i * 0.18,
      ease: "easeInOut",
    },
  }),
};

function TypingDots() {
  return (
    <span
      aria-hidden
      style={{ display: "inline-flex", alignItems: "center", gap: 3, marginRight: 6 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          custom={i}
          variants={DOT_VARIANTS}
          animate="animate"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--primary, #5865f2)",
            boxShadow: "0 0 6px var(--primary, #5865f2)",
          }}
        />
      ))}
    </span>
  );
}

export default function TypingIndicator({ names = [] }) {
  if (!names.length) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing`
      : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more are typing`;

  return (
    <AnimatePresence>
      <motion.div
        key="typing-indicator"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "5px 10px",
          borderRadius: 12,
          background: "var(--surface-2, rgba(255,255,255,0.06))",
          border: "1px solid var(--border-1, rgba(255,255,255,0.08))",
          backdropFilter: "blur(6px)",
          maxWidth: "fit-content",
        }}
      >
        <TypingDots />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--text-muted, #8e9297)",
            letterSpacing: "0.01em",
            userSelect: "none",
          }}
        >
          {label}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
