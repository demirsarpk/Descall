import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Loader2, LogIn, CheckCircle2, AlertTriangle } from "lucide-react";
import { previewGroupInvite, joinGroupByInvite } from "../../api/groups";
import { getToken } from "../../lib/storage";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";

/**
 * Discord-style invite landing — shown for /invite/:code
 */
export default function GroupInviteLanding({
  code,
  me,
  onJoined,
  onNeedLogin,
  onDismiss,
}) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await previewGroupInvite(code);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) setError(err.message || t("Invite not found"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, t]);

  const handleJoin = async () => {
    if (!getToken()) {
      try {
        sessionStorage.setItem("descall:pendingInvite", code);
      } catch { /* ignore */ }
      onNeedLogin?.(code);
      return;
    }
    setJoining(true);
    setError("");
    try {
      const res = await joinGroupByInvite(code);
      onJoined?.(res.group);
    } catch (err) {
      setError(err.message || t("Could not join group"));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="invite-landing">
      <motion.div
        className="invite-landing-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="invite-landing-brand">Descall</div>
        <h1>{t("You've been invited to join a group")}</h1>

        {loading ? (
          <div className="invite-landing-state">
            <Loader2 size={28} className="spin" />
            <span>{t("Loading invite…")}</span>
          </div>
        ) : error && !preview ? (
          <div className="invite-landing-state is-error">
            <AlertTriangle size={28} />
            <p>{error}</p>
            <button type="button" className="invite-landing-secondary" onClick={onDismiss}>
              {t("Back to Descall")}
            </button>
          </div>
        ) : (
          <>
            <div className="invite-landing-group">
              <Avatar
                name={preview?.group?.name || t("Group")}
                size={72}
                user={{ avatarUrl: preview?.group?.avatarUrl, username: preview?.group?.name }}
              />
              <div>
                <strong>{preview?.group?.name}</strong>
                <span>
                  <Users size={14} />
                  {t("{count} members", { count: preview?.group?.memberCount ?? 0 })}
                </span>
              </div>
            </div>

            {preview?.alreadyMember ? (
              <div className="invite-landing-banner is-ok">
                <CheckCircle2 size={16} />
                {t("You're already a member of this group")}
              </div>
            ) : null}

            {error ? <div className="invite-landing-error">{error}</div> : null}

            <button
              type="button"
              className="invite-landing-join"
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <Loader2 size={18} className="spin" />
              ) : me ? (
                preview?.alreadyMember ? t("Open group") : t("Accept invite")
              ) : (
                <>
                  <LogIn size={18} />
                  {t("Log in to join")}
                </>
              )}
            </button>

            <button type="button" className="invite-landing-secondary" onClick={onDismiss}>
              {me ? t("Maybe later") : t("Back")}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
