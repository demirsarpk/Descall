import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video, Users } from "lucide-react";
import { Avatar } from "./ui/Avatar";

/**
 * Floating incoming group call modal — Discord/WhatsApp style.
 * Shown to every group member when someone starts a group voice/video call.
 */
export default function GroupCallIncomingModal({ incomingCall, onAccept, onDecline }) {
  // Auto-dismiss after 30s without interaction
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => onDecline?.(incomingCall.groupId, incomingCall.fromUser?.id, incomingCall.fromUser, incomingCall.callType), 30_000);
    return () => clearTimeout(timer);
  }, [incomingCall, onDecline]);

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          key="group-incoming-call"
          initial={{ opacity: 0, y: -80, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.92 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            background: "linear-gradient(135deg, #1e1f23 0%, #2b2d33 100%)",
            borderRadius: 18,
            padding: "20px 24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 340,
            maxWidth: 420,
          }}
        >
          {/* Caller avatar */}
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            style={{ position: "relative", flexShrink: 0 }}
          >
            <Avatar
              name={incomingCall.fromUser?.username || "?"}
              size={52}
              user={incomingCall.fromUser}
            />
            <div
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: incomingCall.callType === "video" ? "#5865f2" : "#3ba55d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #1e1f23",
              }}
            >
              {incomingCall.callType === "video" ? (
                <Video size={11} color="#fff" />
              ) : (
                <Phone size={11} color="#fff" />
              )}
            </div>
          </motion.div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#b5bac1", marginBottom: 2 }}>
              {incomingCall.callType === "video" ? "Video call" : "Voice call"}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {incomingCall.fromUser?.username || "Someone"} is calling
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
              <Users size={12} color="#b5bac1" />
              <span style={{ fontSize: 12, color: "#b5bac1" }}>Group call</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDecline?.(incomingCall.groupId, incomingCall.fromUser?.id, incomingCall.fromUser, incomingCall.callType)}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#ed4245",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
              }}
              title="Decline"
            >
              <PhoneOff size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAccept?.(incomingCall.groupId, incomingCall.callType, incomingCall.fromUser)}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#3ba55d",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
              }}
              title="Accept"
            >
              <Phone size={20} />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
