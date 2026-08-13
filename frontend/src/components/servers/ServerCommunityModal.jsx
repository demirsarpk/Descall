import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { updateServer } from "../../api/servers";
import { serverHasPermission } from "../../lib/serverPermissions";

const VERIFICATION_LEVELS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "highest", label: "Highest" },
];

/**
 * Community / discovery settings: rules screen, splash, verification.
 */
export default function ServerCommunityModal({ server, onClose, onServerUpdated }) {
  const t = useT();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [communityEnabled, setCommunityEnabled] = useState(Boolean(server?.communityEnabled));
  const [rulesText, setRulesText] = useState(server?.rulesText || "");
  const [splashUrl, setSplashUrl] = useState(server?.splashUrl || "");
  const [verificationLevel, setVerificationLevel] = useState(server?.verificationLevel || "none");
  const [isPublic, setIsPublic] = useState(Boolean(server?.isPublic));
  const [vanitySlug, setVanitySlug] = useState(server?.vanitySlug || "");

  const vanityPreviewUrl = vanitySlug
    ? `https://descall.com/s/${String(vanitySlug).toLowerCase()}`
    : "";

  useEffect(() => {
    setCommunityEnabled(Boolean(server?.communityEnabled));
    setRulesText(server?.rulesText || "");
    setSplashUrl(server?.splashUrl || "");
    setVerificationLevel(server?.verificationLevel || "none");
    setIsPublic(Boolean(server?.isPublic));
    setVanitySlug(server?.vanitySlug || "");
  }, [server?.id, server?.communityEnabled, server?.rulesText, server?.splashUrl, server?.verificationLevel, server?.isPublic, server?.vanitySlug]);

  const canManage = serverHasPermission(server, "MANAGE_GUILD");

  const save = async (e) => {
    e?.preventDefault?.();
    if (!server?.id || !canManage) return;
    setBusy(true);
    try {
      const data = await updateServer(server.id, {
        communityEnabled,
        rulesText: rulesText.trim() || null,
        splashUrl: splashUrl.trim() || null,
        verificationLevel,
        isPublic,
        vanitySlug: vanitySlug.trim() || null,
      });
      onServerUpdated?.(data?.server || {
        ...server,
        communityEnabled,
        rulesText: rulesText.trim() || null,
        splashUrl: splashUrl.trim() || null,
        verificationLevel,
        isPublic,
        vanitySlug: vanitySlug.trim() || null,
      });
      toast(t("Saved"), "success");
      onClose?.();
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
        className="server-modal server-community-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          <ShieldCheck size={18} />
          {t("Community & Discovery")}
        </h3>
        <p className="server-modal-lead">
          {t("Enable community features, public discovery, and a rules screen for new members.")}
        </p>
        <form onSubmit={save}>
          <label className="server-check-row">
            <input
              type="checkbox"
              checked={communityEnabled}
              disabled={!canManage || busy}
              onChange={(e) => setCommunityEnabled(e.target.checked)}
            />
            <span>{t("Enable Community")}</span>
          </label>
          <label className="server-check-row">
            <input
              type="checkbox"
              checked={isPublic}
              disabled={!canManage || busy}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>{t("List in public discovery")}</span>
          </label>
          <label className="server-field">
            <span>{t("Verification level")}</span>
            <select
              value={verificationLevel}
              disabled={!canManage || busy}
              onChange={(e) => setVerificationLevel(e.target.value)}
            >
              {VERIFICATION_LEVELS.map((lvl) => (
                <option key={lvl.value} value={lvl.value}>
                  {t(lvl.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="server-field">
            <span>{t("Vanity invite URL")}</span>
            <input
              value={vanitySlug}
              disabled={!canManage || busy}
              onChange={(e) =>
                setVanitySlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "")
                    .slice(0, 32)
                )
              }
              placeholder={t("my-server")}
            />
            {vanityPreviewUrl ? (
              <p className="server-modal-sub">{vanityPreviewUrl}</p>
            ) : (
              <p className="server-modal-sub">{t("Custom link: descall.com/s/your-name")}</p>
            )}
          </label>
          <label className="server-field">
            <span>{t("Invite splash image URL")}</span>
            <input
              value={splashUrl}
              disabled={!canManage || busy}
              onChange={(e) => setSplashUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="server-field">
            <span>{t("Server rules")}</span>
            <textarea
              value={rulesText}
              disabled={!canManage || busy}
              onChange={(e) => setRulesText(e.target.value)}
              rows={7}
              maxLength={4000}
              placeholder={t("Members must accept these rules before chatting.")}
            />
          </label>
          <div className="server-modal-actions">
            <button type="button" className="server-ghost-btn" onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </button>
            <button type="submit" className="server-primary-btn" disabled={!canManage || busy}>
              {busy ? t("Please wait...") : t("Save")}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
