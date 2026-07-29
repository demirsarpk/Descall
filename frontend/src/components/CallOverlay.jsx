import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Monitor,
  Minus, Maximize2, Users, MessageSquare, Hand, MoreVertical, Check, X as XIcon,
  Volume2, ChevronUp, Mic2
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
const PULSE_STYLE = `@keyframes callTilePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`;

export default function CallOverlay({ call, groupCall, me }) {
  const [minimized, setMinimized] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [screenExpanded, setScreenExpanded] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);
  const moreMenuRef = useRef(null);
  const audioPanelRef = useRef(null);

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
    : `${(groupCall.participants?.filter((p) => p.id !== me?.id).length ?? 0) + 1} participants`;

  /* ---------- Incoming DM: floating accept/decline popup ---------- */
  if (isDm && mode === "incoming") {
    return (
      <AnimatePresence>
        <motion.div
          key="dm-incoming-call"
          initial={{ opacity: 0, y: -80, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.92 }}
          transition={{ type: "spring", damping: 22, stiffness: 260 }}
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            background: "linear-gradient(135deg, #1e1f23 0%, #2b2d33 100%)",
            borderRadius: 18,
            padding: "20px 24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 340,
            maxWidth: 420,
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: callType === "video" ? "#5865f2" : "#3ba55d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {callType === "video" ? <Video size={24} color="#fff" /> : <Phone size={24} color="#fff" />}
          </motion.div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#b5bac1", marginBottom: 2 }}>
              {callType === "video" ? "Incoming video call" : "Incoming voice call"}
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {peer?.username || "Someone"} is calling
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => call.declineIncoming?.()}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#ed4245",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
              }}
              title="Decline"
            >
              <PhoneOff size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => call.acceptIncoming?.()}
              style={{
                width: 46,
                height: 46,
                borderRadius: "50%",
                background: "#3ba55d",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                cursor: "pointer",
              }}
              title="Accept"
            >
              <Phone size={20} />
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

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
  const hasLocalVideo = cameraOn && (isDm ? call?.localStream : groupCall?.localStream);

  // Build unified participant list — remote only (local is rendered as a dedicated tile)
  const localId = me?.id;
  const remoteParticipants = isDm
    ? (call?.peer ? [{ id: call.peer.id, username: call.peer.username, avatarUrl: call.peer.avatarUrl, stream: call.remoteStream, hasVideo: callType === "video" && !!call.remoteStream }] : [])
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingTop: 60, paddingBottom: 90 }}>
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
            localAvatarUrl={me?.avatar_url || me?.avatarUrl || null}
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
            localAvatarUrl={me?.avatar_url || me?.avatarUrl || null}
          />
        )}
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

            {/* Audio Device Picker */}
            <div ref={audioPanelRef} style={{ position: "relative" }}>
              <CircleBtn
                color={showAudioPanel ? "rgba(255,255,255,0.18)" : "#3c4043"}
                title="Audio devices"
                onClick={() => { setShowAudioPanel(v => !v); setShowMoreMenu(false); }}
              >
                <Volume2 size={22} />
              </CircleBtn>
              <AnimatePresence>
                {showAudioPanel && (
                  <AudioDevicePanel
                    isDm={isDm}
                    call={call}
                    groupCall={groupCall}
                    onClose={() => setShowAudioPanel(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            <div ref={moreMenuRef} style={{ position: "relative" }}>
              <CircleBtn
                color={showMoreMenu ? "rgba(255,255,255,0.15)" : "#3c4043"}
                title="More options"
                onClick={() => setShowMoreMenu((v) => !v)}
              >
                <MoreVertical size={22} />
              </CircleBtn>

              <AnimatePresence>
                {showMoreMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.14 }}
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 10px)",
                      right: 0,
                      background: "#2b2d33",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      minWidth: 210,
                      zIndex: 100,
                      overflow: "hidden",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                    }}
                  >
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
                <XIcon size={18} />
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
  // Remote tiles only — local is rendered separately below to avoid double-render
  const remoteTiles = remoteParticipants.map((p) => ({
    id: p.id,
    username: p.username || "Member",
    avatarUrl: p.avatarUrl,
    hasVideo: p.hasVideo || p.isCameraOn,
  }));

  const count = 1 + remoteTiles.length;
  const cols = count === 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const rows = Math.ceil(count / cols);

  return (
    <div
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
      {/* Local tile always first */}
      <LocalVideoTile
        isDm={isDm}
        call={call}
        groupCall={groupCall}
        hasVideo={hasLocalVideo}
        username={localUsername}
        avatarUrl={localAvatarUrl}
      />
      {/* Remote participant tiles */}
      {remoteTiles.map((tile) => (
        <ParticipantTile
          key={tile.id}
          username={tile.username}
          avatarUrl={tile.avatarUrl}
          isSpeaking={false}
          videoRef={null}
          hasVideo={false}
          isLocal={false}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   ScreenShareLayout — selected screen large on top, strip below
   ───────────────────────────────────────────────────────────────── */
function ScreenShareLayout({ allScreenSharers, screenExpanded, setScreenExpanded, isDm, call, groupCall, remoteParticipants, hasLocalVideo, cameraOn, localUsername, localAvatarUrl }) {
  const [selectedSharerIndex, setSelectedSharerIndex] = useState(0);
  const [viewerCount] = useState(0);
  // Keep refs to both the normal and expanded video elements so we can set srcObject on each
  const normalVideoRef = useRef(null);
  const expandedVideoRef = useRef(null);

  // Clamp index if sharers list shrinks
  const safeIndex = Math.min(selectedSharerIndex, allScreenSharers.length - 1);
  const activeSharer = allScreenSharers[safeIndex] ?? allScreenSharers[0];

  // Derive the stream to display for the active sharer
  const screenStream = activeSharer?.isLocal
    ? (isDm ? call?.screenStream : groupCall?.screenStream)
    : (groupCall?.participants?.find((p) => p.id === activeSharer?.id)?.screenStream ?? null);

  const attachStream = useCallback((el, stream) => {
    if (!el || !stream) return;
    // Only reassign srcObject when the stream reference actually changes —
    // reassigning the same stream causes the browser to reload the video
    // element producing a black flash on every React render.
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    // If any video track is still muted (ICE not yet connected), register
    // onunmute to call play() without touching srcObject (no reload = no flash).
    const videoTracks = stream.getVideoTracks();
    const playWhenReady = () => el.play().catch(() => {});
    if (videoTracks.some((t) => t.muted || t.readyState !== "live")) {
      videoTracks.forEach((t) => { t.onunmute = playWhenReady; });
    } else {
      el.play().catch(() => {});
    }
  }, []);

  // Only re-attach when the stream reference changes (new peer / new share)
  useEffect(() => {
    attachStream(normalVideoRef.current, screenStream);
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, padding: "4px 12px", minHeight: 0 }}>
      {/* ── Main screen share area ── */}
      <div
        style={{
          flex: 1,
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
          background: "#000",
          cursor: "pointer",
          minHeight: 0,
        }}
        onClick={() => setScreenExpanded((v) => !v)}
      >
        <video
          ref={normalVideoRef}
          autoPlay
          playsInline
          muted={activeSharer?.isLocal}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />

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
              ref={expandedVideoCallbackRef}
              autoPlay
              playsInline
              muted={activeSharer?.isLocal}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
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
        style={{
          height: 110,
          display: "flex",
          gap: 8,
          overflowX: "auto",
          overflowY: "hidden",
          flexShrink: 0,
          padding: "2px 0 4px",
          scrollbarWidth: "none",
        }}
      >
        {stripTiles.map((tile) => {
          const videoRef = tile.isLocal
            ? (isDm ? call?.localVideoRef : groupCall?.localVideoRef)
            : null;
          return (
            <div key={tile.id} style={{ width: 160, height: 100, flexShrink: 0 }}>
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
function AudioDevicePanel({ isDm, call, groupCall, onClose }) {
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
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position: "absolute",
        bottom: "calc(100% + 14px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: 320,
        background: "linear-gradient(160deg, #25272e 0%, #1e2026 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
        zIndex: 200,
        overflow: "hidden",
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

      {/* Arrow pointing down to the button */}
      <div style={{
        position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)",
        width: 14, height: 14, background: "#1e2026",
        border: "1px solid rgba(255,255,255,0.09)",
        borderTop: "none", borderLeft: "none",
        transform: "translateX(-50%) rotate(45deg)",
        transformOrigin: "center",
      }} />
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
