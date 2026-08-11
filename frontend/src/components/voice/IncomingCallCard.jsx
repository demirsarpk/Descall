import { motion } from "framer-motion";
import { Phone, PhoneOff, Video, Users } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";

/**
 * FaceTime-style incoming call card — large avatar + ripple rings.
 * Replaces the old icon-only / small-avatar banners.
 */
export default function IncomingCallCard({
  username,
  user,
  callType = "voice",
  subtitle,
  isGroup = false,
  onAccept,
  onDecline,
}) {
  const t = useT();
  const isVideo = callType === "video";
  const name = username || user?.username || t("Someone");

  return (
    <motion.div
      className="incoming-call-card"
      initial={{ opacity: 0, y: -48, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -48, scale: 0.96 }}
      transition={{ type: "spring", damping: 24, stiffness: 280 }}
    >
      <div className="incoming-call-avatar-wrap">
        <span className="incoming-call-ring incoming-call-ring--a" aria-hidden />
        <span className="incoming-call-ring incoming-call-ring--b" aria-hidden />
        <span className="incoming-call-ring incoming-call-ring--c" aria-hidden />
        <motion.div
          className="incoming-call-avatar"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <Avatar name={name} size={72} user={user} />
        </motion.div>
        <div className={`incoming-call-badge ${isVideo ? "is-video" : "is-voice"}`}>
          {isVideo ? <Video size={13} color="#fff" /> : <Phone size={13} color="#fff" />}
        </div>
      </div>

      <div className="incoming-call-meta">
        <div className="incoming-call-kind">
          {isVideo ? t("Incoming video call") : t("Incoming voice call")}
        </div>
        <div className="incoming-call-name">{t("{name} is calling", { name })}</div>
        {(subtitle || isGroup) && (
          <div className="incoming-call-sub">
            {isGroup && <Users size={12} />}
            <span>{subtitle || t("Group call")}</span>
          </div>
        )}
      </div>

      <div className="incoming-call-actions">
        <motion.button
          type="button"
          className="incoming-call-btn incoming-call-btn--decline"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={onDecline}
          title={t("Decline")}
        >
          <PhoneOff size={22} />
        </motion.button>
        <motion.button
          type="button"
          className="incoming-call-btn incoming-call-btn--accept"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAccept}
          title={t("Accept")}
        >
          <Phone size={22} />
        </motion.button>
      </div>
    </motion.div>
  );
}
