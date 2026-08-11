import { motion } from "framer-motion";
import Modal from "../ui/Modal";
import { Avatar } from "../ui/Avatar";
import { getPresenceStatus, STATUS_META } from "../../lib/presence";

export default function UserProfilePopover({ open, onClose, user, onlineUsers }) {
  const userId = user?.userId || user?.id;
  const status = getPresenceStatus(onlineUsers, userId);
  return (
    <Modal open={open} onClose={onClose} title="Profile" wide>
      {user && (
        <motion.div
          className="profile-popover"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="profile-banner" />
          <div className="profile-main">
            <Avatar name={user.username} size={72} user={user} />
            <div>
              <div className="profile-name">{user.username}</div>
              <div className="profile-status-line">
                <span className={`status-dot ${status}`} />
                {STATUS_META[status]?.label || STATUS_META.offline.label}
              </div>
              {userId && <div className="profile-id">ID · {String(userId).slice(0, 8)}…</div>}
            </div>
          </div>
        </motion.div>
      )}
    </Modal>
  );
}
