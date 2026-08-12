import { useState } from "react";
import { motion } from "framer-motion";
import { ScrollText } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { acceptServerRules } from "../../api/servers";

/**
 * Community onboarding rules accept screen.
 */
export default function ServerRulesModal({ server, onClose, onAccepted }) {
  const t = useT();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const accept = async () => {
    if (!server?.id || !checked) return;
    setBusy(true);
    try {
      const data = await acceptServerRules(server.id);
      onAccepted?.(data?.rulesAcceptedAt || new Date().toISOString());
      toast(t("Welcome! Rules accepted."), "success");
      onClose?.();
    } catch (err) {
      toast(err?.message || t("Something went wrong."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="server-modal-overlay server-rules-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="server-modal server-rules-modal"
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
      >
        {(server?.splashUrl || server?.bannerUrl) && (
          <div
            className="server-rules-splash"
            style={{
              backgroundImage: `url(${server.splashUrl || server.bannerUrl})`,
            }}
          />
        )}
        <div className="server-rules-body">
          <h3>
            <ScrollText size={18} />
            {t("Server Rules")}
          </h3>
          <p className="server-modal-lead">
            {t("Review and accept the rules for {name} to continue.", {
              name: server?.name || t("this server"),
            })}
          </p>
          <div className="server-rules-text">
            {(server?.rulesText || "").split("\n").map((line, i) => (
              <p key={i}>{line || "\u00A0"}</p>
            ))}
          </div>
          <label className="server-check-row">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>{t("I agree to the server rules")}</span>
          </label>
          <div className="server-modal-actions">
            <button
              type="button"
              className="server-primary-btn"
              disabled={!checked || busy}
              onClick={accept}
            >
              {busy ? t("Please wait...") : t("Accept & Continue")}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
