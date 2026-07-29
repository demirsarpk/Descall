import { motion } from "framer-motion";
import Modal from "../ui/Modal";
import { Avatar } from "../ui/Avatar";

const STATUS_LABEL = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
  offline: "Offline",
};

export default function UserProfilePopover({ open, onClose, user, onlineUsers }) {
  const presence = onlineUsers?.find(
    (u) => u.id === user?.userId || u.username === user?.username,
  );
  const status = presence?.status || "offline";
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
                {STATUS_LABEL[status] || STATUS_LABEL.offline}
              </div>
              {user.userId && <div className="profile-id">ID · {user.userId.slice(0, 8)}…</div>}
            </div>
          </div>
        </motion.div>
      )}
    </Modal>
  );
}
