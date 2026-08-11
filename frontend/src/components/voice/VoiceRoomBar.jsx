import { Headphones, LogIn, LogOut, Users } from "lucide-react";
import { useT } from "../../context/LocaleContext";

/**
 * Persistent hangout voice room strip for group chats.
 * Join silently (no ring) or leave without ending the room for others.
 */
export default function VoiceRoomBar({
  groupId,
  banner = null,
  isInThisRoom = false,
  onJoin,
  onLeave,
}) {
  const t = useT();
  if (!groupId) return null;

  const active = Boolean(banner?.groupId === groupId);
  const count = active ? banner.participantCount || banner.participants?.length || 0 : 0;

  return (
    <div className={`voice-room-bar ${active ? "is-live" : ""} ${isInThisRoom ? "is-joined" : ""}`}>
      <div className="voice-room-bar-main">
        <span className="voice-room-bar-icon" aria-hidden>
          <Headphones size={16} />
        </span>
        <div className="voice-room-bar-copy">
          <strong>{t("Voice Room")}</strong>
          <span>
            {active
              ? t("{count} people", { count })
              : t("Drop in anytime — no ringing")}
          </span>
        </div>
      </div>
      <div className="voice-room-bar-actions">
        {active && (
          <span className="voice-room-bar-count" title={t("People in voice")}>
            <Users size={14} />
            {count}
          </span>
        )}
        {isInThisRoom ? (
          <button type="button" className="voice-room-bar-btn leave" onClick={onLeave}>
            <LogOut size={14} />
            {t("Leave")}
          </button>
        ) : (
          <button type="button" className="voice-room-bar-btn join" onClick={onJoin}>
            <LogIn size={14} />
            {active ? t("Join") : t("Join Voice")}
          </button>
        )}
      </div>
    </div>
  );
}
