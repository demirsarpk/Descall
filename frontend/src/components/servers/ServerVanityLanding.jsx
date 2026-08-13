import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Server, Loader2, LogIn, CheckCircle2, AlertTriangle } from "lucide-react";
import { previewServerVanity, joinServerByVanity } from "../../api/servers";
import { getToken } from "../../lib/storage";
import { useT } from "../../context/LocaleContext";

/**
 * Landing page for /s/:vanitySlug server vanity URLs.
 */
export default function ServerVanityLanding({ slug, me, onJoined, onNeedLogin, onDismiss }) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await previewServerVanity(slug);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) setError(err.message || t("Server not found"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  const handleJoin = async () => {
    if (!getToken()) {
      try {
        sessionStorage.setItem("descall:pendingServerVanity", slug);
      } catch {
        /* ignore */
      }
      onNeedLogin?.(slug);
      return;
    }
    setJoining(true);
    setError("");
    try {
      const res = await joinServerByVanity(slug);
      onJoined?.(res.server);
    } catch (err) {
      setError(err.message || t("Could not join server"));
    } finally {
      setJoining(false);
    }
  };

  const server = preview?.server;

  return (
    <div className="invite-landing">
      <motion.div
        className="invite-landing-card"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="invite-landing-brand">Descall</div>
        <h1>{t("You've been invited to join a server")}</h1>

        {loading ? (
          <div className="invite-landing-state">
            <Loader2 size={28} className="spin" />
            <span>{t("Loading invite…")}</span>
          </div>
        ) : error && !server ? (
          <div className="invite-landing-state error">
            <AlertTriangle size={28} />
            <span>{error}</span>
            <button type="button" className="invite-landing-btn ghost" onClick={onDismiss}>
              {t("Dismiss")}
            </button>
          </div>
        ) : (
          <>
            <div className="invite-landing-preview">
              {server?.iconUrl ? (
                <img src={server.iconUrl} alt="" className="invite-landing-avatar" />
              ) : (
                <div className="invite-landing-avatar fallback">
                  <Server size={28} />
                </div>
              )}
              <div>
                <strong>{server?.name || t("Server")}</strong>
                <span>
                  {t("{count} members", { count: server?.memberCount ?? 0 })}
                  {server?.isMember ? ` · ${t("Already a member")}` : ""}
                </span>
              </div>
            </div>
            {error ? <p className="invite-landing-error">{error}</p> : null}
            <div className="invite-landing-actions">
              <button type="button" className="invite-landing-btn ghost" onClick={onDismiss}>
                {t("Not now")}
              </button>
              <button
                type="button"
                className="invite-landing-btn primary"
                disabled={joining}
                onClick={handleJoin}
              >
                {joining ? (
                  <Loader2 size={18} className="spin" />
                ) : server?.isMember ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <LogIn size={18} />
                )}
                {joining
                  ? t("Joining…")
                  : server?.isMember
                    ? t("Open server")
                    : me
                      ? t("Accept Invite")
                      : t("Log in to join")}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
