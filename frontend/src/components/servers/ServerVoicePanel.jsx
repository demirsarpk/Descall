import { useEffect, useMemo, useRef } from "react";
import { Headphones, LogIn, LogOut, Mic, MicOff, Monitor, MonitorOff, Users } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";
import { resolveDisplayName } from "../../lib/userProfile";
import useSpeaking from "../../hooks/useSpeaking";

function VoiceMemberRow({ member, label, stream = null, muted = false, micIcon = true, sharing = false }) {
  const speaking = useSpeaking(stream, { muted: Boolean(muted) });
  const name = label || resolveDisplayName(member) || member?.username || "User";
  return (
    <div
      className={`server-voice-member${muted ? " is-muted" : ""}${speaking ? " is-speaking" : ""}`}
    >
      <Avatar name={name} size={32} user={member} className="server-voice-member-avatar" />
      <span>{name}</span>
      {sharing ? <Monitor size={12} className="server-voice-member-screen" /> : null}
      {micIcon ? muted ? <MicOff size={12} /> : <Mic size={12} /> : null}
    </div>
  );
}

function ScreenStage({ stream, label }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream || null;
    }
    if (stream) {
      el.play?.().catch(() => {});
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="server-voice-screen">
      <div className="server-voice-screen-badge">
        <Monitor size={12} />
        <span>{label}</span>
      </div>
      <video
        ref={videoRef}
        className="server-voice-screen-video"
        autoPlay
        playsInline
        muted
      />
    </div>
  );
}

/**
 * Discord-like voice channel hangout panel (Step 10).
 * Screen share uses the same WebRTC mesh path as group/DM voicechat.
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
  const state =
    serverVoice?.voiceStatesByServer?.[server?.id]?.[channel?.id] || null;
  const remoteMembers = inThis
    ? serverVoice.participants || []
    : state?.members || [];
  const count = inThis
    ? (serverVoice.participants?.length || 0) + 1
    : state?.memberCount || 0;

  const canConnect = Boolean(
    server?.isOwner ||
      server?.myPermissions?.flags?.CONNECT ||
      server?.myPermissions?.flags?.ADMINISTRATOR
  );

  const canStream = Boolean(
    server?.isOwner ||
      server?.myPermissions?.flags?.STREAM ||
      server?.myPermissions?.flags?.ADMINISTRATOR ||
      server?.myPermissions?.flags?.VIDEO
  );

  const activeScreen = useMemo(() => {
    if (!inThis) return null;
    if (serverVoice?.isScreenSharing && serverVoice?.screenStream) {
      return {
        stream: serverVoice.screenStream,
        label: t("Your Screen"),
        local: true,
      };
    }
    const remote = (serverVoice?.participants || []).find(
      (p) => p.isScreenSharing && p.screenStream
    );
    if (remote?.screenStream) {
      return {
        stream: remote.screenStream,
        label: t("{name}'s Screen", {
          name: resolveDisplayName(remote) || remote.username || "Member",
        }),
        local: false,
      };
    }
    return null;
  }, [
    inThis,
    serverVoice?.isScreenSharing,
    serverVoice?.screenStream,
    serverVoice?.participants,
    t,
  ]);

  const onToggleScreen = async () => {
    if (!canStream) return;
    if (serverVoice?.isScreenSharing) {
      await serverVoice.stopScreenShare?.();
    } else {
      await serverVoice.startScreenShare?.();
    }
  };

  return (
    <div className="server-voice-panel">
      <div className="server-voice-hero">
        <span className="server-voice-hero-icon" aria-hidden>
          <Headphones size={36} strokeWidth={1.5} />
        </span>
        <h2>{channel?.name || t("Voice channel")}</h2>
        <p>
          {count > 0
            ? t("{count} in voice", { count })
            : t("Join to talk — no ringing, drop in anytime.")}
        </p>
        {channel?.topic ? <p className="server-channel-topic">{channel.topic}</p> : null}
        {serverVoice?.error ? <p className="server-modal-error">{serverVoice.error}</p> : null}
      </div>

      {activeScreen ? (
        <ScreenStage stream={activeScreen.stream} label={activeScreen.label} />
      ) : null}

      <div className="server-voice-controls">
        {inThis ? (
          <>
            <button
              type="button"
              className={`server-voice-btn ${serverVoice.muted ? "is-off" : ""}`}
              onClick={() => serverVoice.toggleMute?.()}
            >
              {serverVoice.muted ? <MicOff size={16} /> : <Mic size={16} />}
              {serverVoice.muted ? t("Unmute") : t("Mute")}
            </button>
            <button
              type="button"
              className={`server-voice-btn ${serverVoice.isScreenSharing ? "is-screen-on" : ""}`}
              onClick={onToggleScreen}
              disabled={!canStream}
              title={
                !canStream
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
