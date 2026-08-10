import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, FileText, ShieldCheck } from "lucide-react";
import { useLocale } from "../../context/LocaleContext";
import { TERMS_CONTENT, PRIVACY_CONTENT } from "../../legal/legalContent";

const CONTENT_BY_TYPE = {
  terms: TERMS_CONTENT,
  privacy: PRIVACY_CONTENT,
};

/**
 * Full-text reader for the Terms of Service / Privacy Policy. Used both from
 * the registration flow (so people can actually read what they're agreeing
 * to before checking the box) and could be reused anywhere else a "view
 * full policy" trigger is needed. Content itself lives in legalContent.js
 * so the marketing site's /terms and /privacy pages can share the exact
 * same text instead of drifting out of sync.
 */
export default function LegalContentModal({ open, onClose, type = "terms" }) {
  const { locale } = useLocale();
  const scrollRef = useRef(null);
  const data = CONTENT_BY_TYPE[type]?.[locale] || CONTENT_BY_TYPE[type]?.en;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open, type]);

  if (!data) return null;
  const Icon = type === "privacy" ? ShieldCheck : FileText;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="legal-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            // This modal is often nested inside another modal's backdrop
            // (registration flow); don't let the click bubble up and close
            // that outer modal too.
            e.stopPropagation();
            onClose?.();
          }}
        >
          <motion.div
            className="legal-modal-card"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={data.title}
          >
            <header className="legal-modal-header">
              <div className="legal-modal-header-icon">
                <Icon size={20} />
              </div>
              <div className="legal-modal-header-text">
                <h2>{data.title}</h2>
                <span>{data.updated}</span>
              </div>
              <button type="button" className="legal-modal-close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            <div className="legal-modal-body" ref={scrollRef}>
              <p className="legal-modal-intro">{data.intro}</p>
              {data.sections.map((section) => (
                <section key={section.heading} className="legal-modal-section">
                  <h3>{section.heading}</h3>
                  {section.paragraphs.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>

            <footer className="legal-modal-footer">
              <button type="button" className="legal-modal-ok-btn" onClick={onClose}>
                {locale === "tr" ? "Kapat" : "Close"}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
