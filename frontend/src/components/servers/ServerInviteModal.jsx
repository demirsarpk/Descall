import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link2, Copy, Check, Trash2, RefreshCw, Globe } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import {
  createServerInvite,
  listServerInvites,
  revokeServerInvite,
  updateServer,
} from "../../api/servers";

const AGE_OPTIONS = [
  { value: 60 * 60, labelKey: "1 hour" },
  { value: 60 * 60 * 24, labelKey: "1 day" },
  { value: 60 * 60 * 24 * 7, labelKey: "7 days" },
  { value: 0, labelKey: "Never" },
];

/**
 * Create / copy / revoke invites + optional public listing toggle (owner).
 */
export default function ServerInviteModal({ server, onClose, onServerUpdated }) {
  const t = useT();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maxAgeSeconds, setMaxAgeSeconds] = useState(60 * 60 * 24 * 7);
  const [maxUses, setMaxUses] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [latestUrl, setLatestUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(Boolean(server?.isPublic));

  const canInvite = Boolean(
    server?.isOwner ||
      server?.myPermissions?.flags?.CREATE_INSTANT_INVITE ||
      server?.myPermissions?.flags?.ADMINISTRATOR
  );

  const load = async () => {
    if (!server?.id || !canInvite) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listServerInvites(server.id);
      setInvites(data?.invites || []);
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsPublic(Boolean(server?.isPublic));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server?.id]);

  const createInvite = async () => {
    if (!server?.id) return;
    setBusy(true);
    try {
      const data = await createServerInvite(server.id, {
        maxAgeSeconds: Number(maxAgeSeconds) || 0,
        maxUses: maxUses === "" ? null : Number(maxUses),
        temporary,
      });
      const invite = data?.invite;
      if (invite?.url) {
        setLatestUrl(invite.url);
        setInvites((prev) => [invite, ...prev.filter((i) => i.code !== invite.code)]);
        try {
          await navigator.clipboard.writeText(invite.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
          toast(t("Invite copied"), "success");
        } catch {
          toast(t("Invite created"), "success");
        }
      }
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast(t("Copied"), "success");
    } catch {
      toast(t("Something went wrong."), "error");
    }
  };

  const revoke = async (code) => {
    if (!server?.id) return;
    setBusy(true);
    try {
      await revokeServerInvite(server.id, code);
      setInvites((prev) => prev.filter((i) => i.code !== code));
      if (latestUrl.includes(code)) setLatestUrl("");
      toast(t("Invite revoked"), "success");
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  const togglePublic = async () => {
    if (!server?.isOwner || !server?.id) return;
    const next = !isPublic;
    setBusy(true);
    try {
      const data = await updateServer(server.id, { isPublic: next });
      setIsPublic(next);
      onServerUpdated?.(data?.server || { ...server, isPublic: next });
      toast(next ? t("Server is now public") : t("Server is now private"), "success");
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
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
        className="server-modal server-invite-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{t("Invite people")}</h3>
        <p className="server-modal-lead">
          {t("Share a link so friends can join {name}.", { name: server?.name || t("this server") })}
        </p>

        {canInvite ? (
          <>
            <div className="server-invite-row">
              <label className="server-field">
                <span>{t("Expire after")}</span>
                <select
                  value={maxAgeSeconds}
                  onChange={(e) => setMaxAgeSeconds(Number(e.target.value))}
                >
                  {AGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="server-field">
                <span>{t("Max uses")}</span>
                <input
                  type="number"
                  min={0}
                  placeholder={t("Unlimited")}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </label>
            </div>

            <label className="server-check-row">
              <input
                type="checkbox"
                checked={temporary}
                disabled={busy}
                onChange={(e) => setTemporary(e.target.checked)}
              />
              <span>{t("Temporary membership")}</span>
            </label>

            <button
              type="button"
              className="server-primary-btn server-invite-create"
              disabled={busy}
              onClick={createInvite}
            >
              <Link2 size={16} />
              {busy ? t("Please wait...") : t("Generate invite")}
            </button>

            {latestUrl && (
              <div className="server-invite-link-box">
                <input readOnly value={latestUrl} onFocus={(e) => e.target.select()} />
                <button type="button" className="server-ghost-btn" onClick={() => copy(latestUrl)}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? t("Copied") : t("Copy")}
                </button>
              </div>
            )}

            <div className="server-invite-list-head">
              <span>{t("Active invites")}</span>
              <button type="button" className="icon-btn" onClick={load} title={t("Refresh")}>
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="server-invite-list">
              {loading ? (
                <p className="server-empty-hint">{t("Loading…")}</p>
              ) : invites.length === 0 ? (
                <p className="server-empty-hint">{t("No active invites")}</p>
              ) : (
                invites.map((inv) => (
                  <div key={inv.code} className="server-invite-item">
                    <div className="server-invite-item-meta">
                      <code>{inv.code}</code>
                      <span>
                        {inv.uses || 0}
                        {inv.maxUses != null ? ` / ${inv.maxUses}` : ""} {t("uses")}
                        {inv.expiresAt
                          ? ` · ${t("expires {date}", { date: new Date(inv.expiresAt).toLocaleDateString() })}`
                          : ` · ${t("Never")}`}
                      </span>
                    </div>
                    <div className="server-invite-item-actions">
                      <button type="button" className="icon-btn" onClick={() => copy(inv.url || inv.code)}>
                        <Copy size={14} />
                      </button>
                      <button type="button" className="icon-btn danger" onClick={() => revoke(inv.code)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <p className="server-empty-hint">{t("You don't have permission to create invites.")}</p>
        )}

        {server?.isOwner && (
          <label className="server-public-toggle">
            <Globe size={16} />
            <span>{t("List in public discovery")}</span>
            <input type="checkbox" checked={isPublic} disabled={busy} onChange={togglePublic} />
          </label>
        )}

        <div className="server-modal-actions">
          <button type="button" className="server-ghost-btn" onClick={onClose}>
            {t("Close")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
