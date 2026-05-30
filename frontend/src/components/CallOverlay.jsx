import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor,
  Minus, Maximize2, Users, MessageSquare, Hand, MoreVertical
} from "lucide-react";
import { Avatar } from "./ui/Avatar";

/*
 * Google Meet-style call overlay
 * - Large main video area (peer or screen share)
 * - Self-view picture-in-picture (bottom-right)
 * - Bottom control bar
 * - Top info bar
 * - Minimizable to floating widget
 */
export default function CallOverlay({ call, groupCall }) {
  const [minimized, setMinimized] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [screenExpanded, setScreenExpanded] = useState(false);

  const isDmActive = call?.mode !== null && call?.mode !== undefined;
  const isGroupActive = groupCall?.isInCall;
  const active = isDmActive || isGroupActive;

  useEffect(() => {
    if (!active) {
      setMinimized(false);
      setShowParticipants(false);
      setShowChat(false);
      setScreenExpanded(false);
    }
  }, [active]);

  if (!active) return null;

  const isDm = isDmActive;
  const mode = isDm ? call.mode : "active";
  const peer = isDm ? call.peer : null;
  const callType = isDm ? call.callType : groupCall.callType;
  const muted = isDm ? call.muted : groupCall.isMuted;
  const cameraOn = isDm ? call.cameraOn : groupCall.isCameraOn;
  const screenSharing = isDm ? call.screenSharing : groupCall.isScreenSharing;
  const duration = isDm ? call.duration : groupCall.duration;
  const formattedDuration = duration
    ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`
    : "";
  const title = isDm ? (peer?.username || "User") : "Group Call";
  const subtitle = isDm
    ? mode === "incoming"
      ? "Incoming call..."
      : mode === "outgoing"
      ? "Calling..."
      : callType === "video"
      ? "Video call"
      : "Voice call"
    : `${groupCall.participants?.length || 0} participants`;

  /* ---------- Minimized widget ---------- */
  if (minimized) {
    return (
      <motion.div
        className="call-overlay-minimized"
        initial={{ opacity: 0, y: 60, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 60, scale: 0.9 }}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          background: "#1e1f23",
          borderRadius: 14,
          padding: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.06)",
          minWidth: 260,
        }}
        onClick={() => setMinimized(false)}
      >
        <div style={{ position: "relative" }}>
          {isDm ? (
            <Avatar name={peer?.username || "?"} size={44} imageUrl={peer?.avatarUrl} />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#5865f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={22} color="white" />
            </div>
          )}
          {screenSharing && (
            <div
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                background: "#3ba55d",
                borderRadius: "50%",
                width: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Monitor size={10} color="white" />
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{title}</span>
          <span style={{ fontSize: 12, color: "#b5bac1" }}>
            {subtitle}
            {formattedDuration ? ` · ${formattedDuration}` : ""}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            isDm ? call.endCall(peer?.id) : groupCall.leaveCall();
          }}
          style={{
            background: "#ed4245",
            border: "none",
            borderRadius: "50%",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <PhoneOff size={18} />
        </button>
      </motion.div>
    );
  }

  /* ---------- Fullscreen Meet-style overlay ---------- */
  const hasRemoteVideo = callType === "video" && isDm && call?.remoteStream;
  const hasLocalVideo = cameraOn && (isDm ? call?.localStream : groupCall?.localStream);
  const hasScreenShare = screenSharing;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "#0f1115",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ====== TOP INFO BAR ====== */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, pointerEvents: "auto" }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{title}</span>
          {screenSharing && (
            <span
              style={{
                background: "#3ba55d",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Monitor size={12} />
              Presenting
            </span>
          )}
          <span style={{ fontSize: 13, color: "#b5bac1" }}>
            {subtitle}
            {formattedDuration ? ` · ${formattedDuration}` : ""}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
          <TopIconBtn onClick={() => setShowParticipants(!showParticipants)} active={showParticipants}>
            <Users size={18} />
          </TopIconBtn>
          <TopIconBtn onClick={() => setShowChat(!showChat)} active={showChat}>
            <MessageSquare size={18} />
          </TopIconBtn>
          <TopIconBtn onClick={() => setMinimized(true)}>
            <Minus size={18} />
          </TopIconBtn>
        </div>
      </div>

      {/* ====== MAIN VIDEO AREA ====== */}
      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          overflow: "hidden",
        }}
      >
        {/* Screen share takes full area - clickable to toggle size */}
        {hasScreenShare ? (
          <div
            onClick={() => setScreenExpanded(!screenExpanded)}
            style={{
              position: screenExpanded ? "fixed" : "relative",
              inset: screenExpanded ? 0 : undefined,
              zIndex: screenExpanded ? 50 : 1,
              width: screenExpanded ? "100%" : "85%",
              height: screenExpanded ? "100%" : "85%",
              cursor: "pointer",
              transition: "all 0.3s ease",
              borderRadius: screenExpanded ? 0 : 12,
              overflow: "hidden",
              background: "#000",
            }}
          >
            <video
              ref={call?.screenVideoRef}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            {!screenExpanded && (
              <div style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
              }}>
                Click to expand
              </div>
            )}
          </div>
        ) : hasRemoteVideo ? (
          <video
            ref={call?.remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 12,
              background: "#000",
            }}
          />
        ) : (
          /* Voice call / no video: large avatar center */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {isDm ? (
              <Avatar name={peer?.username || "?"} size={160} imageUrl={peer?.avatarUrl} />
            ) : (
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  background: "#5865f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={72} color="white" />
              </div>
            )}
            <span style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{title}</span>
            <span style={{ fontSize: 16, color: "#b5bac1" }}>{subtitle}</span>
            {formattedDuration && (
              <span style={{ fontSize: 14, color: "#b5bac1", fontVariantNumeric: "tabular-nums" }}>
                {formattedDuration}
              </span>
            )}
          </div>
        )}

        {/* Self-view PiP (bottom-right) */}
        <div
          style={{
            position: "absolute",
            bottom: 100,
            right: 24,
            width: 200,
            height: 140,
            borderRadius: 12,
            overflow: "hidden",
            background: "#1e1f23",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 5,
          }}
        >
          {hasLocalVideo ? (
            <video
              ref={call?.localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Avatar name="Me" size={48} />
              <span style={{ fontSize: 12, color: "#b5bac1" }}>Camera off</span>
            </div>
          )}
        </div>
      </div>

      {/* ====== BOTTOM CONTROL BAR ====== */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: "20px 24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
        }}
      >
        {mode === "incoming" && isDm ? (
          <>
            <CircleBtn color="#3ba55d" size={64} onClick={call.acceptIncoming}>
              <Phone size={28} />
            </CircleBtn>
            <CircleBtn color="#ed4245" size={64} onClick={call.declineIncoming}>
              <PhoneOff size={28} />
            </CircleBtn>
          </>
        ) : (
          <>
            <CircleBtn
              color={muted ? "#ed4245" : "#3c4043"}
              onClick={isDm ? call.toggleMute : groupCall.toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </CircleBtn>

            <CircleBtn
              color={cameraOn ? "#3c4043" : "#ed4245"}
              onClick={isDm ? call.toggleCamera : groupCall.toggleCamera}
              title={cameraOn ? "Turn off camera" : "Turn on camera"}
            >
              {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
            </CircleBtn>

            <CircleBtn
              color={screenSharing ? "#3ba55d" : "#3c4043"}
              onClick={() => {
                if (isDm) {
                  screenSharing ? call.stopScreenShare() : call.startScreenShare();
                } else {
                  groupCall.isScreenSharing ? groupCall.stopScreenShare() : groupCall.startScreenShare();
                }
              }}
              title={screenSharing ? "Stop presenting" : "Present screen"}
            >
              <Monitor size={22} />
            </CircleBtn>

            <CircleBtn color="#3c4043" title="Raise hand">
              <Hand size={22} />
            </CircleBtn>

            <CircleBtn color="#3c4043" title="More options">
              <MoreVertical size={22} />
            </CircleBtn>

            <CircleBtn color="#ed4245" size={56} onClick={() => (isDm ? call.endCall(peer?.id) : groupCall.leaveCall())} title="End call">
              <PhoneOff size={24} />
            </CircleBtn>
          </>
        )}
      </div>

      {/* ====== PARTICIPANTS SIDEBAR ====== */}
      <AnimatePresence>
        {showParticipants && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 300,
              zIndex: 20,
              background: "#1e1f23",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>People</span>
              <button
                onClick={() => setShowParticipants(false)}
                style={{ background: "none", border: "none", color: "#b5bac1", cursor: "pointer" }}
              >
                <PhoneOff size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {isDm ? (
                <PersonRow name={peer?.username || "User"} avatarUrl={peer?.avatarUrl} isHost />
              ) : (
                groupCall.participants?.map((p) => (
                  <PersonRow key={p.id} name={p.username} avatarUrl={p.avatarUrl} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------- Sub-components ---------- */

function CircleBtn({ children, color = "#3c4043", size = 52, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        cursor: "pointer",
        transition: "transform 0.15s, opacity 0.15s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

function TopIconBtn({ children, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: active ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function PersonRow({ name, avatarUrl, isHost }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
      }}
    >
      <Avatar name={name} size={36} imageUrl={avatarUrl} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{name}</span>
        {isHost && <span style={{ fontSize: 11, color: "#b5bac1" }}>Host</span>}
      </div>
    </div>
  );
}
