/**
 * Discord-style online status indicator
 */
import { useT } from "../../context/LocaleContext";

const STATUS_LABELS = {
  online: "Online",
  away: "Away",
  idle: "Away",
  busy: "Busy",
  dnd: "Do Not Disturb",
  offline: "Offline",
  invisible: "Invisible",
};

export default function StatusBadge({ status = "offline" }) {
  const t = useT();
  if (!status || status === "offline" || status === "invisible") return null;

  const label = t(STATUS_LABELS[status] || status);

  return (
    <span
      className={`status-badge status-${status}`}
      title={label}
      aria-label={label}
    />
  );
}
