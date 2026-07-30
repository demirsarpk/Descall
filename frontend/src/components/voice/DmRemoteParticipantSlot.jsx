import { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Wifi, WifiOff } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { resolveAvatarUrl } from "../../lib/avatar";
import {
  deriveDmConnectionStatus,
  getConnectionStatusLabel,
  DM_PARTICIPANT_EXIT_MS,
} from "../../hooks/useDmRemoteParticipant";

const PARTICIPANT_EASE = [0.16, 1, 0.3, 1];

const enterVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: PARTICIPANT_EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: { duration: DM_PARTICIPANT_EXIT_MS / 1000, ease: PARTICIPANT_EASE },
  },
};

function ConnectionBadge({ status }) {
  const label = getConnectionStatusLabel(status);
  if (!label) return null;

  const isReconnecting = status === "reconnecting" || status === "connecting";
  const isDisconnected = status === "disconnected";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 20,
        background: isDisconnected
          ? "rgba(237,66,69,0.2)"
          : isReconnecting
          ? "rgba(240,178,50,0.18)"
          : "rgba(59,165,93,0.18)",
        color: isDisconnected ? "#ed4245" : isReconnecting ? "#f0b232" : "#3ba55d",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.01em",
      }}
    >
      {isDisconnected ? <WifiOff size={11} /> : <Wifi size={11} />}
      {label}
    </div>
  );
}

function ConnectingPlaceholder({ username, user, status }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.28, ease: PARTICIPANT_EASE }}
      style={{
        position: "relative",
        borderRadius: 14,
        overflow: "hidden",
        background: "#1a1b1f",
        border: "2px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
        willChange: "transform, opacity",
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      >
        <Avatar name={username || "?"} size={64} imageUrl={resolveAvatarUrl(user)} />
      </motion.div>
      <div style={{ textAlign: "center", padding: "0 12px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>
          {username || "Participant"}
        </div>
        <ConnectionBadge status={status || "connecting"} />
      </div>
    </motion.div>
  );
}

export default function DmRemoteParticipantSlot({
  displayPeer,
  phase,
  connectionStatus,
  isMediaReady,
  hasVideo,
  videoRef,
  remoteStream,
  isSpeaking = false,
  isMuted = false,
}) {
  const username = displayPeer?.username || "User";
  const user = displayPeer;

  const remoteVideoCallbackRef = useCallback(
    (el) => {
      if (!videoRef) return;
      videoRef.current = el;
      if (el && remoteStream) {
        if (el.srcObject !== remoteStream) el.srcObject = remoteStream;
        el.play().catch(() => {});
      }
    },
    [videoRef, remoteStream]
  );

  useEffect(() => {
    const el = videoRef?.current;
    if (!el || !remoteStream || !hasVideo) return;
    if (el.srcObject !== remoteStream) {
      el.srcObject = remoteStream;
      el.play().catch(() => {});
    }
  }, [remoteStream, hasVideo, videoRef]);

  const showConnecting = phase === "connecting" || (phase === "visible" && !isMediaReady);
  const showParticipant = phase === "visible" && isMediaReady;

  return (
    <AnimatePresence mode="wait">
      {showConnecting && displayPeer && (
        <ConnectingPlaceholder
          key={`connecting-${displayPeer.id}`}
          username={username}
          user={user}
          status={connectionStatus || "connecting"}
        />
      )}
      {showParticipant && displayPeer && (
        <motion.div
          key={`participant-${displayPeer.id}`}
          layout
          variants={enterVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            background: "#1a1b1f",
            border: isSpeaking ? "2px solid #3ba55d" : "2px solid transparent",
            boxShadow: isSpeaking ? "0 0 0 1px rgba(59,165,93,0.35)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 0,
            minHeight: 0,
            width: "100%",
            height: "100%",
            willChange: "transform, opacity",
          }}
        >
          {hasVideo && videoRef ? (
            <video
              ref={remoteVideoCallbackRef}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <Avatar name={username} size={64} imageUrl={resolveAvatarUrl(user)} />
              <span style={{ fontSize: 13, color: "#b5bac1", fontWeight: 500 }}>{username}</span>
              <ConnectionBadge status="connected" />
            </div>
          )}

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "8px 12px",
              background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {isSpeaking && (
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#3ba55d",
                    flexShrink: 0,
                    animation: "callTilePulse 1.2s infinite",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {username}
              </span>
            </div>
            {isMuted && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(237,66,69,0.85)",
                  flexShrink: 0,
                }}
                title="Muted"
              >
                <MicOff size={12} color="#fff" />
              </span>
            )}
            {!isMuted && isSpeaking && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(59,165,93,0.85)",
                  flexShrink: 0,
                }}
                title="Speaking"
              >
                <Mic size={12} color="#fff" />
              </span>
            )}
          </div>
        </motion.div>
      )}
      {phase === "exiting" && displayPeer && (
        <motion.div
          key={`exiting-${displayPeer.id}`}
          layout
          initial={{ opacity: 1, scale: 1, y: 0 }}
          animate={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: DM_PARTICIPANT_EXIT_MS / 1000, ease: PARTICIPANT_EASE }}
          style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            background: "#1a1b1f",
            border: "2px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            minWidth: 0,
            minHeight: 0,
            width: "100%",
            height: "100%",
            willChange: "transform, opacity",
          }}
        >
          <Avatar name={username} size={64} imageUrl={resolveAvatarUrl(user)} />
          <ConnectionBadge status="disconnected" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { deriveDmConnectionStatus, getConnectionStatusLabel };
