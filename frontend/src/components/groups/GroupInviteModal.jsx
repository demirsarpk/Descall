import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Copy, Check, RefreshCw, Users } from "lucide-react";
import { createGroupInviteLink } from "../../api/groups";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";

const EXPIRY_OPTIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
  { hours: 0, label: "Never" },
];

export default function GroupInviteModal({ group, open, onClose }) {
  const t = useT();
  const [expiresInHours, setExpiresInHours] = useState(24 * 7);
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !group?.id) return;
    setInvite(null);
    setError("");
    setCopied(false);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await createGroupInviteLink(group.id, {
          expiresInHours: expiresInHours || null,
          maxUses: null,
        });
        if (!cancelled) setInvite(res.invite);
      } catch (err) {
        if (!cancelled) setError(err.message || t("Could not create invite"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, group?.id, t]);

  const regenerate = async (hours = expiresInHours) => {
    if (!group?.id) return;
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const res = await createGroupInviteLink(group.id, {
        expiresInHours: hours || null,
        maxUses: null,
      });
      setInvite(res.invite);
    } catch (err) {
      setError(err.message || t("Could not create invite"));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    const url = invite?.url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(t("Could not copy to clipboard"));
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="invite-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
        <motion.div
          className="invite-modal"
          role="dialog"
          aria-label={t("Invite people")}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="invite-modal-header">
            <div>
              <h2>{t("Invite people")}</h2>
              <p>{t("Share a link — friends can join this group instantly")}</p>
            </div>
            <button type="button" className="invite-modal-close" onClick={onClose} aria-label={t("Close")}>
              <X size={18} />
            </button>
          </header>

          <div className="invite-modal-group">
            <Avatar name={group?.name || t("Group")} size={44} user={group} />
            <div>
              <strong>{group?.name || t("Group")}</strong>
              <span>
                <Users size={12} />
                {group?.memberCount != null
                  ? t("{count} members", { count: group.memberCount })
                  : t("Group chat")}
              </span>
            </div>
          </div>

          <label className="invite-modal-label">{t("Expire after")}</label>
          <div className="invite-expiry-row">
            {EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                className={expiresInHours === opt.hours ? "active" : ""}
                onClick={() => {
                  setExpiresInHours(opt.hours);
                  regenerate(opt.hours);
                }}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>

          <label className="invite-modal-label">{t("Invite link")}</label>
          <div className="invite-link-row">
            <div className="invite-link-box">
              <Link2 size={16} />
              <span>{loading ? t("Creating link…") : invite?.url || "—"}</span>
            </div>
            <button
              type="button"
              className={`invite-copy-btn ${copied ? "is-copied" : ""}`}
              onClick={copy}
              disabled={!invite?.url || loading}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t("Copied") : t("Copy")}
            </button>
          </div>

          <button
            type="button"
            className="invite-regen-btn"
            onClick={() => regenerate()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : undefined} />
            {t("Generate new link")}
          </button>

          {error && <div className="invite-modal-error">{error}</div>}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
