import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor,
  Minus, Maximize2, Users, MessageSquare, Hand, MoreVertical, Check, X as XIcon,
  Volume2, ChevronUp, Mic2, SlidersHorizontal, PictureInPicture2,
} from "lucide-react";
import { Avatar } from "./ui/Avatar";
import DmRemoteParticipantSlot from "./voice/DmRemoteParticipantSlot";
import { useDmRemoteParticipant } from "../hooks/useDmRemoteParticipant";
import { resolveAvatarUrl } from "../lib/avatar";
import ScreenShareQualityPanel from "./voice/ScreenShareQualityPanel";
import CallPipSource, { CallPipButton } from "./voice/CallPipSource";
import IncomingCallCard from "./voice/IncomingCallCard";
import { useIsNarrowViewport } from "../lib/useIsNarrowViewport";

/*
 * Google Meet-style call overlay
 * - Large main video area (peer or screen share)
 * - Self-view picture-in-picture (bottom-right)
 * - Bottom control bar
 * - Top info bar
 * - Minimizable to floating widget
 */
const PULSE_STYLE = `@keyframes callTilePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`;

export default function CallOverlay({ call, groupCall, me }) {
  const [minimized, setMinimized] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [screenExpanded, setScreenExpanded] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showScreenQuality, setShowScreenQuality] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);
  const [pipApi, setPipApi] = useState(null);
  const narrowViewport = useIsNarrowViewport(720);
  const moreMenuRef = useRef(null);
  const audioPanelRef = useRef(null);
  const screenQualityAnchorRef = useRef(null);
  const onPipApi = useCallback((api) => setPipApi(api), []);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  useEffect(() => {
    if (!showAudioPanel) return;
    const handleClickOutside = (e) => {
      if (audioPanelRef.current && !audioPanelRef.current.contains(e.target)) {
        setShowAudioPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAudioPanel]);

  // Auto-decline unanswered DM incoming calls (match group modal)
  useEffect(() => {
    if (call?.mode !== "incoming") return;
    const timer = setTimeout(() => {
      call.declineIncoming?.();
    }, 30_000);
    return () => clearTimeout(timer);
  }, [call?.mode, call?.peer?.id]);

  const isDmActive = call?.mode !== null && call?.mode !== undefined;
  const isGroupActive = groupCall?.isInCall;
  const active = isDmActive || isGroupActive;

  useEffect(() => {
    if (!active) {
      setMinimized(false);
      setShowParticipants(false);
      setShowChat(false);
      setScreenExpanded(false);
      setShowScreenQuality(false);
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
      ? (call?.connectionQuality === "failed"
          ? "User may be offline — waiting…"
          : "Calling...")
      : call?.peerConnectionState === "reconnecting"
      ? "Reconnecting…"
      : call?.peerConnectionState === "connecting" || (call?.mode === "active" && !call?.remoteMediaReady)
      ? "Connecting…"
      : callType === "video"
      ? "Video call"
      : "Voice call"
    : `${(groupCall.participants?.filter((p) => p.id !== me?.id).length ?? 0) + 1} participants`;

  const pipSource = (
    <CallPipSource
      isDm={isDm}
      call={call}
      groupCall={groupCall}
      active={Boolean(active && !(isDm && mode === "incoming"))}
      onApi={onPipApi}
    />
  );

  /* ---------- Incoming DM: FaceTime-style avatar rings ---------- */
  if (isDm && mode === "incoming") {
    return (
      <AnimatePresence>
        <IncomingCallCard
          key="dm-incoming-call"
          username={peer?.username}
          user={peer}
          callType={callType}
          onDecline={() => call.declineIncoming?.()}
          onAccept={() => call.acceptIncoming?.()}
        />
      </AnimatePresence>
    );
  }

  /* ---------- Minimized widget ---------- */
  if (minimized) {
    return (
      <>
        {pipSource}
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
              <Avatar name={peer?.username || "?"} size={44} imageUrl={resolveAvatarUrl(peer)} />
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
            type="button"
            title="Picture in Picture"
            onClick={(e) => {
              e.stopPropagation();
              pipApi?.enterPip?.();
            }}
            style={{
              background: "#3c4043",
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
            <PictureInPicture2 size={16} />
          </button>
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
      </>
    );
  }

  /* ---------- Fullscreen Meet-style overlay ---------- */
  const hasLocalVideo = cameraOn && (isDm ? call?.localStream : groupCall?.localStream);

  // Build unified participant list — remote only (local is rendered as a dedicated tile)
  const localId = me?.id;
  const remoteParticipants = isDm
    ? (call?.peer && call?.mode === "active"
        ? [{
            id: call.peer.id,
            username: call.peer.username,
            avatarUrl: resolveAvatarUrl(call.peer),
            stream: call.remoteStream,
            hasVideo: callType === "video" && !!call.remoteStream,
          }]
        : [])
    : (groupCall?.participants ?? []).filter((p) => p.id !== localId);

  // All screen sharers: remote peers sharing only (exclude local — handled separately by screenSharing flag)
  const remoteScreenSharers = isDm
    ? []
    : (groupCall?.participants ?? []).filter((p) => p.isScreenSharing && p.screenStream && p.id !== localId);
  const localUsername = me?.username || me?.displayName || "You";

  const allScreenSharers = [
    ...(screenSharing ? [{ id: "local", username: localUsername, isLocal: true }] : []),
    ...remoteScreenSharers.map((p) => ({ id: p.id, username: p.username, isLocal: false })),
  ];
  const anyScreenShare = allScreenSharers.length > 0;

  return (
    <>
    {pipSource}
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
      <style>{PULSE_STYLE}</style>
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
          {anyScreenShare && (
            <span style={{ background: "#3ba55d", color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
              <Monitor size={12} />
              Presenting
            </span>
          )}
          <span style={{ fontSize: 13, color: "#b5bac1" }}>
            {subtitle}{formattedDuration ? ` · ${formattedDuration}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
          <TopIconBtn onClick={() => setShowParticipants(!showParticipants)} active={showParticipants}><Users size={18} /></TopIconBtn>
          <TopIconBtn onClick={() => setShowChat(!showChat)} active={showChat}><MessageSquare size={18} /></TopIconBtn>
          <TopIconBtn onClick={() => setMinimized(true)}><Minus size={18} /></TopIconBtn>
        </div>
      </div>

      {/* ====== MAIN CONTENT AREA ====== */}
      {/* Reserve real control-bar height so screen share never sits under the buttons */}
      <div
        className="call-main-stage"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minHeight: 0,
          paddingTop: narrowViewport ? 56 : 60,
          paddingBottom: narrowViewport
            ? "calc(72px + env(safe-area-inset-bottom, 0px))"
            : 96,
        }}
      >
        {anyScreenShare ? (
          <ScreenShareLayout
            allScreenSharers={allScreenSharers}
            screenExpanded={screenExpanded}
            setScreenExpanded={setScreenExpanded}
            isDm={isDm}
            call={call}
            groupCall={groupCall}
            remoteParticipants={remoteParticipants}
            hasLocalVideo={hasLocalVideo}
            cameraOn={cameraOn}
            localUsername={localUsername}
            localAvatarUrl={resolveAvatarUrl(me)}
            narrow={narrowViewport}
          />
        ) : (
          <ParticipantGrid
            isDm={isDm}
            call={call}
            groupCall={groupCall}
            remoteParticipants={remoteParticipants}
            hasLocalVideo={hasLocalVideo}
            cameraOn={cameraOn}
            callType={callType}
            peer={peer}
            mode={mode}
            title={title}
            subtitle={subtitle}
            formattedDuration={formattedDuration}
            localUsername={localUsername}
            localAvatarUrl={resolveAvatarUrl(me)}
          />
        )}
      </div>

      {/* ====== BOTTOM CONTROL BAR ====== */}
      <div
        className="call-control-bar"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          zIndex: 10,
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "center",
          justifyContent: "space-evenly",
          gap: narrowViewport ? 6 : 14,
          padding: narrowViewport
            ? "12px 12px calc(12px + env(safe-area-inset-bottom, 0px))"
            : "20px 24px 28px",
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 40%, transparent)",
          boxSizing: "border-box",
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
              size={narrowViewport ? 46 : 52}
              color={muted ? "#ed4245" : "#3c4043"}
              onClick={isDm ? call.toggleMute : groupCall.toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff size={narrowViewport ? 19 : 22} /> : <Mic size={narrowViewport ? 19 : 22} />}
            </CircleBtn>

            <CircleBtn
              size={narrowViewport ? 46 : 52}
              color={cameraOn ? "#3c4043" : "#ed4245"}
              onClick={isDm ? call.toggleCamera : groupCall.toggleCamera}
              title={cameraOn ? "Turn off camera" : "Turn on camera"}
            >
              {cameraOn ? <Video size={narrowViewport ? 19 : 22} /> : <VideoOff size={narrowViewport ? 19 : 22} />}
            </CircleBtn>

            <div
              ref={screenQualityAnchorRef}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <CircleBtn
                size={narrowViewport ? 46 : 52}
                color={screenSharing ? "#3ba55d" : "#3c4043"}
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowAudioPanel(false);
                  if (isDm) {
                    if (screenSharing) call.stopScreenShare();
                    else setShowScreenQuality((v) => !v);
                  } else {
                    if (groupCall.isScreenSharing) groupCall.stopScreenShare();
                    else setShowScreenQuality((v) => !v);
                  }
                }}
                title={screenSharing ? "Stop presenting" : "Present screen"}
              >
                <Monitor size={narrowViewport ? 19 : 22} />
              </CircleBtn>
              {!narrowViewport && (screenSharing || showScreenQuality) && (
                <button
                  type="button"
                  title="Ekran kalitesi"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowAudioPanel(false);
                    setShowScreenQuality((v) => !v);
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: showScreenQuality ? "rgba(88,101,242,0.35)" : "rgba(0,0,0,0.35)",
                    color: "#e8e8ec",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <SlidersHorizontal size={14} />
                </button>
              )}
              <ScreenShareQualityPanel
                open={showScreenQuality}
                onClose={() => setShowScreenQuality(false)}
                anchorRef={screenQualityAnchorRef}
                isGroupCall={!isDm}
                participantCount={
                  isDm
                    ? 2
                    : (groupCall.participants?.length ?? 0) + 1
                }
                screenQuality={isDm ? call.screenQuality : groupCall.screenQuality}
                setScreenQuality={isDm ? call.setScreenQuality : groupCall.setScreenQuality}
                isScreenSharing={screenSharing}
                onStartWithQuality={async (q) => {
                  if (isDm) await call.startScreenShare(q);
                  else await groupCall.startScreenShare(q);
                }}
                onRestartWithQuality={async (q) => {
                  if (isDm) await call.restartScreenShareWithQuality(q);
                  else await groupCall.restartScreenShareWithQuality(q);
                }}
              />
            </div>

            {!narrowViewport && (
              <motion.button
                onClick={() => setHandRaised((v) => !v)}
                title={handRaised ? "Lower hand" : "Raise hand"}
                animate={handRaised ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                transition={handRaised ? { repeat: Infinity, duration: 1.6, ease: "easeInOut" } : {}}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: handRaised ? "#f0a500" : "#3c4043",
                  border: handRaised ? "2px solid #ffc107" : "2px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: handRaised ? "0 0 16px rgba(240,165,0,0.5)" : "none",
                }}
              >
                <Hand size={22} />
              </motion.button>
            )}

            {!narrowViewport && (
              <div ref={audioPanelRef} style={{ position: "relative", flexShrink: 0 }}>
                <CircleBtn
                  size={52}
                  color={showAudioPanel ? "rgba(255,255,255,0.18)" : "#3c4043"}
                  title="Audio devices"
                  onClick={() => {
                    setShowAudioPanel((v) => !v);
                    setShowMoreMenu(false);
                    setShowScreenQuality(false);
                  }}
                >
                  <Volume2 size={22} />
                </CircleBtn>
                <AnimatePresence>
                  {showAudioPanel && (
                    <AudioDevicePanel
                      isDm={isDm}
                      call={call}
                      groupCall={groupCall}
                      narrow={false}
                      onClose={() => setShowAudioPanel(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

            <div ref={moreMenuRef} style={{ position: "relative", flexShrink: 0 }}>
              <CircleBtn
                size={narrowViewport ? 46 : 52}
                color={showMoreMenu || (narrowViewport && handRaised) ? "rgba(255,255,255,0.15)" : "#3c4043"}
                title="More options"
                onClick={() => {
                  setShowMoreMenu((v) => !v);
                  setShowAudioPanel(false);
                  setShowScreenQuality(false);
                }}
              >
                <MoreVertical size={narrowViewport ? 19 : 22} />
              </CircleBtn>

              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={narrowViewport ? { opacity: 0, y: 20 } : { opacity: 0, y: 8, scale: 0.95 }}
                    animate={narrowViewport ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={narrowViewport ? { opacity: 0, y: 20 } : { opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.14 }}
                    style={{
                      ...(narrowViewport
                        ? {
                            position: "fixed",
                            left: 12,
                            right: 12,
                            bottom: "max(12px, calc(env(safe-area-inset-bottom, 0px) + 72px))",
                            maxHeight: "min(55vh, 360px)",
                            overflowY: "auto",
                            zIndex: 10050,
                          }
                        : {
                            position: "absolute",
                            bottom: "calc(100% + 10px)",
                            right: 0,
                            minWidth: 210,
                            maxWidth: "min(280px, calc(100vw - 24px))",
                            zIndex: 100,
                          }),
                      background: "#2b2d33",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                      boxSizing: "border-box",
                    }}
                  >
                    {narrowViewport && (
                      <>
                        <MoreMenuItem
                          icon={<Hand size={16} color={handRaised ? "#f0a500" : undefined} />}
                          label={handRaised ? "Lower hand" : "Raise hand"}
                          onClick={() => {
                            setHandRaised((v) => !v);
                            setShowMoreMenu(false);
                          }}
                        />
                        <MoreMenuItem
                          icon={<Volume2 size={16} />}
                          label="Audio devices"
                          onClick={() => {
                            setShowMoreMenu(false);
                            setShowAudioPanel(true);
                          }}
                        />
                        <MoreMenuItem
                          icon={<SlidersHorizontal size={16} />}
                          label="Screen quality"
                          onClick={() => {
                            setShowMoreMenu(false);
                            setShowScreenQuality(true);
                          }}
                        />
                        <MoreMenuItem
                          icon={<PictureInPicture2 size={16} />}
                          label={pipApi?.pipActive ? "Exit Picture in Picture" : "Picture in Picture"}
                          onClick={() => {
                            setShowMoreMenu(false);
                            if (pipApi?.pipActive) pipApi.leavePip?.();
                            else pipApi?.enterPip?.();
                          }}
                        />
                        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                      </>
                    )}
                    <MoreMenuItem
                      icon={cameraOn ? <VideoOff size={16} /> : <Video size={16} />}
                      label={cameraOn ? "Turn off camera" : "Turn on camera"}
                      onClick={() => {
                        isDm ? call.toggleCamera?.() : groupCall.toggleCamera?.();
                        setShowMoreMenu(false);
                      }}
                    />
                    <MoreMenuItem
                      icon={muted ? <Mic size={16} /> : <MicOff size={16} />}
                      label={muted ? "Unmute" : "Mute microphone"}
                      onClick={() => {
                        isDm ? call.toggleMute?.() : groupCall.toggleMute?.();
                        setShowMoreMenu(false);
                      }}
                    />
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                    <MoreMenuItem
                      icon={<Users size={16} />}
                      label="Show participants"
                      onClick={() => {
                        setShowParticipants((v) => !v);
                        setShowMoreMenu(false);
                      }}
                    />
                    <MoreMenuItem
                      icon={copiedInfo ? <Check size={16} color="#3ba55d" /> : <MessageSquare size={16} />}
                      label={copiedInfo ? "Copied!" : "Copy call info"}
                      onClick={() => {
                        const info = isDm
                          ? `Call with ${peer?.username}`
                          : `Group call · ${groupCall.participants?.length ?? 0} participants`;
                        navigator.clipboard?.writeText(info).catch(() => {});
                        setCopiedInfo(true);
                        setTimeout(() => setCopiedInfo(false), 2000);
                      }}
                    />
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                    <MoreMenuItem
                      icon={<PhoneOff size={16} color="#ed4245" />}
                      label="Leave call"
                      danger
                      onClick={() => {
                        setShowMoreMenu(false);
                        isDm ? call.endCall?.(peer?.id) : groupCall.leaveCall?.();
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile audio panel (opened from More) */}
            {narrowViewport && (
              <div ref={audioPanelRef} style={{ position: "absolute", width: 0, height: 0, overflow: "visible" }}>
                <AnimatePresence>
                  {showAudioPanel && (
                    <AudioDevicePanel
                      isDm={isDm}
                      call={call}
                      groupCall={groupCall}
                      narrow
                      onClose={() => setShowAudioPanel(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

            {!narrowViewport && <CallPipButton pipApi={pipApi} />}

            <CircleBtn
              color="#ed4245"
              size={narrowViewport ? 50 : 56}
              onClick={() => (isDm ? call.endCall(peer?.id) : groupCall.leaveCall())}
              title="End call"
            >
              <PhoneOff size={narrowViewport ? 21 : 24} />
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
              width: narrowViewport ? "min(100%, 320px)" : 300,
              maxWidth: "100vw",
              zIndex: 20,
              background: "#1e1f23",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
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
                <XIcon size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {isDm ? (
                <PersonRow name={peer?.username || "User"} avatarUrl={resolveAvatarUrl(peer)} isHost />
              ) : (
                groupCall.participants?.map((p) => (
                  <PersonRow key={p.id} name={p.username} avatarUrl={resolveAvatarUrl(p)} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ParticipantTile — one rectangle in the grid or strip
   isSpeaking derived externally; videoRef only for remote video.
   ───────────────────────────────────────────────────────────────── */
function ParticipantTile({ username, avatarUrl, isSpeaking, videoRef, hasVideo, isLocal, small = false }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: small ? 10 : 14,
        overflow: "hidden",
        background: "#1a1b1f",
        border: isSpeaking ? "2px solid #3ba55d" : "2px solid transparent",
        boxShadow: isSpeaking ? "0 0 0 1px rgba(59,165,93,0.35)" : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {hasVideo && videoRef ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: small ? 6 : 12 }}>
          <Avatar name={username || "?"} size={small ? 36 : 64} imageUrl={avatarUrl} />
          {!small && (
            <span style={{ fontSize: 13, color: "#b5bac1", fontWeight: 500 }}>{username}</span>
          )}
        </div>
      )}

      {/* Name label overlay at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: small ? "4px 8px" : "8px 12px",
          background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {isSpeaking && (
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3ba55d", flexShrink: 0, animation: "callTilePulse 1.2s infinite" }} />
        )}
        <span style={{ fontSize: small ? 11 : 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {username}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ParticipantGrid — adaptive grid layout when no screen share
   ───────────────────────────────────────────────────────────────── */
function LocalVideoTile({ isDm, call, groupCall, hasVideo, username, avatarUrl }) {
  const localStream = isDm ? call?.localStream : groupCall?.localStream;

  const videoCallbackRef = useCallback((el) => {
    if (!el) return;
    // Register with hook so toggleCamera / setLocalVideo can drive it
    if (!isDm && groupCall?.setLocalVideo) groupCall.setLocalVideo(el);
    // Attach stream if already available
    if (localStream && el.srcObject !== localStream) {
      el.srcObject = localStream;
      el.play().catch(() => {});
    }
  }, [isDm, groupCall, localStream]);

  // Re-attach when stream changes (e.g. camera toggled on mid-call)
  useEffect(() => {
    const ref = isDm ? call?.localVideoRef : groupCall?.localVideoRef;
    if (!ref?.current || !localStream) return;
    if (ref.current.srcObject !== localStream) {
      ref.current.srcObject = localStream;
      ref.current.play().catch(() => {});
    }
  }, [localStream, isDm, call, groupCall]);

  return (
    <ParticipantTile
      username={username}
      avatarUrl={avatarUrl}
      isSpeaking={false}
      videoRef={hasVideo ? videoCallbackRef : null}
      hasVideo={hasVideo}
      isLocal
    />
  );
}

function ParticipantGrid({ isDm, call, groupCall, remoteParticipants, hasLocalVideo, cameraOn, callType, peer, mode, title, subtitle, formattedDuration, localUsername, localAvatarUrl }) {
  const dmRemote = useDmRemoteParticipant({
    peer: isDm ? call?.peer : null,
    mode: isDm ? call?.mode : null,
    remoteMediaReady: isDm ? call?.remoteMediaReady : false,
    peerConnectionState: isDm ? call?.peerConnectionState : "idle",
    connectionQuality: isDm ? call?.connectionQuality : "unknown",
  });

  const remoteTiles = remoteParticipants.map((p) => ({
    id: p.id,
    username: p.username || "Member",
    avatarUrl: p.avatarUrl || resolveAvatarUrl(p),
    hasVideo: p.hasVideo || p.isCameraOn,
  }));

  const dmTwoUp = isDm && dmRemote.showSlot;
  const count = dmTwoUp ? 2 : 1 + remoteTiles.length;
  const cols = dmTwoUp ? 2 : count === 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const rows = dmTwoUp ? 1 : Math.ceil(count / cols);

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 8,
        padding: "8px 12px",
        minHeight: 0,
      }}
    >
      <motion.div layout transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }} style={{ minWidth: 0, minHeight: 0 }}>
        <LocalVideoTile
          isDm={isDm}
          call={call}
          groupCall={groupCall}
          hasVideo={hasLocalVideo}
          username={localUsername}
          avatarUrl={localAvatarUrl}
        />
      </motion.div>

      {isDm && dmRemote.showSlot && (
        <motion.div
          layout
          transition={{ layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}
          style={{ minWidth: 0, minHeight: 0, position: "relative" }}
        >
          <DmRemoteParticipantSlot
            displayPeer={dmRemote.displayPeer}
            phase={dmRemote.phase}
            connectionStatus={dmRemote.connectionStatus}
            isMediaReady={dmRemote.isMediaReady}
            hasVideo={callType === "video" && !!call?.remoteStream}
            videoRef={call?.remoteVideoRef}
            remoteStream={call?.remoteStream}
          />
        </motion.div>
      )}

      {!isDm && remoteTiles.map((tile) => (
        <motion.div key={tile.id} layout style={{ minWidth: 0, minHeight: 0 }}>
          <ParticipantTile
            username={tile.username}
            avatarUrl={tile.avatarUrl}
            isSpeaking={false}
            videoRef={null}
            hasVideo={false}
            isLocal={false}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ScreenShareLayout — selected screen large on top, strip below
   ───────────────────────────────────────────────────────────────── */
function ScreenShareLayout({ allScreenSharers, screenExpanded, setScreenExpanded, isDm, call, groupCall, remoteParticipants, hasLocalVideo, cameraOn, localUsername, localAvatarUrl, narrow = false }) {
  const [selectedSharerIndex, setSelectedSharerIndex] = useState(0);
  const [viewerCount] = useState(0);
  // Keep refs to both the normal and expanded video elements so we can set srcObject on each
  const normalVideoRef = useRef(null);
  const expandedVideoRef = useRef(null);
  const prevSharerCountRef = useRef(0);

  // When a new sharer appears (dual screen share), auto-focus the newest one
  useEffect(() => {
    const n = allScreenSharers.length;
    if (n > prevSharerCountRef.current) {
      setSelectedSharerIndex(n - 1);
    } else if (n > 0 && selectedSharerIndex > n - 1) {
      setSelectedSharerIndex(n - 1);
    }
    prevSharerCountRef.current = n;
  }, [allScreenSharers.length, selectedSharerIndex]);

  // Clamp index if sharers list shrinks
  const safeIndex = allScreenSharers.length
    ? Math.min(Math.max(selectedSharerIndex, 0), allScreenSharers.length - 1)
    : 0;
  const activeSharer = allScreenSharers[safeIndex] ?? allScreenSharers[0];

  // Derive the stream to display for the active sharer
  const screenStream = activeSharer?.isLocal
    ? (isDm ? call?.screenStream : groupCall?.screenStream)
    : (groupCall?.participants?.find((p) => p.id === activeSharer?.id)?.screenStream ?? null);

  const attachStream = useCallback((el, stream) => {
    if (!el) return;
    if (!stream) {
      if (el.srcObject) el.srcObject = null;
      return;
    }
    // Only reassign srcObject when the stream reference actually changes —
    // reassigning the same stream causes the browser to reload the video
    // element producing a black flash on every React render.
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    // If any video track is still muted (ICE not yet connected), chain onunmute
    // so we don't clobber useGroupCall's applyScreenStream handler.
    const videoTracks = stream.getVideoTracks();
    const playWhenReady = () => el.play().catch(() => {});
    if (videoTracks.some((t) => t.muted || t.readyState !== "live")) {
      videoTracks.forEach((t) => {
        const prev = t.onunmute;
        t.onunmute = (ev) => {
          try {
            if (typeof prev === "function") prev.call(t, ev);
          } catch {
            /* ignore */
          }
          playWhenReady();
        };
      });
    }
    playWhenReady();
  }, []);

  // Re-attach via callback ref so remounts from key=sharerId always bind the stream
  const normalVideoCallbackRef = useCallback((el) => {
    normalVideoRef.current = el;
    if (el) attachStream(el, screenStream);
  }, [screenStream, attachStream]);

  // Callback ref for expanded video — fires immediately when the element mounts
  const expandedVideoCallbackRef = useCallback((el) => {
    expandedVideoRef.current = el;
    if (el) attachStream(el, screenStream);
  }, [screenStream, attachStream]);

  const sharerLabel = activeSharer
    ? (activeSharer.isLocal ? "Your Screen" : `${activeSharer.username}'s Screen`)
    : "";

  // Strip tiles: all participants + local self
  const stripTiles = [
    { id: "local", username: localUsername, isLocal: true, hasVideo: hasLocalVideo, avatarUrl: localAvatarUrl },
    ...remoteParticipants.map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatarUrl, isLocal: false, hasVideo: p.hasVideo || p.isCameraOn })),
  ];

  const stripH = narrow ? 72 : 110;
  const tileW = narrow ? 112 : 160;
  const tileH = narrow ? 64 : 100;

  return (
    <div
      className="call-screen-share-layout"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: narrow ? 6 : 8,
        padding: narrow ? "2px 8px 0" : "4px 12px",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* ── Main screen share area ── */}
      <div
        style={{
          flex: "1 1 auto",
          position: "relative",
          borderRadius: narrow ? 12 : 14,
          overflow: "hidden",
          background: "#000",
          cursor: "pointer",
          minHeight: 0,
        }}
        onClick={() => setScreenExpanded((v) => !v)}
      >
        {/* key forces remount when switching sharers — prevents stuck black frames */}
        <video
          key={activeSharer?.id || "none"}
          ref={normalVideoCallbackRef}
          autoPlay
          playsInline
          muted={Boolean(activeSharer?.isLocal)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            // Promote to compositor layer — reduces paint jank on remote screen share
            transform: "translateZ(0)",
            willChange: "contents",
          }}
        />

        {!screenStream && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#b5bac1",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            Waiting for screen…
          </div>
        )}

        {/* Sharer name label — top-left */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            borderRadius: 8,
            padding: "6px 12px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Monitor size={13} color="#3ba55d" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{sharerLabel}</span>
          {viewerCount > 0 && (
            <span style={{ fontSize: 11, color: "#b5bac1", marginLeft: 4 }}>
              <Users size={11} style={{ display: "inline", marginRight: 3 }} />
              {viewerCount} watching
            </span>
          )}
        </div>

        {/* Expand/collapse hint — bottom-center */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            color: "#b5bac1",
            fontSize: 12,
            padding: "4px 12px",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        >
          {screenExpanded ? "Click to shrink" : "Click to expand"}
        </div>

        {/* Expanded fullscreen overlay */}
        {screenExpanded && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "#000",
              cursor: "pointer",
            }}
            onClick={(e) => { e.stopPropagation(); setScreenExpanded(false); }}
          >
            <video
              key={`exp-${activeSharer?.id || "none"}`}
              ref={expandedVideoCallbackRef}
              autoPlay
              playsInline
              muted={Boolean(activeSharer?.isLocal)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transform: "translateZ(0)",
                willChange: "contents",
              }}
            />
            <div style={{ position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "6px 14px" }}>
              <Monitor size={14} color="#3ba55d" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{sharerLabel}</span>
            </div>
            <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.6)", color: "#b5bac1", fontSize: 12, padding: "5px 14px", borderRadius: 6 }}>
              Click anywhere to exit fullscreen
            </div>
          </div>
        )}
      </div>

      {/* ── Screen selector (multiple sharers) ── */}
      {allScreenSharers.length > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
          <span style={{ fontSize: 12, color: "#72767d", flexShrink: 0 }}>Screens:</span>
          {allScreenSharers.map((sharer, idx) => (
            <motion.button
              key={sharer.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedSharerIndex(idx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 8,
                border: "none",
                background: idx === safeIndex ? "#5865f2" : "rgba(255,255,255,0.08)",
                color: idx === safeIndex ? "#fff" : "#b5bac1",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              <Monitor size={12} />
              {sharer.isLocal ? "Your Screen" : `${sharer.username}'s Screen`}
            </motion.button>
          ))}
        </div>
      )}

      {/* ── Bottom participant strip ── */}
      <div
        className="call-screen-share-strip"
        style={{
          height: stripH,
          display: "flex",
          gap: 8,
          overflowX: "auto",
          overflowY: "hidden",
          flexShrink: 0,
          padding: "2px 0 4px",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {stripTiles.map((tile) => {
          const videoRef = tile.isLocal
            ? (isDm ? call?.localVideoRef : groupCall?.localVideoRef)
            : null;
          return (
            <div key={tile.id} style={{ width: tileW, height: tileH, flexShrink: 0 }}>
              <ParticipantTile
                username={tile.username}
                avatarUrl={tile.avatarUrl}
                isSpeaking={tile.isSpeaking}
                videoRef={tile.hasVideo ? videoRef : null}
                hasVideo={tile.hasVideo}
                isLocal={tile.isLocal}
                small
              />
            </div>
          );
        })}
      </div>
    </div>
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

/* ─────────────────────────────────────────────────────────────────
   AudioDevicePanel — floating panel for mic/speaker selection
   ───────────────────────────────────────────────────────────────── */
function AudioDevicePanel({ isDm, call, groupCall, onClose, narrow = false }) {
  const hook = isDm ? call : groupCall;
  const {
    audioInputDevices = [],
    audioOutputDevices = [],
    selectedAudioInput = "",
    selectedAudioOutput = "",
    setAudioInput,
    setAudioOutput,
  } = hook || {};

  const [switching, setSwitching] = useState(null); // "input" | "output"

  const handleInputChange = async (deviceId) => {
    setSwitching("input");
    try { await setAudioInput?.(deviceId); } finally { setSwitching(null); }
  };

  const handleOutputChange = async (deviceId) => {
    setSwitching("output");
    try { await setAudioOutput?.(deviceId); } finally { setSwitching(null); }
  };

  const labelOf = (d) => d.label || (d.kind === "audioinput" ? `Microphone ${d.deviceId.slice(0, 5)}` : `Speaker ${d.deviceId.slice(0, 5)}`);

  return (
    <motion.div
      initial={narrow ? { opacity: 0, y: 24 } : { opacity: 0, y: 12, x: "-50%", scale: 0.96 }}
      animate={narrow ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, x: "-50%", scale: 1 }}
      exit={narrow ? { opacity: 0, y: 24 } : { opacity: 0, y: 12, x: "-50%", scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        ...(narrow
          ? {
              position: "fixed",
              left: 12,
              right: 12,
              bottom: "max(12px, calc(env(safe-area-inset-bottom, 0px) + 72px))",
              width: "auto",
              maxHeight: "min(70dvh, calc(100dvh - 120px))",
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              zIndex: 10050,
            }
          : {
              position: "absolute",
              bottom: "calc(100% + 14px)",
              left: "50%",
              width: "min(320px, calc(100vw - 24px))",
              maxHeight: "min(70vh, 480px)",
              overflowY: "auto",
              overflowX: "hidden",
              zIndex: 200,
            }),
        background: "linear-gradient(160deg, #25272e 0%, #1e2026 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(88,101,242,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Volume2 size={14} color="#7289da" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e3e5e8", letterSpacing: "0.01em" }}>Audio Devices</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#72767d", cursor: "pointer", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
          onMouseEnter={e => e.currentTarget.style.color = "#e3e5e8"}
          onMouseLeave={e => e.currentTarget.style.color = "#72767d"}
        >
          <XIcon size={15} />
        </button>
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px" }} />

      <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Microphone section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(59,165,93,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mic2 size={12} color="#3ba55d" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#72767d", textTransform: "uppercase", letterSpacing: "0.06em" }}>Microphone</span>
            {switching === "input" && (
              <span style={{ fontSize: 10, color: "#7289da", marginLeft: "auto" }}>Switching…</span>
            )}
          </div>
          {audioInputDevices.length === 0 ? (
            <div style={{ fontSize: 12, color: "#72767d", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>No microphones found</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {audioInputDevices.map((d) => {
                const isSelected = d.deviceId === selectedAudioInput;
                return (
                  <button
                    key={d.deviceId}
                    onClick={() => !isSelected && handleInputChange(d.deviceId)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px",
                      background: isSelected ? "rgba(88,101,242,0.18)" : "rgba(255,255,255,0.04)",
                      border: isSelected ? "1px solid rgba(88,101,242,0.4)" : "1px solid transparent",
                      borderRadius: 10, cursor: isSelected ? "default" : "pointer",
                      textAlign: "left", width: "100%",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  >
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? "#5865f2" : "#4f545c",
                      boxShadow: isSelected ? "0 0 6px rgba(88,101,242,0.8)" : "none",
                      transition: "all 0.15s",
                    }} />
                    <span style={{
                      fontSize: 12, fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "#dee0fc" : "#b5bac1",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>
                      {labelOf(d)}
                    </span>
                    {isSelected && (
                      <Check size={13} color="#5865f2" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

        {/* Speaker / Output section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(114,137,218,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Volume2 size={12} color="#7289da" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#72767d", textTransform: "uppercase", letterSpacing: "0.06em" }}>Speaker</span>
            {switching === "output" && (
              <span style={{ fontSize: 10, color: "#7289da", marginLeft: "auto" }}>Switching…</span>
            )}
          </div>
          {audioOutputDevices.length === 0 ? (
            <div style={{ fontSize: 12, color: "#72767d", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
              No output devices found
              <div style={{ fontSize: 11, marginTop: 3, color: "#4f545c" }}>Browser may not support output selection</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {audioOutputDevices.map((d) => {
                const isSelected = d.deviceId === selectedAudioOutput;
                return (
                  <button
                    key={d.deviceId}
                    onClick={() => !isSelected && handleOutputChange(d.deviceId)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px",
                      background: isSelected ? "rgba(114,137,218,0.18)" : "rgba(255,255,255,0.04)",
                      border: isSelected ? "1px solid rgba(114,137,218,0.4)" : "1px solid transparent",
                      borderRadius: 10, cursor: isSelected ? "default" : "pointer",
                      textAlign: "left", width: "100%",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  >
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? "#7289da" : "#4f545c",
                      boxShadow: isSelected ? "0 0 6px rgba(114,137,218,0.8)" : "none",
                      transition: "all 0.15s",
                    }} />
                    <span style={{
                      fontSize: 12, fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "#dee0fc" : "#b5bac1",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>
                      {labelOf(d)}
                    </span>
                    {isSelected && (
                      <Check size={13} color="#7289da" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Arrow — desktop only (fixed sheet on mobile has no anchor) */}
      {!narrow && (
        <div
          style={{
            position: "absolute",
            bottom: -7,
            left: "50%",
            width: 14,
            height: 14,
            background: "#1e2026",
            border: "1px solid rgba(255,255,255,0.09)",
            borderTop: "none",
            borderLeft: "none",
            transform: "translateX(-50%) rotate(45deg)",
            transformOrigin: "center",
            pointerEvents: "none",
          }}
        />
      )}
    </motion.div>
  );
}

function MoreMenuItem({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        background: "none",
        border: "none",
        color: danger ? "#ed4245" : "#e3e5e8",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "rgba(237,66,69,0.12)" : "rgba(255,255,255,0.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}
