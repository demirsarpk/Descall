import { Video, Phone, Users, Clock } from "lucide-react";

/**
 * WhatsApp-style ended call summary bubble rendered inside the message list.
 */
export default function CallSummaryBubble({ summary }) {
  if (!summary) return null;

  const isVideo = summary.callType === "video";
  const mins = summary.durationMinutes ?? Math.floor((summary.durationSeconds ?? 0) / 60);
  const secs = (summary.durationSeconds ?? 0) % 60;

  const durationLabel =
    mins > 0
      ? `${mins}m${secs > 0 ? ` ${secs}s` : ""}`
      : secs > 0
      ? `${secs}s`
      : "< 1s";

  const timeLabel = summary.endedAt
    ? new Date(summary.endedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="call-summary-wrap">
      <div className="call-summary-card">
        <div className="call-summary-icon">
          {isVideo ? <Video size={22} /> : <Phone size={22} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="call-summary-title">
            {isVideo ? "Video call" : "Voice call"}
          </div>
          <div className="call-summary-meta">
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} />
              <span>{durationLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={11} />
              <span>
                {summary.participantCount} participant{summary.participantCount !== 1 ? "s" : ""} joined
              </span>
            </div>
          </div>
          {summary.initiatorUsername && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
              Started by {summary.initiatorUsername}
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
