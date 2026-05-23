/**
 * COMPLETELY REBUILT STATUS BADGE
 * Discord-style online status indicator
 * No old layout remnants
 */
export default function StatusBadge({ status = "offline" }) {
  const statusColors = {
    online: "#23a55a",
    idle: "#f0b232",
    dnd: "#f23f43",
    offline: "#80848e"
  };

  return (
    <span 
      className="status-badge"
      style={{
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        backgroundColor: statusColors[status] || statusColors.offline,
        borderRadius: "50%",
        border: "3px solid var(--surface-0)",
        flexShrink: 0
      }}
      title={status}
    />
  );
}
