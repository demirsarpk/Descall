import { motion } from "framer-motion";
import { Phone, Video, Users, LogIn } from "lucide-react";

/**
 * Persistent banner shown at the top of a group chat when a call is ongoing.
 * Clicking "Join" triggers the caller's join flow.
 */
export default function ActiveCallBanner({ banner, onJoin, onDismiss }) {
  if (!banner) return null;

  const isVideo = banner.callType === "video";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      style={{
        background: "linear-gradient(90deg, rgba(59,165,93,0.18) 0%, rgba(59,165,93,0.08) 100%)",
        borderBottom: "1px solid rgba(59,165,93,0.3)",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Pulsing dot */}
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [1, 0.6, 1] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#3ba55d",
          flexShrink: 0,
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(59,165,93,0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isVideo ? <Video size={16} color="#3ba55d" /> : <Phone size={16} color="#3ba55d" />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
          Devam eden {isVideo ? "görüntülü" : "sesli"} arama
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
          <Users size={11} color="#b5bac1" />
          <span style={{ fontSize: 12, color: "#b5bac1" }}>
            {banner.participantCount} katılımcı
            {banner.initiatorUsername ? ` · ${banner.initiatorUsername} başlattı` : ""}
          </span>
        </div>
      </div>

      {/* Join button */}
      <motion.button
        whileHover={{ scale: 1.04, background: "#2d9e52" }}
        whileTap={{ scale: 0.97 }}
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
        Katıl
      </motion.button>
    </motion.div>
  );
}
