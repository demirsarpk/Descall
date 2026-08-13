import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Headphones,
  LogIn,
  LogOut,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Radio,
  Users,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";
import { resolveDisplayName } from "../../lib/userProfile";
import { serverHasPermission } from "../../lib/serverPermissions";
import useSpeaking from "../../hooks/useSpeaking";
import { isNoiseSuppressionEnabled } from "../../lib/noiseSuppression";

function streamHasLiveVideo(stream) {
  return Boolean(
    stream?.getVideoTracks?.()?.some((t) => t && t.readyState === "live" && !t.muted)
  );
}

function streamHasLiveAudio(stream) {
  return Boolean(
    stream?.getAudioTracks?.()?.some((t) => t && t.readyState !== "ended")
  );
}

function VoiceMemberRow({
  member,
  label,
  stream = null,
  muted = false,
  micIcon = true,
  sharing = false,
  cameraOn = false,
}) {
  const speaking = useSpeaking(stream, {
    muted: Boolean(muted),
    threshold: 0.014,
    attackMs: 55,
    releaseMs: 260,
  });
  const name = label || resolveDisplayName(member) || member?.username || "User";
  return (
    <div
      className={`server-voice-member${muted ? " is-muted" : ""}${speaking ? " is-speaking" : ""}`}
    >
      <div className="server-voice-member-avatar-shell" aria-hidden>
        <div className={`server-voice-speak-ring ring-a${speaking ? " is-active" : ""}`} />
        <div className={`server-voice-speak-ring ring-b${speaking ? " is-active" : ""}`} />
        <Avatar
          name={name}
          size={32}
          user={member}
          animate="speaking"
          isSpeaking={speaking}
          className="server-voice-member-avatar"
        />
      </div>
      <span className="server-voice-member-name">{name}</span>
      {member?.stageRole === "speaker" ? <span className="server-stage-speaker-badge">Speaker</span> : null}
      {member?.requestedToSpeak ? <span className="server-stage-request-badge">Requested</span> : null}
      {cameraOn ? <Video size={12} className="server-voice-member-camera" /> : null}
      {sharing ? <Monitor size={12} className="server-voice-member-screen" /> : null}
      {micIcon ? muted ? <MicOff size={12} /> : <Mic size={12} /> : null}
    </div>
  );
}

/** Dedicated audio element for remote screen/tab audio (video stays muted). */
function RemoteScreenAudioSink({ stream, volume = 100, enabled = true }) {
  const audioRef = useRef(null);
  const trackCount =
    stream?.getAudioTracks?.()?.filter((t) => t && t.readyState !== "ended").length || 0;

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const vol = enabled ? Math.max(0, Math.min(1, Number(volume) / 100)) : 0;
    audioEl.volume = vol;
    if (!enabled || !stream || trackCount === 0) {
      audioEl.muted = true;
      if (audioEl.srcObject) audioEl.srcObject = null;
      return;
    }
    audioEl.muted = false;
    audioEl.srcObject = null;
    audioEl.srcObject = stream;
    const play = () => audioEl.play().catch(() => {});
    play();
    stream.getAudioTracks().forEach((t) => {
      const prev = t.onunmute;
      t.onunmute = (ev) => {
        try {
          if (typeof prev === "function") prev.call(t, ev);
        } catch {
          /* ignore */
        }
        play();
      };
    });
  }, [stream, trackCount, volume, enabled]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: "none" }} aria-hidden="true" />;
}

/**
 * Multi-sharer screen stage — same UX as group/DM CallOverlay:
 * switch screens, volume, click-to-fullscreen.
 */
function ServerScreenShareStage({ sharers }) {
  const t = useT();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [volume, setVolume] = useState(100);
  const [aspectKey, setAspectKey] = useState("0x0");
  const prevCountRef = useRef(0);
  const normalVideoRef = useRef(null);
  const expandedVideoRef = useRef(null);

  useEffect(() => {
    const n = sharers.length;
    if (n > prevCountRef.current) {
      setSelectedIndex(n - 1);
    } else if (n > 0 && selectedIndex > n - 1) {
      setSelectedIndex(n - 1);
    }
    if (n === 0) setExpanded(false);
    prevCountRef.current = n;
  }, [sharers.length, selectedIndex]);

  const safeIndex = sharers.length ? Math.min(Math.max(selectedIndex, 0), sharers.length - 1) : 0;
  const active = sharers[safeIndex] || null;
  const screenStream = active?.stream || null;

  useEffect(() => {
    const track = screenStream?.getVideoTracks?.()[0];
    const settings = track?.getSettings?.() || {};
    const w = settings.width || 0;
    const h = settings.height || 0;
    if (w && h) setAspectKey(`${w}x${h}`);
  }, [screenStream]);

  const attachStream = useCallback((el, stream) => {
    if (!el) return;
    el.muted = true;
    if (!stream) {
      if (el.srcObject) el.srcObject = null;
      return;
    }
    if (el.srcObject !== stream) el.srcObject = stream;
    const playWhenReady = () => el.play().catch(() => {});
    const videoTracks = stream.getVideoTracks?.() || [];
    if (videoTracks.some((tr) => tr.muted || tr.readyState !== "live")) {
      videoTracks.forEach((tr) => {
        const prev = tr.onunmute;
        tr.onunmute = (ev) => {
          try {
            if (typeof prev === "function") prev.call(tr, ev);
          } catch {
            /* ignore */
          }
          playWhenReady();
        };
      });
    }
    playWhenReady();
  }, []);

  const normalVideoCallbackRef = useCallback(
    (el) => {
      normalVideoRef.current = el;
      if (el) attachStream(el, screenStream);
    },
    [screenStream, attachStream]
  );

  const expandedVideoCallbackRef = useCallback(
    (el) => {
      expandedVideoRef.current = el;
      if (el) attachStream(el, screenStream);
    },
    [screenStream, attachStream]
  );

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!sharers.length || !active) return null;

  const label = active.isLocal
    ? t("Your Screen")
    : t("{name}'s Screen", { name: active.username || "Member" });

  return (
    <div className="server-voice-screen-stage">
      {/* Durable remote screen audio — only active sharer is audible */}
      {sharers
        .filter((s) => !s.isLocal && s.stream)
        .map((s) => (
          <RemoteScreenAudioSink
            key={`screen-audio-${s.id}`}
            stream={s.stream}
            volume={volume}
            enabled={String(s.id) === String(active.id)}
          />
        ))}

      <div
        className="server-voice-screen"
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <video
          key={`${active.id}-${aspectKey}`}
          ref={normalVideoCallbackRef}
          className="server-voice-screen-video"
          autoPlay
          playsInline
          muted
        />

        {!streamHasLiveVideo(screenStream) && (
          <div className="server-voice-screen-waiting">{t("Waiting for screen…")}</div>
        )}

        <div className="server-voice-screen-badge" onClick={(e) => e.stopPropagation()}>
          <Monitor size={12} />
          <span>{label}</span>
        </div>

        {!active.isLocal && (
          <label className="server-voice-screen-volume" onClick={(e) => e.stopPropagation()}>
            <Volume2 size={14} aria-hidden="true" />
            <input
              aria-label={t("Screen share volume")}
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
            <span>{volume}%</span>
          </label>
        )}

        <div className="server-voice-screen-hint">
          {expanded ? t("Click to shrink") : t("Click to expand")}
        </div>

        {expanded && (
          <div
            className="server-voice-screen-expanded"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
          >
            <video
              key={`exp-${active.id}-${aspectKey}`}
              ref={expandedVideoCallbackRef}
              className="server-voice-screen-video"
              autoPlay
              playsInline
              muted
            />
            <div className="server-voice-screen-badge">
              <Monitor size={14} />
              <span>{label}</span>
            </div>
            {!active.isLocal && (
              <label
                className="server-voice-screen-volume is-expanded"
                onClick={(e) => e.stopPropagation()}
              >
                <Volume2 size={14} aria-hidden="true" />
                <input
                  aria-label={t("Screen share volume")}
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
                <span>{volume}%</span>
              </label>
            )}
            <div className="server-voice-screen-hint is-expanded">
              {t("Click anywhere to exit fullscreen")}
            </div>
          </div>
        )}
      </div>

      {sharers.length > 1 && (
        <div className="server-voice-screen-switcher">
          <span>{t("Screens:")}</span>
          {sharers.map((sharer, idx) => (
            <button
              key={sharer.id}
              type="button"
              className={`server-voice-screen-chip${idx === safeIndex ? " is-active" : ""}`}
              onClick={() => setSelectedIndex(idx)}
            >
              <Monitor size={12} />
              {sharer.isLocal
                ? t("Your Screen")
                : t("{name}'s Screen", { name: sharer.username || "Member" })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CameraTile({ stream, label, muted = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    if (stream) el.play?.().catch(() => {});
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="server-voice-camera-tile">
      <video
        ref={videoRef}
        className="server-voice-camera-video"
        autoPlay
        playsInline
        muted={muted}
      />
      <span className="server-voice-camera-label">{label}</span>
    </div>
  );
}

/**
 * Discord-like voice channel hangout panel.
 * Screen share matches group/DM voicechat: multi-sharer switch, volume, fullscreen.
 */
export default function ServerVoicePanel({
  channel,
  server,
  me,
  serverVoice,
}) {
  const t = useT();
  const inThis =
    serverVoice?.isInVoice &&
    serverVoice.activeChannelId === channel?.id;
  const isStage = channel?.type === "stage" || serverVoice?.channelType === "stage";
  const isStageSpeaker = !isStage || serverVoice?.stageRole === "speaker";
  const state =
    serverVoice?.voiceStatesByServer?.[server?.id]?.[channel?.id] || null;
  const remoteMembers = inThis
    ? serverVoice.participants || []
    : state?.members || [];
  const count = inThis
    ? (serverVoice.participants?.length || 0) + 1
    : state?.memberCount || 0;

  const canConnect = serverHasPermission(server, "CONNECT");
  const canStream = serverHasPermission(server, "STREAM");
  const canPublishMedia = Boolean(serverVoice?.canSpeak && isStageSpeaker);
  const canVideo = Boolean(canStream && serverVoice?.canStream && canPublishMedia);

  const screenSharers = useMemo(() => {
    if (!inThis) return [];
    const list = [];
    if (
      serverVoice?.isScreenSharing &&
      (streamHasLiveVideo(serverVoice.screenStream) || streamHasLiveAudio(serverVoice.screenStream))
    ) {
      list.push({
        id: "local",
        username: resolveDisplayName(me) || me?.username || t("You"),
        stream: serverVoice.screenStream,
        isLocal: true,
      });
    }
    for (const p of serverVoice?.participants || []) {
      if (!p?.screenStream) continue;
      const live =
        p.isScreenSharing ||
        streamHasLiveVideo(p.screenStream) ||
        streamHasLiveAudio(p.screenStream);
      if (!live) continue;
      list.push({
        id: p.id,
        username: resolveDisplayName(p) || p.username || "Member",
        stream: p.screenStream,
        isLocal: false,
      });
    }
    return list;
  }, [
    inThis,
    me,
    serverVoice?.isScreenSharing,
    serverVoice?.screenStream,
    serverVoice?.participants,
    t,
  ]);

  const cameraTiles = useMemo(() => {
    if (!inThis) return [];
    const tiles = [];
    if (serverVoice?.isCameraOn && serverVoice?.cameraStream) {
      tiles.push({ id: "local", stream: serverVoice.cameraStream, label: t("You"), muted: true });
    }
    for (const member of serverVoice?.participants || []) {
      if (!member?.cameraStream) continue;
      tiles.push({
        id: member.id,
        stream: member.cameraStream,
        label: resolveDisplayName(member) || member.username || "Member",
        muted: false,
      });
    }
    return tiles;
  }, [inThis, serverVoice?.cameraStream, serverVoice?.isCameraOn, serverVoice?.participants, t]);

  const onToggleScreen = async () => {
    if (!canVideo) return;
    if (serverVoice?.isScreenSharing) {
      await serverVoice.stopScreenShare?.();
    } else {
      await serverVoice.startScreenShare?.();
    }
  };

  const onToggleCamera = async () => {
    if (!canVideo) return;
    await serverVoice?.toggleCamera?.();
  };

  return (
    <div className="server-voice-panel">
      <div className="server-voice-hero">
        <span className="server-voice-hero-icon" aria-hidden>
          {isStage ? <Radio size={36} strokeWidth={1.5} /> : <Headphones size={36} strokeWidth={1.5} />}
        </span>
        <h2>
          {channel?.name || t("Voice channel")}
          {isStage ? <span className="server-stage-pill">{t("Stage")}</span> : null}
        </h2>
        <p>
          {count > 0
            ? isStage
              ? t("{count} in stage", { count })
              : t("{count} in voice", { count })
            : isStage
              ? t("Join as audience, then request to speak.")
              : t("Join to talk — no ringing, drop in anytime.")}
        </p>
        {serverVoice?.mediaMode === "sfu" ? (
          <p className="server-media-mode">{t("SFU voice enabled")}</p>
        ) : null}
        {channel?.topic ? <p className="server-channel-topic">{channel.topic}</p> : null}
        {serverVoice?.error ? <p className="server-modal-error">{serverVoice.error}</p> : null}
      </div>

      {screenSharers.length > 0 ? <ServerScreenShareStage sharers={screenSharers} /> : null}

      {cameraTiles.length > 0 ? (
        <div className="server-voice-camera-grid">
          {cameraTiles.map((tile) => (
            <CameraTile key={tile.id} stream={tile.stream} label={tile.label} muted={tile.muted} />
          ))}
        </div>
      ) : null}

      <div className="server-voice-controls">
        {inThis ? (
          <>
            <button
              type="button"
              className={`server-voice-btn ${serverVoice.muted ? "is-off" : ""}`}
              onClick={() => serverVoice.toggleMute?.()}
              disabled={!serverVoice.canSpeak}
              title={!serverVoice.canSpeak ? t("You need to be invited to speak first.") : undefined}
            >
              {serverVoice.muted ? <MicOff size={16} /> : <Mic size={16} />}
              {serverVoice.muted ? t("Unmute") : t("Mute")}
            </button>
            {isNoiseSuppressionEnabled() ? (
              <span className="server-voice-ns-badge" title={t("AI noise suppression")}>
                NS
              </span>
            ) : null}
            {isStage && serverVoice.stageRole !== "speaker" ? (
              <button
                type="button"
                className={`server-voice-btn ${serverVoice.requestedToSpeak ? "is-screen-on" : ""}`}
                onClick={() => serverVoice.requestToSpeak?.()}
                disabled={!serverVoice.canRequestToSpeak || serverVoice.requestedToSpeak}
                title={!serverVoice.canRequestToSpeak ? t("Permission denied") : undefined}
              >
                <Radio size={16} />
                {serverVoice.requestedToSpeak ? t("Requested") : t("Request to Speak")}
              </button>
            ) : null}
            <button
              type="button"
              className={`server-voice-btn ${serverVoice.isCameraOn ? "is-screen-on" : ""}`}
              onClick={onToggleCamera}
              disabled={!canVideo}
              title={!canVideo ? t("Permission denied") : serverVoice.isCameraOn ? t("Turn Camera Off") : t("Turn Camera On")}
            >
              {serverVoice.isCameraOn ? <VideoOff size={16} /> : <Video size={16} />}
              {serverVoice.isCameraOn ? t("Camera Off") : t("Camera")}
            </button>
            <button
              type="button"
              className={`server-voice-btn ${serverVoice.isScreenSharing ? "is-screen-on" : ""}`}
              onClick={onToggleScreen}
              disabled={!canVideo}
              title={
                !canVideo
                  ? t("Permission denied")
                  : serverVoice.isScreenSharing
                    ? t("Stop Screen Share")
                    : t("Share Screen")
              }
            >
              {serverVoice.isScreenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
              {serverVoice.isScreenSharing ? t("Stop Screen Share") : t("Share Screen")}
            </button>
            <button
              type="button"
              className="server-voice-btn leave"
              onClick={() => serverVoice.leave?.()}
            >
              <LogOut size={16} />
              {t("Leave")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="server-voice-btn join"
            disabled={!canConnect || serverVoice?.connecting}
            onClick={() => serverVoice.join?.(server.id, channel)}
          >
            <LogIn size={16} />
            {serverVoice?.connecting
              ? t("Please wait...")
              : count > 0
                ? t("Join Voice")
                : t("Join Voice")}
          </button>
        )}
      </div>

      <div className="server-voice-members">
        <div className="server-voice-members-head">
          <Users size={14} />
          <span>{t("In this channel")}</span>
        </div>
        <div className="server-voice-members-list">
          {inThis && me && (
            <VoiceMemberRow
              member={me}
              label={`${resolveDisplayName(me)} (${t("You")})`}
              stream={serverVoice.localStream}
              muted={serverVoice.muted}
              sharing={Boolean(serverVoice.isScreenSharing)}
              cameraOn={Boolean(serverVoice.isCameraOn)}
            />
          )}
          {remoteMembers.map((m) => {
            const stream =
              inThis
                ? m.stream || serverVoice.remoteStreams?.get?.(m.id) || null
                : null;
            return (
              <VoiceMemberRow
                key={m.id}
                member={m}
                stream={stream}
                muted={m.muted}
                sharing={Boolean(m.isScreenSharing)}
                cameraOn={Boolean(m.cameraOn)}
              />
            );
          })}
          {!inThis && remoteMembers.length === 0 && (
            <p className="server-empty-hint">{t("Nobody here yet")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
