/**
 * Discord-style online status indicator
 */
export default function StatusBadge({ status = "offline" }) {
  if (!status || status === "offline" || status === "invisible") return null;

  return (
    <span
      className={`status-badge status-${status}`}
      title={status}
      aria-label={status}
    />
  );
}
