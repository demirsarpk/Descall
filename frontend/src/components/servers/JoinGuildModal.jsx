import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, ArrowRight } from "lucide-react";
import { useT } from "../../context/LocaleContext";

export default function JoinGuildModal({ onClose, onJoin }) {
  const t = useT();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError(t("Invite code is required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onJoin(trimmed);
    } catch (err) {
      setError(err.message || t("Failed to join server"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-content guild-modal"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 24, stiffness: 340 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{t("Join a Server")}</h2>
          <p>{t("Enter an invite code to join an existing server.")}</p>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t("Invite Code")}</label>
            <div className="input-with-icon">
              <Link2 size={18} className="input-icon" />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("Enter invite code")}
                maxLength={20}
                autoFocus
                className={error ? "error" : ""}
              />
            </div>
            {error && <span className="form-error">{error}</span>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t("Cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !code.trim()}>
              {loading ? t("Joining...") : t("Join Server")}
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
