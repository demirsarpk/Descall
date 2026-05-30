import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor, Minus, Maximize2 } from "lucide-react";
import RippleButton from "./ui/RippleButton";
import { Avatar } from "./ui/Avatar";

export default function CallOverlay({ call, groupCall }) {
  const [minimized, setMinimized] = useState(false);

  const isDmActive = call?.mode !== null && call?.mode !== undefined;
  const isGroupActive = groupCall?.isInCall;
  const active = isDmActive || isGroupActive;

  useEffect(() => {
    if (!active) setMinimized(false);
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
  const formattedDuration = duration ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}` : "";
  const title = isDm ? (peer?.username || "User") : "Group Call";
  const subtitle = isDm
    ? (mode === "incoming" ? "Incoming call..." : mode === "outgoing" ? "Calling..." : (callType === "video" ? "Video call" : "Voice call"))
    : `${groupCall.participants?.length || 0} participants`;

  if (minimized) {
    return (
      <motion.div
        className="call-overlay-minimized"
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 9999,
          background: "var(--surface-1)",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          border: "1px solid var(--border)",
        }}
        onClick={() => setMinimized(false)}
      >
        {isDm ? (
          <Avatar name={peer?.username || "?"} size={40} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UsersIcon size={20} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{subtitle}{formattedDuration ? ` · ${formattedDuration}` : ""}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); isDm ? call.endCall(peer?.id) : groupCall.leaveCall(); }}
          style={{ background: "var(--danger)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
        >
          <PhoneOff size={16} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="call-overlay-fullscreen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "linear-gradient(135deg, #0f1115 0%, #1a1d24 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      {/* Top bar */}
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        <button
          onClick={() => setMinimized(true)}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
        >
          <Minus size={18} />
        </button>
      </div>

      {/* Peer info */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {isDm ? (
          <Avatar name={peer?.username || "?"} size={120} imageUrl={peer?.avatarUrl} />
        ) : (
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UsersIcon size={48} color="var(--primary)" />
          </div>
        )}
        <span style={{ fontSize: 24, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 16, color: "var(--text-muted)" }}>{subtitle}</span>
        {formattedDuration && <span style={{ fontSize: 14, color: "var(--primary)", fontVariantNumeric: "tabular-nums" }}>{formattedDuration}</span>}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 16 }}>
        {mode === "incoming" && isDm && (
          <>
            <button
              onClick={call.acceptIncoming}
              style={{ background: "#3ba55d", border: "none", borderRadius: "50%", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
            >
              <Phone size={28} />
            </button>
            <button
              onClick={call.declineIncoming}
              style={{ background: "#ed4245", border: "none", borderRadius: "50%", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
            >
              <PhoneOff size={28} />
            </button>
          </>
        )}

        {(mode === "outgoing" || mode === "active" || !isDm) && (
          <>
            <button
              onClick={isDm ? call.toggleMute : groupCall.toggleMute}
              style={{ background: muted ? "var(--primary)" : "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
            >
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            {callType === "video" && (
              <button
                onClick={isDm ? call.toggleCamera : groupCall.toggleCamera}
                style={{ background: cameraOn ? "rgba(255,255,255,0.1)" : "var(--primary)", border: "none", borderRadius: "50%", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
              >
                {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
              </button>
            )}
            <button
              onClick={isDm ? (screenSharing ? call.stopScreenShare : call.startScreenShare) : (groupCall.isScreenSharing ? groupCall.stopScreenShare : groupCall.startScreenShare)}
              style={{ background: screenSharing ? "var(--primary)" : "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
            >
              <Monitor size={22} />
            </button>
            <button
              onClick={() => isDm ? call.endCall(peer?.id) : groupCall.leaveCall()}
              style={{ background: "#ed4245", border: "none", borderRadius: "50%", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer" }}
            >
              <PhoneOff size={28} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function UsersIcon({ size = 20, color = "white" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
