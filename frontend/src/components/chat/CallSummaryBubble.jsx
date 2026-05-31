import { Video, Phone, Users, Clock } from "lucide-react";

/**
 * WhatsApp-style ended call summary bubble rendered inside the message list.
 * Shown after a group call ends.
 */
export default function CallSummaryBubble({ summary }) {
  if (!summary) return null;

  const isVideo = summary.callType === "video";
  const mins = summary.durationMinutes ?? Math.floor((summary.durationSeconds ?? 0) / 60);
  const secs = (summary.durationSeconds ?? 0) % 60;

  const durationLabel =
    mins > 0
      ? `${mins} dk.${secs > 0 ? ` ${secs} sn.` : ""}`
      : secs > 0
      ? `${secs} sn.`
      : "< 1 sn.";

  const timeLabel = summary.endedAt
    ? new Date(summary.endedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "6px 16px",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          background: "var(--surface-2, #2b2d33)",
          border: "1px solid var(--border, rgba(255,255,255,0.07))",
          borderRadius: 14,
          padding: "12px 18px",
          maxWidth: 340,
          width: "100%",
        }}
      >
        {/* Icon block */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isVideo ? (
            <Video size={22} color="#b5bac1" />
          ) : (
            <Phone size={22} color="#b5bac1" />
          )}
        </div>

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            {isVideo ? "Görüntülü arama" : "Sesli arama"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} color="#b5bac1" />
              <span style={{ fontSize: 12, color: "#b5bac1" }}>{durationLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={11} color="#b5bac1" />
              <span style={{ fontSize: 12, color: "#b5bac1" }}>
                {summary.participantCount} kişi katıldı
              </span>
            </div>
          </div>
          {summary.initiatorUsername && (
            <div style={{ fontSize: 11, color: "#72767d", marginTop: 3 }}>
              {summary.initiatorUsername} başlattı
            </div>
          )}
        </div>

        {/* Timestamp */}
        {timeLabel && (
          <span
            style={{
              fontSize: 11,
              color: "#72767d",
              alignSelf: "flex-end",
              flexShrink: 0,
            }}
          >
            {timeLabel}
          </span>
        )}
      </div>
    </div>
  );
}
