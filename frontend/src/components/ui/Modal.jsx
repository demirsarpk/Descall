import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useT } from "../../context/LocaleContext";

export default function Modal({ open, onClose, title, children, wide }) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => onClose?.()}
        >
          <motion.div
            className={`modal-card ${wide ? "modal-wide" : ""}`}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <header className="modal-header">
                <h2>{title}</h2>
                <button type="button" className="modal-close" onClick={onClose} aria-label={t("Close")}>
                  ×
                </button>
              </header>
            )}
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
