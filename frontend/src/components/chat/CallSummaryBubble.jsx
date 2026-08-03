import { Video, Phone, Users, Clock } from "lucide-react";
import { useT } from "../../context/LocaleContext";

/**
 * WhatsApp-style ended call summary bubble rendered inside the message list.
 */
export default function CallSummaryBubble({ summary }) {
  const t = useT();
  if (!summary) return null;

  const isVideo = summary.callType === "video";
  const mins = summary.durationMinutes ?? Math.floor((summary.durationSeconds ?? 0) / 60);
  const secs = (summary.durationSeconds ?? 0) % 60;

  const durationLabel =
    mins > 0
      ? `${mins}m${secs > 0 ? ` ${secs}s` : ""}`
      : secs > 0
      ? `${secs}s`
      : t("< 1s");

  const timeLabel = summary.endedAt
    ? new Date(summary.endedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="call-summary-wrap">
      <div className="call-summary-card">
        <div className="call-summary-icon">
          {isVideo ? <Video size={22} /> : <Phone size={22} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="call-summary-title">
            {isVideo ? t("Video call") : t("Voice call")}
          </div>
          <div className="call-summary-meta">
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} />
              <span>{durationLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={11} />
              <span>
                {t("{count} participants joined", { count: summary.participantCount ?? 0 })}
              </span>
            </div>
          </div>
          {summary.initiatorUsername && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
              {t("Started by {name}", { name: summary.initiatorUsername })}
            </div>
          )}
        </div>

        {timeLabel && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "flex-end", flexShrink: 0 }}>
            {timeLabel}
          </span>
        )}
      </div>
    </div>
  );
}
