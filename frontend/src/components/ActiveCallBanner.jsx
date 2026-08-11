import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, LogIn, X } from "lucide-react";
import { Avatar } from "./ui/Avatar";
import { useT } from "../context/LocaleContext";

/**
 * Ongoing call bubble — same shape as CallSummaryBubble but green/live.
 */
export default function ActiveCallBanner({ banner, onJoin, onDismiss }) {
  const t = useT();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!banner) { setElapsed(0); return; }
    const base = banner.startTime ? Math.floor((Date.now() - banner.startTime) / 1000) : 0;
    setElapsed(Math.max(0, base));
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [banner?.groupId]);

  if (!banner) return null;

  const isVideo = banner.callType === "video";
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");
  const durationLabel = `${mins}:${secs}`;
  const participantCount = banner.participantCount ?? 1;

  return (
    <AnimatePresence>
      <motion.div
        key="active-call-banner"
        className="call-banner-wrap"
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="call-banner-card">
          <div style={{ flexShrink: 0 }}>
            <Avatar
              name={banner.initiatorUsername || "?"}
              size={44}
              user={banner}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="call-banner-title">
              {banner.hangout
                ? t("Voice Room")
                : isVideo
                  ? t("Video call")
                  : t("Voice call")}
            </div>
            <div className="call-banner-meta">
              <span className="call-banner-live">{durationLabel}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={11} />
                <span>
                  {t("{count} participants joined", { count: participantCount })}
                </span>
              </div>
            </div>
            {banner.initiatorUsername && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                {t("Started by {name}", { name: banner.initiatorUsername })}
              </div>
            )}
          </div>

          <motion.button
            type="button"
            className="call-banner-join"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={onJoin}
          >
            <LogIn size={14} />
            {t("Join")}
          </motion.button>

          {onDismiss && (
            <button type="button" className="call-banner-dismiss" onClick={onDismiss} aria-label={t("Dismiss")}>
              <X size={13} />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
