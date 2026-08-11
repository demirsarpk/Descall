import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Mic, MicOff, Camera, CameraOff, Monitor, 
  PhoneOff, Users, Settings, Maximize2, Minimize2,
  Volume2, VolumeX, ScreenShare, X
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { useT } from "../../context/LocaleContext";

/**
 * COMPLETELY REBUILT VOICE CALL UI
 * Discord-style voice/video call interface
 * No old layout remnants
 */
export default function VoiceCallUI({ 
  call, 
  peer, 
  me,
  isMuted, 
  isCameraOn, 
  isScreenSharing,
  duration,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
  onMinimize
}) {
  const t = useT();
  const overlayKey = me?.equippedCallOverlay?.effect_key;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [volume, setVolume] = useState(100);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const unknown = t("Unknown");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="voice-call-overlay"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`voice-call-container ${isFullscreen ? "fullscreen" : ""}`}
      >
        {/* Header */}
        <div className="voice-call-header">
          <div className="call-info">
            <div className="call-avatar">
              <Avatar 
                name={peer?.username || unknown} 
                size={48}
                user={peer}
                animate="always"
              />
              <StatusBadge status="online" />
            </div>
            <div className="call-details">
              <h3 className="call-name">{peer?.username || unknown}</h3>
              <span className="call-duration">{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="call-actions">
            <button 
              className="icon-btn"
              onClick={() => setShowParticipants(!showParticipants)}
              title={t("Participants")}
            >
              <Users size={20} />
            </button>
            <button 
              className="icon-btn"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? t("Exit Fullscreen") : t("Fullscreen")}
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button 
              className="icon-btn"
              onClick={onMinimize}
              title={t("Minimize")}
            >
              <Minimize2 size={20} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="voice-call-content">
          {/* Video Area */}
          <div className="video-area">
            {isCameraOn ? (
              <div className="remote-video">
                <video 
                  ref={call?.remoteVideoRef}
                  autoPlay
                  playsInline
                  className="video-element"
                />
              </div>
            ) : (
              <div className="voice-visualization">
                <div className="avatar-large">
                  <Avatar 
                    name={peer?.username || unknown} 
                    size={120}
                    user={peer}
                    animate="always"
                  />
                </div>
                <div className="voice-waves">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="wave"
                      animate={{
                        height: [20, 40, 20],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.1
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Local Video (PiP) */}
            {isCameraOn && (
              <div className="local-video-pip">
                <video 
                  ref={call?.localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="video-element"
                />
              </div>
            )}

            {/* Screen Share */}
            {isScreenSharing && (
              <div className="screen-share-area">
                <video 
                  ref={call?.screenVideoRef}
                  autoPlay
                  playsInline
                  className="video-element"
                />
                <div className="screen-share-badge">
                  <ScreenShare size={16} />
                  <span>{t("Screen Sharing")}</span>
                </div>
              </div>
            )}
          </div>

          {/* Participants Panel */}
          <AnimatePresence>
            {showParticipants && (
              <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                className="participants-panel"
              >
                <div className="participants-header">
                  <h4>{t("Participants")}</h4>
                  <button 
                    className="icon-btn"
                    onClick={() => setShowParticipants(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="participants-list">
                  <div className="participant-item">
                    <Avatar name={peer?.username} size={32} user={peer} />
                    <span>{peer?.username}</span>
                  </div>
                  <div className="participant-item">
                    <Avatar name={t("You")} size={32} animate="always" />
                    <span>{t("You")}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="voice-call-controls">
          <div className="control-group">
            <button 
              className={`control-btn ${isMuted ? "muted" : ""}`}
              onClick={onToggleMute}
              title={isMuted ? t("Unmute") : t("Mute")}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            <button 
              className={`control-btn ${!isCameraOn ? "off" : ""}`}
              onClick={onToggleCamera}
              title={isCameraOn ? t("Turn Off Camera") : t("Turn On Camera")}
            >
              {isCameraOn ? <Camera size={24} /> : <CameraOff size={24} />}
            </button>

            <button 
              className={`control-btn ${isScreenSharing ? "active" : ""}`}
              onClick={onToggleScreenShare}
              title={isScreenSharing ? t("Stop Screen Share") : t("Share Screen")}
            >
              <Monitor size={24} />
            </button>

            <div className="volume-control">
              <button className="icon-btn" onClick={() => setVolume(volume > 0 ? 0 : 100)}>
                {volume > 0 ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="volume-slider"
              />
            </div>
          </div>

          <button 
            className="end-call-btn"
            onClick={onEndCall}
            title={t("End Call")}
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
