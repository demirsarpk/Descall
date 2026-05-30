import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor } from "lucide-react";
import RippleButton from "./ui/RippleButton";

/**
 * Minimal call overlay for DM and group calls
 * Shows incoming, outgoing, and active call states
 */
export default function CallOverlay({ call, groupCall }) {
  const isDmActive = call?.mode !== null && call?.mode !== undefined;
  const isGroupActive = groupCall?.isInCall;

  if (!isDmActive && !isGroupActive) return null;

  // DM Call UI
  if (isDmActive) {
    const { mode, peer, callType, muted, cameraOn, screenSharing, duration } = call;
    const formattedDuration = duration
      ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`
      : "";

    return (
      <AnimatePresence>
        <motion.div
          className="call-overlay"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <div className="call-overlay-content">
            <div className="call-peer-info">
              <span className="call-peer-name">{peer?.username || "User"}</span>
              <span className="call-status">
                {mode === "incoming" && "Incoming call..."}
                {mode === "outgoing" && "Calling..."}
                {mode === "active" && (callType === "video" ? "Video call" : "Voice call")}
              </span>
              {formattedDuration && <span className="call-duration">{formattedDuration}</span>}
            </div>

            <div className="call-actions">
              {mode === "incoming" && (
                <>
                  <RippleButton className="call-btn success" onClick={call.acceptIncoming}>
                    <Phone size={24} />
                  </RippleButton>
                  <RippleButton className="call-btn danger" onClick={call.declineIncoming}>
                    <PhoneOff size={24} />
                  </RippleButton>
                </>
              )}

              {(mode === "outgoing" || mode === "active") && (
                <>
                  <RippleButton className={`call-btn ${muted ? "active" : ""}`} onClick={call.toggleMute}>
                    {muted ? <MicOff size={20} /> : <Mic size={20} />}
                  </RippleButton>
                  {callType === "video" && (
                    <RippleButton className={`call-btn ${cameraOn ? "" : "active"}`} onClick={call.toggleCamera}>
                      {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </RippleButton>
                  )}
                  <RippleButton className={`call-btn ${screenSharing ? "active" : ""}`} onClick={screenSharing ? call.stopScreenShare : call.startScreenShare}>
                    <Monitor size={20} />
                  </RippleButton>
                  <RippleButton className="call-btn danger" onClick={() => call.endCall(peer?.id)}>
                    <PhoneOff size={24} />
                  </RippleButton>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Group Call UI - simplified
  if (isGroupActive) {
    const { participants, callType, isMuted, isCameraOn, isScreenSharing, duration, leaveCall, toggleMute, toggleCamera } = groupCall;
    const formattedDuration = duration
      ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`
      : "";

    return (
      <AnimatePresence>
        <motion.div
          className="call-overlay"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <div className="call-overlay-content">
            <div className="call-peer-info">
              <span className="call-peer-name">Group Call</span>
              <span className="call-status">
                {participants?.length || 0} participants
              </span>
              {formattedDuration && <span className="call-duration">{formattedDuration}</span>}
            </div>

            <div className="call-actions">
              <RippleButton className={`call-btn ${isMuted ? "active" : ""}`} onClick={toggleMute}>
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </RippleButton>
              {callType === "video" && (
                <RippleButton className={`call-btn ${isCameraOn ? "" : "active"}`} onClick={toggleCamera}>
                  {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                </RippleButton>
              )}
              <RippleButton className={`call-btn ${isScreenSharing ? "active" : ""}`} onClick={isScreenSharing ? groupCall.stopScreenShare : groupCall.startScreenShare}>
                <Monitor size={20} />
              </RippleButton>
              <RippleButton className="call-btn danger" onClick={leaveCall}>
                <PhoneOff size={24} />
              </RippleButton>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
