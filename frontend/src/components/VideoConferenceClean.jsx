import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Grid, Maximize2, Users, Minimize2, Volume2, Headphones, ChevronDown, Settings, Sparkles, Activity, Check, X } from "lucide-react";
import RippleButton from "./ui/RippleButton";
import VoiceEffectsPanel from "./VoiceEffectsPanel";
import VideoConferenceMobile from "./VideoConferenceMobile";
import { useT } from "../context/LocaleContext";
import "./styles/VideoConferenceMobile.css";

/**
 * Discord/Google Meet tarzı video conference UI
 * - Grid view: Tüm katılımcılar eşit boyutta
 * - Focus view: Aktif konuşan/ekran paylaşan büyük, diğerleri altta thumbnail
 * - Tıklama ile büyütme/küçültme
 * - Ekran paylaşımı otomatik focus
 */
export default function VideoConference({
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
  dominantSpeaker,
  focusedParticipant,
  setFocusedParticipant,
  duration = 0,
  remoteStreams,
  screenQuality,
  setScreenQuality,
  // Audio device selection props
  audioInputDevices = [],
  audioOutputDevices = [],
  selectedAudioInput = "",
  selectedAudioOutput = "",
  onAudioInputChange = () => {},
  onAudioOutputChange = () => {},
}) {
  const t = useT();
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const remoteStreamMap = remoteStreams?.current instanceof Map ? remoteStreams.current : new Map();
  
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           window.innerWidth < 768;
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // DEBUG: Log participants data
  console.log("[VideoConference] Participants raw:", JSON.stringify(safeParticipants, null, 2));
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "focus"
  const [showControls, setShowControls] = useState(true);
  const [fullscreenParticipant, setFullscreenParticipant] = useState(null); // null | 'local' | userId
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showVoiceEffects, setShowVoiceEffects] = useState(false);
  const [showScreenQuality, setShowScreenQuality] = useState(false);
  const [localAudioInputs, setLocalAudioInputs] = useState([]);
  const [localAudioOutputs, setLocalAudioOutputs] = useState([]);
  const [focusTarget, setFocusTarget] = useState(null);
  const screenQualityRef = useRef(null);

  // Stable refs for video elements - prevents flickering
  const videoElementRefs = useRef(new Map());
  const screenVideoElementRefs = useRef(new Map());
  const streamAssignments = useRef(new Map());
  const screenStreamAssignments = useRef(new Map());

  // Auto-hide controls timer
  useEffect(() => {
    if (!showControls) return;
    
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [showControls]);

  // Stable screen stream handling - prevents flickering
  // Use Map for multiple participant screen shares
  const screenVideoRefs = useRef(new Map());
  
  // Cleanup refs when unmounting
  useEffect(() => {
    return () => {
      screenVideoRefs.current.forEach((video, id) => {
        if (video) {
          video.srcObject = null;
        }
      });
      screenVideoRefs.current.clear();
    };
  }, []);

  // Manual stream assignment function - async with proper sequencing
  const assignStreamToVideo = useCallback(async (participantId, stream) => {
    const video = videoElementRefs.current.get(participantId);
    if (video && video.srcObject !== stream) {
      console.log(`[VideoConference] Assigning stream to ${participantId}`);
      
      // Stop current playback to prevent race condition
      if (video.srcObject) {
        video.pause();
        video.currentTime = 0;
      }
      
      // Assign new stream
      video.srcObject = stream;
      streamAssignments.current.set(participantId, stream);
      
      // Wait for stream to be ready before playing
      if (stream) {
        try {
          await video.play();
        } catch (error) {
          console.warn(`[VideoConference] Failed to play video for ${participantId}:`, error);
        }
      }
    }
  }, []);
  
  // Manual screen stream assignment function - async with proper sequencing
  const assignScreenStreamToVideo = useCallback(async (participantId, screenStream) => {
    const video = screenVideoElementRefs.current.get(participantId);
    if (video && video.srcObject !== screenStream) {
      console.log(`[VideoConference] Assigning screen stream to ${participantId}`);
      
      // Stop current playback to prevent race condition
      if (video.srcObject) {
        video.pause();
        video.currentTime = 0;
      }
      
      // Assign new stream
      video.srcObject = screenStream;
      screenStreamAssignments.current.set(participantId, screenStream);
      
      // Wait for stream to be ready before playing
      if (screenStream) {
        try {
          await video.play();
        } catch (error) {
          console.warn(`[VideoConference] Failed to play screen video for ${participantId}:`, error);
        }
      }
    }
  }, []);

  // Cleanup participant when they leave
  const cleanupParticipant = useCallback((participantId) => {
    const video = videoElementRefs.current.get(participantId);
    if (video) {
      video.srcObject = null;
      videoElementRefs.current.delete(participantId);
    }
    streamAssignments.current.delete(participantId);
    
    const screenVideo = screenVideoElementRefs.current.get(participantId);
    if (screenVideo) {
      screenVideo.srcObject = null;
      screenVideoElementRefs.current.delete(participantId);
    }
    screenStreamAssignments.current.delete(participantId);
  }, []);

  // Update streams for existing participants - await all assignments
  useEffect(() => {
    const updateStreams = async () => {
      // Get active participants with streams
      const activeParticipants = safeParticipants.filter(p => 
        remoteStreamMap.has(p.id) || p.screenStream
      );
      
      console.log('[VideoConference] Active participants:', activeParticipants.length);
      
      // Process each participant
      const streamPromises = activeParticipants.map(async (p) => {
        const stream = remoteStreamMap.get(p.id);
        await assignStreamToVideo(p.id, stream);
        
        if (p.screenStream && p.isScreenSharing) {
          await assignScreenStreamToVideo(p.id, p.screenStream);
        } else {
          await assignScreenStreamToVideo(p.id, null);
        }
      });
      
      // Handle local screen sharing preview
      if (screenStream && isScreenSharing) {
        await assignScreenStreamToVideo('local', screenStream);
        await assignScreenStreamToVideo('preview', screenStream);
        await assignScreenStreamToVideo('pip-local', screenStream);
      } else {
        await assignScreenStreamToVideo('local', null);
        await assignScreenStreamToVideo('preview', null);
        await assignScreenStreamToVideo('pip-local', null);
      }
      
      // Wait for all stream assignments to complete
      await Promise.allSettled(streamPromises);
    };
    
    updateStreams().catch(error => {
      console.error('[VideoConference] Error updating streams:', error);
    });
  }, [safeParticipants, remoteStreamMap, screenStream, isScreenSharing, assignStreamToVideo, assignScreenStreamToVideo, cleanupParticipant]);

  // Screen sharing quality handlers
  const handleStartScreenShare = useCallback(async () => {
    if (startScreenShare) {
      await startScreenShare(screenQuality);
    }
  }, [startScreenShare, screenQuality]);

  const [applyingSettings, setApplyingSettings] = useState(false);
  const [settingsApplied, setSettingsApplied] = useState(false);
  const [currentOperation, setCurrentOperation] = useState(null);
  const timersRef = useRef([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  const handleResolutionChange = useCallback(async (resolution) => {
    // Prevent concurrent operations
    if (currentOperation || !setScreenQuality) return;
    setCurrentOperation('resolution');
    
    try {
      setApplyingSettings(true);
      setSettingsApplied(false);
      
      setScreenQuality(prev => ({ ...prev, resolution }));
      
      // Show feedback animation with proper cleanup
      const feedbackTimer1 = setTimeout(() => {
        setSettingsApplied(true);
        const feedbackTimer2 = setTimeout(() => setSettingsApplied(false), 2000);
        timersRef.current.push(feedbackTimer2);
      }, 300);
      timersRef.current.push(feedbackTimer1);
      
      // If already screen sharing, restart with new quality
      if (isScreenSharing && stopScreenShare && startScreenShare) {
        console.log('[VideoConference] Restarting screen share with new resolution:', resolution);
        await stopScreenShare();
        // Small delay to ensure cleanup
        const restartTimer = setTimeout(() => startScreenShare({ resolution, fps: screenQuality.fps }), 100);
        timersRef.current.push(restartTimer);
      }
      
      const clearTimer = setTimeout(() => setApplyingSettings(false), 500);
      timersRef.current.push(clearTimer);
    } catch (error) {
      console.error('[VideoConference] Error changing resolution:', error);
      setApplyingSettings(false);
    } finally {
      setTimeout(() => setCurrentOperation(null), 600);
    }
  }, [currentOperation, setScreenQuality, isScreenSharing, stopScreenShare, startScreenShare, screenQuality]);

  const handleFpsChange = useCallback(async (fps) => {
    // Prevent concurrent operations
    if (currentOperation || !setScreenQuality) return;
    setCurrentOperation('fps');
    
    try {
      setApplyingSettings(true);
      setSettingsApplied(false);
      
      setScreenQuality(prev => ({ ...prev, fps }));
      
      // Show feedback animation with proper cleanup
      const feedbackTimer1 = setTimeout(() => {
        setSettingsApplied(true);
        const feedbackTimer2 = setTimeout(() => setSettingsApplied(false), 2000);
        timersRef.current.push(feedbackTimer2);
      }, 300);
      timersRef.current.push(feedbackTimer1);
      
      // If already screen sharing, restart with new quality
      if (isScreenSharing && stopScreenShare && startScreenShare) {
        console.log('[VideoConference] Restarting screen share with new FPS:', fps);
        await stopScreenShare();
        // Small delay to ensure cleanup
        const restartTimer = setTimeout(() => startScreenShare({ resolution: screenQuality.resolution, fps }), 100);
        timersRef.current.push(restartTimer);
      }
      
      const clearTimer = setTimeout(() => setApplyingSettings(false), 500);
      timersRef.current.push(clearTimer);
    } catch (error) {
      console.error('[VideoConference] Error changing FPS:', error);
      setApplyingSettings(false);
    } finally {
      setTimeout(() => setCurrentOperation(null), 600);
    }
  }, [currentOperation, setScreenQuality, isScreenSharing, stopScreenShare, startScreenShare, screenQuality]);

  // Enumerate audio devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setLocalAudioInputs(inputs);
        setLocalAudioOutputs(outputs);
      } catch (err) {
        console.error("[VideoConference] Failed to enumerate devices:", err);
      }
    };
    
    getDevices();
  }, []);

  // Grid layout calculation
  const getGridCols = (count) => {
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4; // Max 16 (4x4) for 15 people limit
  };

  const getGridRows = (count, cols) => Math.ceil(count / cols);

  // Calculate grid layout
  const totalParticipants = safeParticipants.length + 1; // +1 for local
  const gridCols = getGridCols(totalParticipants);
  const gridRows = getGridRows(totalParticipants, gridCols);

  // Focus view calculations
  const activeParticipants = safeParticipants.filter(p => 
    remoteStreamMap.has(p.id) || p.screenStream
  );
  
  const computedFocusTarget = dominantSpeaker?.id || 
    (activeParticipants.length > 0 ? activeParticipants[0]?.id : 'local');
  const effectiveFocusTarget = focusTarget || computedFocusTarget;

  const focusParticipant = safeParticipants.find((p) => p.id === effectiveFocusTarget);
  const focusStream = effectiveFocusTarget ? remoteStreamMap.get(effectiveFocusTarget) : null;

  // Thumbnail participants (focus view)
  const thumbnailParticipants = viewMode === "focus"
    ? (activeParticipants || []).filter(p => p.id !== effectiveFocusTarget)
    : [];

  // Return mobile interface for mobile devices, desktop for others
  if (isMobile) {
    return (
      <VideoConferenceMobile
        isOpen={isOpen}
        onClose={onClose}
        minimized={minimized}
        onMinimize={onMinimize}
        call={call}
        participants={participants}
        localStream={localStream}
        screenStream={screenStream}
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        startScreenShare={startScreenShare}
        stopScreenShare={stopScreenShare}
        leaveCall={leaveCall}
        callType={callType}
        screenQuality={screenQuality}
        setScreenQuality={setScreenQuality}
        onProcessedStream={(stream) => {
          // Handle processed stream for mobile
        }}
      />
    );
  }

  // Desktop interface
  return (
    <motion.div
      className={`video-conference ${minimized ? 'minimized' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <motion.div 
        className={`vc-header ${showControls ? 'visible' : ''}`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: showControls ? 0 : -20, opacity: showControls ? 1 : 0 }}
      >
        <div className="vc-title">
          <Users size={18} />
          <span>{t("{count} participants", { count: safeParticipants.length + 1 })}</span>
        </div>
        <div className="vc-view-toggle">
          <button
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setViewMode("grid")}
          >
            <Grid size={18} />
          </button>
          <button
            className={viewMode === "focus" ? "active" : ""}
            onClick={() => setViewMode("focus")}
          >
            <Maximize2 size={18} />
          </button>
          {onMinimize && (
            <button onClick={onMinimize} title={t("Minimize")}>
              <Minimize2 size={18} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Main Video Area */}
      <div className={`vc-main ${viewMode}`}>
        {viewMode === "grid" ? (
          // Grid View
          <div 
            className="vc-grid"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            }}
          >
            {/* Local Video */}
            <div 
              className={`vc-video-cell ${focusedParticipant === 'local' ? 'focused' : ''}`}
              onClick={() => setFocusedParticipant('local')}
            >
              {isCameraOn ? (
                <video
                  ref={(el) => {
                    if (el && localStream) el.srcObject = localStream;
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="vc-video"
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              ) : (
                <div className="vc-avatar-placeholder">
                  <span>{t("You")}</span>
                </div>
              )}
              <div className="vc-video-badge">
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </div>
            </div>

            {/* Participant Videos */}
            {safeParticipants.map((participant) => {
              const stream = remoteStreamMap.get(participant.id);
              const hasScreenShare = screenStream && participant.isScreenSharing;
              
              return (
                <div 
                  key={participant.id}
                  className={`vc-video-cell ${focusedParticipant === participant.id ? 'focused' : ''} ${hasScreenShare ? 'has-screen-share' : ''}`}
                  onClick={() => setFocusedParticipant(participant.id)}
                >
                  {hasScreenShare && <div className="vc-screen-indicator">{t("Screen")}</div>}
                  
                  {stream && (p.hasVideo || p.isScreenSharing) ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoElementRefs.current.set(participant.id, el);
                          const currentStream = streamAssignments.current.get(participant.id);
                          if (currentStream && el.srcObject !== currentStream) {
                            el.srcObject = currentStream;
                          }
                        } else {
                          videoElementRefs.current.delete(participant.id);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="vc-video"
                      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div className="vc-avatar-placeholder">
                      <span>{participant.username?.[0] || 'U'}</span>
                    </div>
                  )}
                  
                  <div className="vc-video-info">
                    <span>{participant.username || t("User")}</span>
                    {hasScreenShare && <Monitor size={14} />}
                  </div>
                  
                  <div className="vc-video-badge">
                    {/* Muted indicator would go here */}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Focus View
          <>
            {/* Main Focus Video */}
            <div className="vc-focus-main">
              {effectiveFocusTarget === 'local' ? (
                isScreenSharing ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        screenVideoElementRefs.current.set('local', el);
                        const currentStream = screenStreamAssignments.current.get('local');
                        if (currentStream && el.srcObject !== currentStream) {
                          el.srcObject = currentStream;
                        }
                      } else {
                        screenVideoElementRefs.current.delete('local');
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="vc-video"
                  />
                ) : isCameraOn ? (
                  <video
                    ref={(el) => {
                      if (el && localStream) el.srcObject = localStream;
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="vc-video"
                  />
                ) : (
                  <div className="vc-avatar-placeholder large">
                    <span>{t("You")}</span>
                  </div>
                )
              ) : focusParticipant ? (
                <div className="vc-focus-participant">
                  {focusParticipant.screenStream && focusParticipant.isScreenSharing ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          screenVideoElementRefs.current.set(focusParticipant.id, el);
                          const currentStream = screenStreamAssignments.current.get(focusParticipant.id);
                          if (currentStream && el.srcObject !== currentStream) {
                            el.srcObject = currentStream;
                          }
                        } else {
                          screenVideoElementRefs.current.delete(focusParticipant.id);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="vc-video"
                    />
                  ) : focusStream ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoElementRefs.current.set(focusParticipant.id, el);
                          const currentStream = streamAssignments.current.get(focusParticipant.id);
                          if (currentStream && el.srcObject !== currentStream) {
                            el.srcObject = currentStream;
                          }
                        } else {
                          videoElementRefs.current.delete(focusParticipant.id);
                        }
                      }}
                      autoPlay
                      playsInline
                      className="vc-video"
                    />
                  ) : (
                    <div className="vc-avatar-placeholder large">
                      <span>{focusParticipant.username?.[0] || 'U'}</span>
                    </div>
                  )}
                  <div className="vc-focus-info">
                    <span>{focusParticipant.username || t("User")}</span>
                    {focusParticipant.isScreenSharing && <Monitor size={16} />}
                  </div>
                </div>
              ) : (
                <div className="vc-avatar-placeholder large">
                  <span>{t("No participant")}</span>
                </div>
              )}
              
              {(focusTarget === 'local' ? isScreenSharing : focusParticipant?.isScreenSharing) && (
                <div className="vc-focus-screen-badge">
                  <Monitor size={16} />
                  <span>{t("Screen Sharing")}</span>
                </div>
              )}
            </div>

            {/* Thumbnail Row */}
            <div className="vc-focus-thumbnails">
              {/* Local thumbnail if not focus */}
              {effectiveFocusTarget !== 'local' && (
                <div 
                  className={`vc-thumbnail ${focusedParticipant === 'local' ? 'focused' : ''}`}
                  onClick={() => setFocusTarget('local')}
                >
                  {isCameraOn ? (
                    <video
                      ref={(el) => {
                        if (el && localStream) el.srcObject = localStream;
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="vc-thumbnail-video"
                    />
                  ) : (
                    <div className="vc-thumbnail-avatar">
                      <span>{t("You")}</span>
                    </div>
                  )}
                  <div className="vc-thumbnail-label">{t("You")}</div>
                </div>
              )}

              {/* Other participants thumbnails */}
              {thumbnailParticipants.map((participant) => {
                const stream = remoteStreamMap.get(participant.id);
                return (
                  <div 
                    key={participant.id}
                    className={`vc-thumbnail ${focusedParticipant === participant.id ? 'focused' : ''}`}
                    onClick={() => setFocusTarget(participant.id)}
                  >
                    {stream ? (
                      <video
                        ref={(el) => {
                          if (el) {
                            videoElementRefs.current.set(participant.id, el);
                            const currentStream = streamAssignments.current.get(participant.id);
                            if (currentStream && el.srcObject !== currentStream) {
                              el.srcObject = currentStream;
                            }
                          } else {
                            videoElementRefs.current.delete(participant.id);
                          }
                        }}
                        autoPlay
                        playsInline
                        className="vc-thumbnail-video"
                      />
                    ) : (
                      <div className="vc-thumbnail-avatar">
                        <span>{participant.username?.[0] || 'U'}</span>
                      </div>
                    )}
                    <div className="vc-thumbnail-label">
                      {participant.username || t("User")}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <motion.div 
        className={`vc-controls ${showControls ? 'visible' : ''}`}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: showControls ? 0 : 20, opacity: showControls ? 1 : 0 }}
      >
        <div className="vc-controls-left">
          <RippleButton
            className={`vc-btn ${isMuted ? 'danger' : ''}`}
            onClick={toggleMute}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </RippleButton>
          
          <RippleButton
            className={`vc-btn ${!isCameraOn ? 'danger' : ''}`}
            onClick={toggleCamera}
            disabled={callType === "voice" && !isCameraOn}
          >
            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </RippleButton>
          
          {/* Voice Effects Button */}
          <RippleButton
            className={`vc-btn ${showVoiceEffects ? 'active' : ''}`}
            onClick={() => setShowVoiceEffects(!showVoiceEffects)}
            title={t("Voice Effects")}
          >
            <Sparkles size={20} />
          </RippleButton>
          
          <RippleButton
            className={`vc-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={() => isScreenSharing ? stopScreenShare() : handleStartScreenShare()}
            title={isScreenSharing ? t("Stop screen sharing") : t("Start screen sharing")}
          >
            <Monitor size={20} />
          </RippleButton>
          
          {!isScreenSharing && (
            <button
              className="quality-toggle-btn"
              onClick={() => setShowScreenQuality(!showScreenQuality)}
              title={t("Screen quality settings")}
            >
              <Settings size={14} />
            </button>
          )}
        </div>

        <div className="vc-controls-center">
          {duration > 0 && (
            <span className="vc-duration">
              {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>

        <div className="vc-controls-right">
          <RippleButton
            className="vc-btn danger"
            onClick={leaveCall}
          >
            <PhoneOff size={20} />
          </RippleButton>
        </div>
      </motion.div>

      {/* Screen Quality Settings Panel */}
      <AnimatePresence>
        {showScreenQuality && !isScreenSharing && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="screen-quality-panel advanced"
            ref={screenQualityRef}
          >
            <div className="quality-header">
              <Monitor size={18} />
              <span>{t("Advanced Screen Settings")}</span>
              <button 
                className="quality-close-btn"
                onClick={() => setShowScreenQuality(false)}
              >
                <X size={14} />
              </button>
            </div>
            
            {/* Screen Preview */}
            <div className="quality-section">
              <label className="quality-label">
                <Monitor size={16} />
                {t("Screen Preview")}
                <span className="quality-description">{t("Your shared screen will appear here")}</span>
              </label>
              <div className="screen-preview-container">
                {isScreenSharing && screenStream ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        screenVideoElementRefs.current.set('preview', el);
                        const currentStream = screenStreamAssignments.current.get('preview');
                        if (currentStream && el.srcObject !== currentStream) {
                          el.srcObject = currentStream;
                        }
                      } else {
                        screenVideoElementRefs.current.delete('preview');
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="screen-preview-video"
                  />
                ) : (
                  <div className="screen-preview-placeholder">
                    <Monitor size={32} />
                    <span>{t("Start screen sharing to see preview")}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Resolution Selector */}
            <div className="quality-section">
              <label className="quality-label">
                <Maximize2 size={16} />
                {t("Resolution")}
                <span className="quality-description">{t("Select display resolution")}</span>
              </label>
              <div className="quality-options-grid">
                {[
                  { value: '480p', label: t('480p'), desc: '854×480', icon: '📱' },
                  { value: '720p', label: t('720p HD'), desc: '1280×720', icon: '🎥' },
                  { value: '1080p', label: t('1080p FHD'), desc: '1920×1080', icon: '📺' },
                  { value: '1440p', label: t('1440p QHD'), desc: '2560×1440', icon: '🖥️' },
                  { value: '2160p', label: t('2160p 4K'), desc: '3840×2160', icon: '🎬' },
                  { value: 'custom', label: t('Custom'), desc: t('Custom size'), icon: '⚙️' }
                ].map((res) => (
                  <button
                    key={res.value}
                    className={`quality-option-card ${screenQuality?.resolution === res.value ? 'active' : ''} ${applyingSettings ? 'applying' : ''} ${settingsApplied && screenQuality?.resolution === res.value ? 'applied' : ''}`}
                    onClick={() => handleResolutionChange(res.value)}
                    disabled={applyingSettings}
                  >
                    <div className="quality-option-icon">{res.icon}</div>
                    <div className="quality-option-content">
                      <div className="quality-option-label">{res.label}</div>
                      <div className="quality-option-desc">{res.desc}</div>
                    </div>
                    {screenQuality?.resolution === res.value && <Check size={16} />}
                    {applyingSettings && screenQuality?.resolution === res.value && (
                      <div className="quality-spinner">
                        <div className="spinner-dot"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* FPS Selector */}
            <div className="quality-section">
              <label className="quality-label">
                <Activity size={16} />
                {t("Frame Rate (FPS)")}
                <span className="quality-description">{t("Select frame rate for smoothness")}</span>
              </label>
              <div className="quality-options-grid">
                {[
                  { value: 15, label: t('15 FPS'), desc: t('Low bandwidth'), icon: '🐌' },
                  { value: 24, label: t('24 FPS'), desc: t('Cinema standard'), icon: '🎬' },
                  { value: 30, label: t('30 FPS'), desc: t('Standard smooth'), icon: '📹' },
                  { value: 60, label: t('60 FPS'), desc: t('High quality'), icon: '🎮' },
                  { value: 120, label: t('120 FPS'), desc: t('Ultra smooth'), icon: '⚡' },
                  { value: 144, label: t('144 FPS'), desc: t('Gaming grade'), icon: '🚀' }
                ].map((fps) => (
                  <button
                    key={fps.value}
                    className={`quality-option-card ${screenQuality?.fps === fps.value ? 'active' : ''} ${applyingSettings ? 'applying' : ''} ${settingsApplied && screenQuality?.fps === fps.value ? 'applied' : ''}`}
                    onClick={() => handleFpsChange(fps.value)}
                    disabled={applyingSettings}
                  >
                    <div className="quality-option-icon">{fps.icon}</div>
                    <div className="quality-option-content">
                      <div className="quality-option-label">{fps.label}</div>
                      <div className="quality-option-desc">{fps.desc}</div>
                    </div>
                    {screenQuality?.fps === fps.value && <Check size={16} />}
                    {applyingSettings && screenQuality?.fps === fps.value && (
                      <div className="quality-spinner">
                        <div className="spinner-dot"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Additional Settings */}
            <div className="quality-section">
              <label className="quality-label">
                <Settings size={16} />
                {t("Additional Settings")}
                <span className="quality-description">{t("Optimize your sharing experience")}</span>
              </label>
              <div className="quality-toggles">
                <div className="quality-toggle-item">
                  <label className="toggle-label">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                    <span className="toggle-text">{t("Show cursor")}</span>
                  </label>
                </div>
                <div className="quality-toggle-item">
                  <label className="toggle-label">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                    <span className="toggle-text">{t("Optimize for motion")}</span>
                  </label>
                </div>
                <div className="quality-toggle-item">
                  <label className="toggle-label">
                    <input type="checkbox" />
                    <span className="toggle-slider"></span>
                    <span className="toggle-text">{t("Hardware acceleration")}</span>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Performance Stats */}
            <div className="quality-section">
              <label className="quality-label">
                <Activity size={16} />
                {t("Performance Impact")}
                <span className="quality-description">{t("Estimated resource usage")}</span>
              </label>
              <div className="quality-stats">
                <div className="quality-stat">
                  <span>{t("Bandwidth")}</span>
                  <span className="stat-value medium">5-15 Mbps</span>
                </div>
                <div className="quality-stat">
                  <span>{t("CPU Usage")}</span>
                  <span className="stat-value low">{t("Low")}</span>
                </div>
                <div className="quality-stat">
                  <span>{t("Quality")}</span>
                  <span className="stat-value high">{t("High")}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Effects Panel */}
      <AnimatePresence>
        {showVoiceEffects && (
          <VoiceEffectsPanel
            isOpen={showVoiceEffects}
            onClose={() => setShowVoiceEffects(false)}
            localStream={localStream}
            onProcessedStream={(stream) => {
              console.log('Voice effects stream processed');
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
