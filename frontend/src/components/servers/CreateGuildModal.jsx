import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, Users } from "lucide-react";
import { useT } from "../../context/LocaleContext";

export default function CreateGuildModal({ onClose, onCreate }) {
  const t = useT();
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("Server name is required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onCreate({ name: name.trim(), iconUrl: iconUrl.trim() || undefined });
    } catch (err) {
      setError(err.message || t("Failed to create server"));
    } finally {
      setLoading(false);
    }
  };

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
          <h2>{t("Create Your Server")}</h2>
          <p>{t("Give your new server a personality with a name and an icon. You can always change it later.")}</p>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="guild-icon-preview">
            {iconUrl ? (
              <img src={iconUrl} alt={t("Server icon")} />
            ) : (
              <div className="guild-icon-placeholder">{initials || <Users size={28} />}</div>
            )}
            <button type="button" className="guild-icon-upload-btn">
              <Camera size={16} />
            </button>
          </div>

          <div className="form-group">
            <label>{t("Server Name")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("e.g. Gaming Squad")}
              maxLength={100}
              autoFocus
              className={error ? "error" : ""}
            />
            {error && <span className="form-error">{error}</span>}
          </div>

          <div className="form-group">
            <label>{t("Icon URL (optional)")}</label>
            <input
              type="url"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://example.com/icon.png"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t("Cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? t("Creating...") : t("Create Server")}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
