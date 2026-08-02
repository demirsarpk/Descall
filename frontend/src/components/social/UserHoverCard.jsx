import { motion } from "framer-motion";
import { Avatar } from "../ui/Avatar";
import { resolveDisplayName } from "../../lib/userProfile";

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
    return new Date(iso).toLocaleString();
  } catch {
    return null;
  }
}

export default function UserHoverCard({ user, style }) {
  if (!user) return null;
  const st = STATUS[user.status] || STATUS.offline;
  const lastSeenLabel = user.lastSeen ? formatLastSeen(user.lastSeen) : null;
  const display = resolveDisplayName(user);
  const banner = user.bannerUrl || user.banner_url;
  const bio = user.bio;
  const customStatus = user.customStatus || user.custom_status;

  return (
    <motion.div
      className="user-hover-card glass"
      style={style}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <div
        className="uhc-banner"
        style={
          banner
            ? { backgroundImage: `url(${banner})` }
            : undefined
        }
      />
      <div className="uhc-body">
        <Avatar name={display} size={56} user={user} />
        <div className="uhc-text">
          <div className="uhc-name">{display}</div>
          <div className="uhc-handle">@{user.username || "user"}</div>
          <div className={`uhc-status ${st.className}`}>
            <span className="uhc-dot" /> {st.label}
          </div>
          {customStatus && <p className="uhc-custom-status">{customStatus}</p>}
          {bio && <p className="uhc-bio">{bio}</p>}
          {!bio && lastSeenLabel && st.className === "st-offline" && (
            <p className="uhc-bio">Last seen {lastSeenLabel}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
