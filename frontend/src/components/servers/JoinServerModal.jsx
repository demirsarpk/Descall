import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass, LogIn, Server } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import {
  previewServerInvite,
  joinServerByInvite,
  discoverPublicServers,
  joinPublicServer,
} from "../../api/servers";

/**
 * Join via invite code + browse public servers.
 */
export default function JoinServerModal({ onClose, onJoined }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("invite"); // invite | discover
  const [publicServers, setPublicServers] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverQ, setDiscoverQ] = useState("");

  const normalizeCode = (raw) => {
    const s = String(raw || "").trim();
    const fromUrl = s.match(/\/servers\/join\/([A-Za-z0-9_-]+)/);
    if (fromUrl) return fromUrl[1];
    const fromInvite = s.match(/\/invite\/s\/([A-Za-z0-9_-]+)/);
    if (fromInvite) return fromInvite[1];
    return s.replace(/^@/, "").split("/").pop();
  };

  useEffect(() => {
    if (tab !== "discover") return undefined;
    let cancelled = false;
    const run = async () => {
      setDiscoverLoading(true);
      try {
        const data = await discoverPublicServers({ q: discoverQ.trim() || undefined, limit: 24 });
        if (!cancelled) setPublicServers(data?.servers || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || t("Failed to join server"));
      } finally {
        if (!cancelled) setDiscoverLoading(false);
      }
    };
    const timer = setTimeout(run, discoverQ ? 280 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, discoverQ, t]);

  const lookUp = async (e) => {
    e?.preventDefault?.();
    const normalized = normalizeCode(code);
    if (!normalized) {
      setError(t("Invite code is required"));
      return;
    }
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const data = await previewServerInvite(normalized);
      setPreview(data);
      setCode(normalized);
    } catch (err) {
      setError(err?.message || t("Invite invalid or expired."));
    } finally {
      setBusy(false);
    }
  };

  const joinInvite = async () => {
    const normalized = normalizeCode(code);
    if (!normalized) return;
    setBusy(true);
    setError("");
    try {
      const data = await joinServerByInvite(normalized);
      onJoined?.(data?.server);
      onClose?.();
    } catch (err) {
      setError(err?.message || t("Failed to join server"));
      setBusy(false);
    }
  };

  const joinPublic = async (serverId) => {
    setBusy(true);
    setError("");
    try {
      const data = await joinPublicServer(serverId);
      onJoined?.(data?.server);
      onClose?.();
    } catch (err) {
      setError(err?.message || t("Failed to join server"));
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="server-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="server-modal server-join-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t("Join Server")}</h3>
        <div className="server-join-tabs">
          <button
            type="button"
            className={tab === "invite" ? "active" : ""}
            onClick={() => setTab("invite")}
          >
            <LogIn size={14} />
            {t("Invite Code")}
          </button>
          <button
            type="button"
            className={tab === "discover" ? "active" : ""}
            onClick={() => setTab("discover")}
          >
            <Compass size={14} />
            {t("Explore Public Servers")}
          </button>
        </div>

        {tab === "invite" ? (
          <>
            <p className="server-modal-lead">
              {t("Enter an invite code to join an existing server.")}
            </p>
            <form onSubmit={lookUp}>
              <label className="server-field">
                <span>{t("Invite Code")}</span>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setPreview(null);
                  }}
                  placeholder={t("Enter invite code")}
                  autoFocus
                />
              </label>
              {preview?.server && (
                <div className="server-join-preview">
                  {preview.server.iconUrl ? (
                    <img src={preview.server.iconUrl} alt="" className="server-list-icon" />
                  ) : (
                    <div className="server-list-icon server-list-icon-fallback">
                      {(preview.server.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong>{preview.server.name}</strong>
                    <span>
                      {t("{count} members", { count: preview.server.memberCount || 1 })}
                      {preview.server.isMember ? ` · ${t("Already a member")}` : ""}
                    </span>
                  </div>
                </div>
              )}
              {error && <p className="server-modal-error">{error}</p>}
              <div className="server-modal-actions">
                <button type="button" className="server-ghost-btn" onClick={onClose} disabled={busy}>
                  {t("Cancel")}
                </button>
                {!preview ? (
                  <button type="submit" className="server-primary-btn" disabled={busy || !code.trim()}>
                    {busy ? t("Please wait...") : t("Look up")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="server-primary-btn"
                    disabled={busy}
                    onClick={joinInvite}
                  >
                    {busy
                      ? t("Please wait...")
                      : preview.server?.isMember
                        ? t("Open server")
                        : t("Join Server")}
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="server-modal-lead">{t("Browse servers that opted into public discovery.")}</p>
            <label className="server-field">
              <span>{t("Search")}</span>
              <input
                value={discoverQ}
                onChange={(e) => setDiscoverQ(e.target.value)}
                placeholder={t("Search servers")}
              />
            </label>
            {error && <p className="server-modal-error">{error}</p>}
            <div className="server-discover-list">
              {discoverLoading ? (
                <p className="server-empty-hint">{t("Loading…")}</p>
              ) : publicServers.length === 0 ? (
                <div className="server-empty-state compact">
                  <Server size={28} strokeWidth={1.5} />
                  <p>{t("No public servers yet")}</p>
                </div>
              ) : (
                publicServers.map((s) => (
                  <div key={s.id} className="server-discover-row">
                    {s.iconUrl ? (
                      <img src={s.iconUrl} alt="" className="server-list-icon" />
                    ) : (
                      <div className="server-list-icon server-list-icon-fallback">
                        {(s.name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="server-list-copy">
                      <span className="server-list-name">{s.name}</span>
                      <span className="server-list-sub">
                        {t("{count} members", { count: s.memberCount || 1 })}
                        {s.description ? ` · ${s.description}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="server-primary-btn sm"
                      disabled={busy}
                      onClick={() => {
                        if (s.isMember) {
                          onJoined?.(s);
                          onClose?.();
                        } else {
                          joinPublic(s.id);
                        }
                      }}
                    >
                      {s.isMember ? t("Open") : t("Join")}
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="server-modal-actions">
              <button type="button" className="server-ghost-btn" onClick={onClose}>
                {t("Close")}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
