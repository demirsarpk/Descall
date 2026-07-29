import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Video, Users, LogIn, X } from "lucide-react";
import { Avatar } from "./ui/Avatar";
import { resolveAvatarUrl } from "../lib/avatar";

/**
 * Ongoing call bubble — same shape as CallSummaryBubble but green/live.
 * Rendered inline inside the message list at the bottom.
 */
export default function ActiveCallBanner({ banner, onJoin, onDismiss }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!banner) { setElapsed(0); return; }
    const base = banner.startTime ? Math.floor((Date.now() - banner.startTime) / 1000) : 0;
    setElapsed(Math.max(0, base));
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [banner?.groupId]);

  if (!banner) return null;

  const isVideo = banner.callType === "video";
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");
  const durationLabel = `${mins}:${secs}`;

  return (
    <AnimatePresence>
      <motion.div
        key="active-call-banner"
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ display: "flex", justifyContent: "center", padding: "6px 16px" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            background: "rgba(40, 40, 44, 0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(59,165,93,0.35)",
            borderRadius: 14,
            padding: "12px 18px",
            maxWidth: 380,
            width: "100%",
            position: "relative",
          }}
        >
          {/* Initiator avatar */}
          <div style={{ flexShrink: 0 }}>
            <Avatar
              name={banner.initiatorUsername || "?"}
              size={44}
              imageUrl={resolveAvatarUrl(banner)}
            />
          </div>

          {/* Text block */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              {isVideo ? "Video call" : "Voice call"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
              <span style={{ fontSize: 12, color: "#3ba55d", fontWeight: 600 }}>
                {durationLabel}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={11} color="#b5bac1" />
                <span style={{ fontSize: 12, color: "#b5bac1" }}>
                  {banner.participantCount ?? 1} participant{(banner.participantCount ?? 1) !== 1 ? "s" : ""} joined
                </span>
              </div>
            </div>
            {banner.initiatorUsername && (
              <div style={{ fontSize: 11, color: "#72767d", marginTop: 3 }}>
                Started by {banner.initiatorUsername}
              </div>
            )}
          </div>

          {/* Join button */}
          <motion.button
            whileHover={{ scale: 1.05, background: "#2d9e52" }}
            whileTap={{ scale: 0.96 }}
            onClick={onJoin}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 20,
              background: "#3ba55d",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <LogIn size={14} />
            Join
          </motion.button>

          {/* Dismiss */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "none",
                border: "none",
                color: "#72767d",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
