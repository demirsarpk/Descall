import { motion } from "framer-motion";
import { PhoneOff, Mic, MicOff, Video, VideoOff, Monitor } from "lucide-react";
import RippleButton from "./ui/RippleButton";
import { useT } from "../context/LocaleContext";

/**
 * Mobile-optimized video conference UI
 * Simplified version for smaller screens
 */
export default function VideoConferenceMobile({
  isOpen,
  onClose,
  minimized = false,
  onMinimize,
  call,
  participants,
  localStream,
  screenStream,
  isMuted,
  isCameraOn,
  isScreenSharing,
  toggleMute,
  toggleCamera,
  startScreenShare,
  stopScreenShare,
  leaveCall,
  callType,
  screenQuality,
  setScreenQuality,
  onProcessedStream,
}) {
  const t = useT();
  if (!isOpen || minimized) return null;

  const safeParticipants = Array.isArray(participants) ? participants : [];

  return (
    <motion.div
      className="vc-mobile-overlay"
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ duration: 0.3 }}
    >
      <div className="vc-mobile-header">
        <span className="vc-mobile-title">
          {callType === "video" ? t("Video Call") : t("Voice Call")}
        </span>
        <button className="vc-mobile-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="vc-mobile-content">
        {safeParticipants.map((p) => (
          <div key={p.id} className="vc-mobile-participant">
            <span>{p.username || t("User")}</span>
          </div>
        ))}
      </div>

      <div className="vc-mobile-controls">
        <RippleButton className={`vc-btn ${isMuted ? "danger" : ""}`} onClick={toggleMute}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </RippleButton>

        <RippleButton
          className={`vc-btn ${!isCameraOn ? "danger" : ""}`}
          onClick={toggleCamera}
          disabled={callType === "voice" && !isCameraOn}
        >
          {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </RippleButton>

        <RippleButton
          className={`vc-btn ${isScreenSharing ? "active" : ""}`}
          onClick={() => (isScreenSharing ? stopScreenShare() : startScreenShare?.())}
        >
          <Monitor size={20} />
        </RippleButton>

        <RippleButton className="vc-btn danger" onClick={leaveCall}>
          <PhoneOff size={20} />
        </RippleButton>
      </div>
    </motion.div>
  );
}
