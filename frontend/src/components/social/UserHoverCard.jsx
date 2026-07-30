import { motion } from "framer-motion";
import { Avatar } from "../ui/Avatar";

const STATUS = {
  online: { label: "Online", className: "st-online" },
  idle: { label: "Idle", className: "st-idle" },
  dnd: { label: "Do Not Disturb", className: "st-dnd" },
  invisible: { label: "Invisible", className: "st-invisible" },
  offline: { label: "Offline", className: "st-offline" },
};

function formatLastSeen(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return null;
  }
}

export default function UserHoverCard({ user, style }) {
  if (!user) return null;
  const st = STATUS[user.status] || STATUS.offline;
  const lastSeenLabel = user.lastSeen ? formatLastSeen(user.lastSeen) : null;
  return (
    <motion.div
      className="user-hover-card glass"
      style={style}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <div className="uhc-banner" />
      <div className="uhc-body">
        <Avatar name={user.username} size={56} user={user} />
        <div className="uhc-text">
          <div className="uhc-name">{user.username}</div>
          <div className={`uhc-status ${st.className}`}>
            <span className="uhc-dot" /> {st.label}
          </div>
          {lastSeenLabel && st.className === "st-offline" && (
            <p className="uhc-bio">Last seen {lastSeenLabel}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
