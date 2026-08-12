import { Headphones, LogIn, LogOut, Mic, MicOff, Users } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";
import { resolveDisplayName } from "../../lib/userProfile";

/**
 * Discord-like voice channel hangout panel (Step 10).
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
            <div className={`server-voice-member ${serverVoice.muted ? "is-muted" : ""}`}>
              <Avatar name={resolveDisplayName(me)} size={32} user={me} />
              <span>{resolveDisplayName(me)} ({t("You")})</span>
              {serverVoice.muted ? <MicOff size={12} /> : <Mic size={12} />}
            </div>
          )}
          {remoteMembers.map((m) => {
            const name = resolveDisplayName(m);
            return (
              <div key={m.id} className={`server-voice-member ${m.muted ? "is-muted" : ""}`}>
                <Avatar name={name} size={32} user={m} />
                <span>{name}</span>
                {m.muted ? <MicOff size={12} /> : <Mic size={12} />}
              </div>
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
