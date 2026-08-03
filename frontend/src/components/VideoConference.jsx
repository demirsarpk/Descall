import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Grid, Maximize2, Users, Minimize2, Settings, Sparkles, Activity, Check, X } from "lucide-react";
import RippleButton from "./ui/RippleButton";
import VoiceEffectsPanel from "./VoiceEffectsPanel";
import { useT } from "../context/LocaleContext";
// VideoConferenceMobile component was removed - using responsive design instead

/**
 * Modern Video Conference UI
 * - Grid view: All participants equal size
 * - Focus view: Active speaker/screen share large, others thumbnails
 * - Minimize support via floating PiP button
 * - Screen share quality settings
 * - Audio device selection
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
  focusedParticipant,
  setFocusedParticipant,
  dominantSpeaker,
  duration = 0,
  remoteStreams,
  screenQuality,
  setScreenQuality,
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
 

  const [viewMode, setViewMode] = useState("grid");
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showVoiceEffects, setShowVoiceEffects] = useState(false);
  const [showScreenQuality, setShowScreenQuality] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
  const screenQualityRef = useRef(null);

  const videoElementRefs = useRef(new Map());
  const screenVideoElementRefs = useRef(new Map());
  const streamAssignments = useRef(new Map());
  const screenStreamAssignments = useRef(new Map());

  // Stale refs cleanup on unmount
  useEffect(() => {
    return () => {
      [videoElementRefs, screenVideoElementRefs].forEach(refMap => {
        refMap.current.forEach((video) => { if (video) video.srcObject = null; });
        refMap.current.clear();
      });
    };
  }, []);

  const assignStreamToVideo = useCallback(async (participantId, stream) => {
    const video = videoElementRefs.current.get(participantId);
    if (video && video.srcObject !== stream) {
      if (video.srcObject) { video.pause(); video.currentTime = 0; }
      video.srcObject = stream;
      streamAssignments.current.set(participantId, stream);
      if (stream) {
        try { await video.play(); } catch (e) { console.warn(`[VC] Video play error ${participantId}:`, e); }
      }
    }
  }, []);

  const assignScreenStreamToVideo = useCallback(async (pid, s) => {
    const video = screenVideoElementRefs.current.get(pid);
    if (video && video.srcObject !== s) {
      if (video.srcObject) { video.pause(); video.currentTime = 0; }
      video.srcObject = s;
      screenStreamAssignments.current.set(pid, s);
      if (s) { try { await video.play(); } catch (e) { console.warn(`[VC] Screen play error ${pid}:`, e); } }
    }
  }, []);

  // Stream update effect with flicker prevention
  useEffect(() => {
    const update = async () => {
      const changed = safeParticipants.filter(p => streamAssignments.current.get(p.id) !== remoteStreamMap.get(p.id));
      if (changed.length === 0 && !screenStream) return;
      await Promise.allSettled(changed.map(p => assignStreamToVideo(p.id, remoteStreamMap.get(p.id))));
      const curr = screenStreamAssignments.current.get('local');
      if (screenStream && isScreenSharing && curr !== screenStream) {
        await assignScreenStreamToVideo('local', screenStream);
        await assignScreenStreamToVideo('preview', screenStream);
      } else if (!screenStream && curr) {
        await assignScreenStreamToVideo('local', null);
        await assignScreenStreamToVideo('preview', null);
      }
    };
    update().catch(e => console.error('[VC] Stream update error:', e));
  }, [safeParticipants, remoteStreamMap, screenStream, isScreenSharing, assignStreamToVideo, assignScreenStreamToVideo]);

  // Screen quality handlers
  const handleStartScreenShare = useCallback(async () => {
    if (startScreenShare) await startScreenShare(screenQuality);
  }, [startScreenShare, screenQuality]);

  const [applyingSettings, setApplyingSettings] = useState(false);
  const [settingsApplied, setSettingsApplied] = useState(false);
  const [currentOp, setCurrentOp] = useState(null);
  const timersRef = useRef([]);

  useEffect(() => () => { timersRef.current.forEach(t => clearTimeout(t)); timersRef.current = []; }, []);

  const handleResolutionChange = useCallback(async (resolution) => {
    if (currentOp || !setScreenQuality) return;
    setCurrentOp('resolution');
    setApplyingSettings(true);
    setSettingsApplied(false);
    setScreenQuality(prev => ({ ...prev, resolution }));
    const t1 = setTimeout(() => { setSettingsApplied(true); timersRef.current.push(setTimeout(() => setSettingsApplied(false), 2000)); }, 300);
    timersRef.current.push(t1);
    if (isScreenSharing && stopScreenShare && startScreenShare) {
      await stopScreenShare();
      await new Promise(r => setTimeout(r, 300));
      await startScreenShare({ resolution, fps: screenQuality.fps });
    }
    timersRef.current.push(setTimeout(() => setApplyingSettings(false), 500));
    setTimeout(() => setCurrentOp(null), 600);
  }, [currentOp, setScreenQuality, isScreenSharing, stopScreenShare, startScreenShare, screenQuality]);

  const handleFpsChange = useCallback(async (fps) => {
    if (currentOp || !setScreenQuality) return;
    setCurrentOp('fps');
    setApplyingSettings(true);
    setSettingsApplied(false);
    setScreenQuality(prev => ({ ...prev, fps }));
    const t1 = setTimeout(() => { setSettingsApplied(true); timersRef.current.push(setTimeout(() => setSettingsApplied(false), 2000)); }, 300);
    timersRef.current.push(t1);
    if (isScreenSharing && stopScreenShare && startScreenShare) {
      await stopScreenShare();
      await new Promise(r => setTimeout(r, 300));
      await startScreenShare({ resolution: screenQuality.resolution, fps });
    }
    timersRef.current.push(setTimeout(() => setApplyingSettings(false), 500));
    setTimeout(() => setCurrentOp(null), 600);
  }, [currentOp, setScreenQuality, isScreenSharing, stopScreenShare, startScreenShare, screenQuality]);

  // Grid layout
  const gridCols = useMemo(() => {
    const c = safeParticipants.length + 1;
    if (c <= 1) return 1;
    if (c <= 4) return 2;
    if (c <= 9) return 3;
    return 4;
  }, [safeParticipants.length]);

  // Focus view calculations
  const calculatedFocusTarget = dominantSpeaker?.id || (safeParticipants.length > 0 ? safeParticipants[0]?.id : 'local');
  useEffect(() => {
    if (calculatedFocusTarget !== focusTarget) setFocusTarget(calculatedFocusTarget);
  }, [calculatedFocusTarget, focusTarget]);

  const focusParticipant = safeParticipants.find(p => p.id === focusTarget);
  const focusStream = focusTarget ? remoteStreamMap.get(focusTarget) : null;

  const thumbnailParticipants = viewMode === "focus" ? safeParticipants.filter(p => p.id !== focusTarget) : [];

  if (!isOpen) return null;

  // Minimized floating PiP mode
  if (minimized) {
    return (
      <motion.div
        className="video-conference-minimized"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={onMinimize}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 240,
          height: 160,
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          zIndex: 10000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {isScreenSharing ? (
          <video
            ref={el => { if (el && screenStream) el.srcObject = screenStream; }}
            autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : isCameraOn && localStream ? (
          <video
            ref={el => { if (el && localStream) el.srcObject = localStream; }}
            autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Users size={48} />
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 8, fontSize: 12, color: '#fff'
        }}>
          <span>{t("{count} participants", { count: safeParticipants.length + 1 })}</span>
          {duration > 0 && <span>{Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); leaveCall?.(); }}
          style={{
            position: 'absolute', top: 6, right: 6, width: 28, height: 28,
            borderRadius: '50%', border: 'none', background: 'rgba(242,63,67,0.9)',
            color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="video-conference"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw',
        height: '100vh', zIndex: 1000, backgroundColor: '#0f0f0f', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="vc-header" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', background: 'rgba(0,0,0,0.3)', zIndex: 10,
      }}>
        <div className="vc-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
          <Users size={18} />
          <span>{t("{count} participants", { count: safeParticipants.length + 1 })}</span>
        </div>
        <div className="vc-view-toggle" style={{ display: 'flex', gap: 8 }}>
          <button className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}
            style={{ background: viewMode === "grid" ? 'rgba(255,255,255,0.2)' : 'transparent', border: 'none', color: '#fff', padding: 6, borderRadius: 6, cursor: 'pointer' }}>
            <Grid size={18} />
          </button>
          <button className={viewMode === "focus" ? "active" : ""} onClick={() => setViewMode("focus")}
            style={{ background: viewMode === "focus" ? 'rgba(255,255,255,0.2)' : 'transparent', border: 'none', color: '#fff', padding: 6, borderRadius: 6, cursor: 'pointer' }}>
            <Maximize2 size={18} />
          </button>
          {onMinimize && (
            <button onClick={onMinimize} title={t("Minimize")}
              style={{ 
                background: 'rgba(255, 255, 255, 0.1)', 
                border: '1px solid rgba(255, 255, 255, 0.2)', 
                color: '#fff', 
                padding: 6, 
                borderRadius: 6, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                zIndex: 20
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}>
              <Minimize2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Video Area */}
      <div className={`vc-main ${viewMode}`} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {viewMode === "grid" ? (
          <div className="vc-grid" style={{
            display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: 4, padding: 4, height: '100%',
          }}>
            {/* Local */}
            <div className="vc-video-cell" style={{ position: 'relative', background: '#1a1a2e', borderRadius: 8, overflow: 'hidden', minHeight: 120 }}>
              {isCameraOn && localStream ? (
                <video ref={el => { if (el) el.srcObject = localStream; }}
                  autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <span>{t("You")}</span>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '2px 6px', color: '#fff', fontSize: 11 }}>
                {isMuted ? <MicOff size={12} /> : <Mic size={12} />} {t("You")}
              </div>
            </div>

            {/* Participants */}
            {safeParticipants.map(p => {
              const stream = remoteStreamMap.get(p.id);
              const hasVideo = p.hasVideo || p.isScreenSharing || false;
              return (
                <div key={p.id} className="vc-video-cell" style={{ position: 'relative', background: '#1a1a2e', borderRadius: 8, overflow: 'hidden', minHeight: 120 }}>
                  {stream && hasVideo ? (
                    <video ref={el => { if (el) { videoElementRefs.current.set(p.id, el); const s = streamAssignments.current.get(p.id); if (s && el.srcObject !== s) el.srcObject = s; } }}
                      autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <span>{p.username?.[0] || 'U'}</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '2px 6px', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {p.isScreenSharing && <Monitor size={12} />}
                    {p.username || t("User")}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {/* Focus Main */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 100, background: '#1a1a2e' }}>
              {focusTarget === 'local' ? (
                isScreenSharing ? (
                  <video ref={el => { if (el) screenVideoElementRefs.current.set('local', el); }}
                    autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : isCameraOn && localStream ? (
                  <video ref={el => { if (el && el.srcObject !== localStream) el.srcObject = localStream; el?.play()?.catch(() => {}); }}
                    autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <span>{t("You")}</span>
                  </div>
                )
              ) : focusParticipant ? (
                <div style={{ width: '100%', height: '100%' }}>
                  {focusParticipant.isScreenSharing ? (
                    <video ref={el => { if (el) screenVideoElementRefs.current.set('focus-screen', el); }}
                      autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : focusStream ? (
                    <video ref={el => { if (el) { videoElementRefs.current.set(focusParticipant.id, el); const s = streamAssignments.current.get(focusParticipant.id); if (s && el.srcObject !== s) el.srcObject = s; } }}
                      autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <span>{focusParticipant.username?.[0] || 'U'}</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '4px 10px', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {focusParticipant.isScreenSharing && <Monitor size={14} />}
                    {focusParticipant.username || t("User")}
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <span>{t("No participant")}</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, display: 'flex', gap: 8, padding: 8, overflowX: 'auto', background: 'rgba(0,0,0,0.4)' }}>
              {focusTarget !== 'local' && (
                <div onClick={() => setFocusTarget('local')} style={{ flex: '0 0 120px', height: '100%', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative', background: '#1a1a2e' }}>
                  {isScreenSharing ? (
                    <video ref={el => { if (el) screenVideoElementRefs.current.set('thumb-local', el); }}
                      autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : isCameraOn && localStream ? (
                    <video ref={el => { if (el && el.srcObject !== localStream) el.srcObject = localStream; }}
                      autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>{t("You")}</div>
                  )}
                  <div style={{ position: 'absolute', bottom: 2, left: 4, color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: 4 }}>{t("You")}</div>
                </div>
              )}
              {thumbnailParticipants.map(p => (
                <div key={p.id} onClick={() => setFocusTarget(p.id)} style={{ flex: '0 0 120px', height: '100%', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative', background: '#1a1a2e' }}>
                  {remoteStreamMap.get(p.id) ? (
                    <video ref={el => { if (el) { videoElementRefs.current.set(p.id, el); const s = streamAssignments.current.get(p.id); if (s && el.srcObject !== s) el.srcObject = s; } }}
                      autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
                      {p.username?.[0] || 'U'}
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 2, left: 4, color: '#fff', fontSize: 10, background: 'rgba(0,0,0,0.5)', padding: '1px 4px', borderRadius: 4 }}>{p.username || t("User")}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Audio Settings Panel */}
      {showAudioSettings && (
        <div style={{
          position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.9)', padding: 20, borderRadius: 12, zIndex: 1002, minWidth: 300,
        }}>
          <h4 style={{ color: '#fff', margin: '0 0 15px', fontSize: 14 }}>{t("Audio Devices")}</h4>
          <div style={{ marginBottom: 15 }}>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 8 }}>{t("Microphone (Input)")}</label>
            <select value={selectedAudioInput || ''} onChange={e => onAudioInputChange?.(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 6, fontSize: 13 }}>
              <option value="">{t("Default")}</option>
              {(audioInputDevices || []).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t("Microphone")} ${d.deviceId.slice(0, 8)}...`}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 15 }}>
            <label style={{ color: '#aaa', fontSize: 12, display: 'block', marginBottom: 8 }}>{t("Speaker (Output)")}</label>
            <select value={selectedAudioOutput || ''} onChange={e => onAudioOutputChange?.(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 6, fontSize: 13 }}>
              <option value="">{t("Default")}</option>
              {(audioOutputDevices || []).map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `${t("Speaker")} ${d.deviceId.slice(0, 8)}...`}</option>)}
            </select>
          </div>
          <button onClick={() => setShowAudioSettings(false)}
            style={{ width: '100%', padding: 8, background: '#444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>{t("Close")}</button>
        </div>
      )}

      {/* Controls Bar */}
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
          padding: '12px 24px', background: 'rgba(0,0,0,0.8)', zIndex: 1001,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RippleButton className={`vc-btn${isMuted ? ' danger' : ''}`} onClick={toggleMute} style={{ background: isMuted ? '#f23f43' : 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </RippleButton>
          <button onClick={() => setShowAudioSettings(!showAudioSettings)}
            style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: 4 }}>
            <Settings size={14} />
          </button>
          <RippleButton className={`vc-btn${!isCameraOn ? ' danger' : ''}`} onClick={toggleCamera} disabled={callType === "voice" && !isCameraOn}
            style={{ background: !isCameraOn ? '#f23f43' : 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </RippleButton>
          <RippleButton className={`vc-btn${showVoiceEffects ? ' active' : ''}`} onClick={() => setShowVoiceEffects(!showVoiceEffects)}
            style={{ background: showVoiceEffects ? 'rgba(102,120,255,0.4)' : 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </RippleButton>
          <RippleButton className={`vc-btn${isScreenSharing ? ' active' : ''}`} onClick={() => isScreenSharing ? stopScreenShare?.() : handleStartScreenShare()}
            style={{ background: isScreenSharing ? 'rgba(102,120,255,0.4)' : 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={20} />
          </RippleButton>
          {!isScreenSharing && (
            <button onClick={() => setShowScreenQuality(!showScreenQuality)}
              style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: 4 }}>
              <Settings size={14} />
            </button>
          )}
        </div>

        {duration > 0 && (
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </span>
        )}

        <RippleButton className="vc-btn danger" onClick={leaveCall}
          style={{ background: '#f23f43', border: 'none', color: '#fff', width: 56, height: 56, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PhoneOff size={24} />
        </RippleButton>
      </div>

      {/* Screen Quality Panel */}
      <AnimatePresence>
        {showScreenQuality && !isScreenSharing && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            style={{
              position: 'absolute', bottom: 100, right: 20, background: 'rgba(0,0,0,0.9)',
              padding: 16, borderRadius: 12, zIndex: 1002, minWidth: 280, maxHeight: 400, overflowY: 'auto',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{t("Screen Quality")}</span>
              <button onClick={() => setShowScreenQuality(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: '#aaa', fontSize: 11, marginBottom: 6, display: 'block' }}>{t("Resolution")}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {['480p','720p','1080p'].map(r => (
                  <button key={r} onClick={() => handleResolutionChange(r)}
                    style={{ background: screenQuality?.resolution === r ? 'rgba(102,120,255,0.3)' : 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    {r}{screenQuality?.resolution === r && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ color: '#aaa', fontSize: 11, marginBottom: 6, display: 'block' }}>{t("FPS")}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                {[15, 30, 60].map(f => (
                  <button key={f} onClick={() => handleFpsChange(f)}
                    style={{ background: screenQuality?.fps === f ? 'rgba(102,120,255,0.3)' : 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    {f}FPS{screenQuality?.fps === f && ' ✓'}
                  </button>
                ))}
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
              // Apply processed stream to all peer connections
              if (stream && call?.replaceTrack) {
                const audioTrack = stream.getAudioTracks()[0];
                if (audioTrack) call.replaceTrack(audioTrack);
              }
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}