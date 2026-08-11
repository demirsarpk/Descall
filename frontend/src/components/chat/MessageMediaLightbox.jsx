import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useT } from "../../context/LocaleContext";

/**
 * Fullscreen image/GIF viewer for chat media.
 * Click the X, backdrop, or press Escape to close.
 */
export default function MessageMediaLightbox({
  open,
  src,
  alt = "",
  onClose,
}) {
  const t = useT();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && src ? (
        <motion.div
          className="message-media-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={alt || t("Image")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <button
            type="button"
            className="message-media-lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            aria-label={t("Close")}
          >
            <X size={22} strokeWidth={2.25} />
          </button>

          <motion.img
            key={src}
            src={src}
            alt={alt || t("Image")}
            className="message-media-lightbox-img"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
