import { useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, VideoOff, Wifi, WifiOff } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import AdminBadge from "../social/AdminBadge";
import { BadgeIcon, NameEffectText } from "../ui/Cosmetics";
import { resolveAvatarUrl } from "../../lib/avatar";
import { resolveDisplayName } from "../../lib/userProfile";
import {
  deriveDmConnectionStatus,
  getConnectionStatusLabel,
  DM_PARTICIPANT_EXIT_MS,
} from "../../hooks/useDmRemoteParticipant";
import { useT } from "../../context/LocaleContext";

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
  const t = useT();
  const labelRaw = getConnectionStatusLabel(status);
  const label = labelRaw ? t(labelRaw) : labelRaw;
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
  const t = useT();
  const displayName = resolveDisplayName(user) || username || t("Participant");
  const avatarSize = 96;
  const shellPad = Math.round(avatarSize * 0.2);
  const shellSize = avatarSize + shellPad * 2;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.28, ease: PARTICIPANT_EASE }}
      className="dm-remote-connecting participant-tile--avatar-only"
      style={{
        position: "relative",
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
        overflow: "visible",
      }}
    >
      <motion.div
        className="participant-tile-avatar-shell"
        style={{ width: shellSize, height: shellSize }}
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
      >
        <div className="participant-tile-avatar-core" style={{ width: avatarSize, height: avatarSize }}>
          <Avatar
            name={displayName}
            size={avatarSize}
            user={user}
            imageUrl={resolveAvatarUrl(user)}
            animate="speaking"
            isSpeaking={false}
          />
        </div>
      </motion.div>
      <div className="participant-tile-identity">
        <span className="participant-tile-identity-name">
          <NameEffectText user={user}>{displayName}</NameEffectText>
          <BadgeIcon user={user} />
        </span>
        <AdminBadge user={user} variant="chip" />
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
  cameraOn = true,
}) {
  const t = useT();
  const user = displayPeer;
  const username = resolveDisplayName(displayPeer) || displayPeer?.username || t("User");

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
          className={`participant-tile${isSpeaking ? " is-speaking" : ""}${
            hasVideo && videoRef ? "" : " participant-tile--avatar-only"
          }`}
          style={{ willChange: "transform, opacity" }}
        >
          {hasVideo && videoRef ? (
            <video
              ref={remoteVideoCallbackRef}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div className="participant-tile-avatar-stack">
              <div
                className="participant-tile-avatar-shell"
                style={{ width: 96 + 38, height: 96 + 38, position: "relative" }}
              >
                {isSpeaking && (
                  <>
                    <span
                      aria-hidden="true"
                      className="speaking-ring ring-a active"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "50%",
                        border: "2px solid #3ba55d",
                        boxShadow: "0 0 0 3px rgba(59,165,93,0.22)",
                        animation: "callTilePulse 1.2s infinite",
                        opacity: 1,
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="speaking-ring ring-b active"
                      style={{
                        position: "absolute",
                        inset: 8,
                        borderRadius: "50%",
                        border: "1px solid rgba(59,165,93,0.38)",
                        animation: "callTilePulse 1.2s 0.18s infinite",
                        opacity: 1,
                      }}
                    />
                  </>
                )}
                <div className="participant-tile-avatar-core" style={{ width: 96, height: 96 }}>
                  <Avatar
                    name={username}
                    size={96}
                    user={user}
                    imageUrl={resolveAvatarUrl(user)}
                    animate="speaking"
                    isSpeaking={isSpeaking}
                  />
                </div>
              </div>
              <div className="participant-tile-identity">
                <span className="participant-tile-identity-name">
                  <NameEffectText user={user}>{username}</NameEffectText>
                  <BadgeIcon user={user} />
                </span>
                <AdminBadge user={user} variant="chip" />
                <ConnectionBadge status="connected" />
              </div>
            </div>
          )}

          {hasVideo && videoRef && (
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
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  minWidth: 0,
                }}
              >
                <NameEffectText user={user}>{username}</NameEffectText>
                <BadgeIcon user={user} />
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
                title={t("Muted")}
              >
                <MicOff size={12} color="#fff" />
              </span>
            )}
            {cameraOn === false && (
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
                title={t("Camera off")}
              >
                <VideoOff size={12} color="#fff" />
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
                title={t("Speaking")}
              >
                <Mic size={12} color="#fff" />
              </span>
            )}
          </div>
          )}
        </motion.div>
      )}
      {phase === "exiting" && displayPeer && (
        <motion.div
          key={`exiting-${displayPeer.id}`}
          layout
          initial={{ opacity: 1, scale: 1, y: 0 }}
          animate={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: DM_PARTICIPANT_EXIT_MS / 1000, ease: PARTICIPANT_EASE }}
          className="participant-tile--avatar-only"
          style={{
            position: "relative",
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
          <Avatar
            name={username}
            size={96}
            user={user}
            imageUrl={resolveAvatarUrl(user)}
            animate="never"
          />
          <ConnectionBadge status="disconnected" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { deriveDmConnectionStatus, getConnectionStatusLabel };
