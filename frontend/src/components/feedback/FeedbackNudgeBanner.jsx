import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X } from "lucide-react";
import {
  FEEDBACK_COOLDOWN,
  evaluateAfterCallNudge,
  evaluateSoftNudge,
  markFeedbackNudgeDismissed,
  markFeedbackNudgeShown,
  openFeedbackModal,
} from "../../lib/feedbackNudge";
import { useT } from "../../context/LocaleContext";

/**
 * Top banner (same vibe as notification permission) — auto-hides after 10s.
 * Listens for:
 *  - soft session nudge (once after ~8 min in-app, then cooldown)
 *  - custom event `descall:feedback-nudge` { trigger, callDurationMs }
 */
export default function FeedbackNudgeBanner({ enabled = true }) {
  const t = useT();
  const [banner, setBanner] = useState(null);
  const hideTimerRef = useRef(null);
  const softTriedRef = useRef(false);
  const visibleRef = useRef(false);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const hide = useCallback((markDismiss) => {
    clearHideTimer();
    if (markDismiss) markFeedbackNudgeDismissed();
    visibleRef.current = false;
    setBanner(null);
  }, []);

  const show = useCallback(
    (payload) => {
      if (!enabled || !payload || visibleRef.current) return;
      markFeedbackNudgeShown(payload.trigger);
      visibleRef.current = true;
      setBanner(payload);
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        // Soft auto-dismiss — counts as a light dismiss so we don't spam,
        // but uses shorter path via lastShownAt already set.
        visibleRef.current = false;
        setBanner(null);
        hideTimerRef.current = null;
      }, FEEDBACK_COOLDOWN.autoHideMs);
    },
    [enabled]
  );

  // Soft nudge after user has been active ~8 minutes (once per page load attempt)
  useEffect(() => {
    if (!enabled || softTriedRef.current) return undefined;
    const t = setTimeout(() => {
      softTriedRef.current = true;
      const result = evaluateSoftNudge();
      if (result.show) show(result.payload);
    }, 8 * 60 * 1000);
    return () => clearTimeout(t);
  }, [enabled, show]);

  // External triggers (call ended, etc.)
  useEffect(() => {
    if (!enabled) return undefined;
    const onNudge = (e) => {
      const detail = e?.detail || {};
      if (detail.trigger === "after_call") {
        const result = evaluateAfterCallNudge(detail.callDurationMs || 0);
        if (result.show) show(result.payload);
        return;
      }
      const result = evaluateSoftNudge();
      if (result.show) show(result.payload);
    };
    window.addEventListener("descall:feedback-nudge", onNudge);
    return () => window.removeEventListener("descall:feedback-nudge", onNudge);
  }, [enabled, show]);

  useEffect(() => () => clearHideTimer(), []);

  return createPortal(
    <AnimatePresence>
      {banner && (
        <motion.div
          key="feedback-nudge"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 380 }}
          className="app-feedback-banner"
          role="status"
          aria-live="polite"
        >
          <MessageSquarePlus size={15} style={{ flexShrink: 0 }} />
          <div className="app-feedback-banner-text">
            <strong>{banner.title}</strong>
            <span>{banner.body}</span>
          </div>
          <button
            type="button"
            className="app-feedback-banner-btn"
            onClick={() => {
              openFeedbackModal({ type: banner.type, source: banner.trigger });
              hide(false);
            }}
          >
            {banner.cta}
          </button>
          <button
            type="button"
            className="app-feedback-banner-dismiss"
            aria-label={t("Dismiss")}
            onClick={() => hide(true)}
          >
            <X size={14} />
          </button>
          <div className="app-feedback-banner-progress" aria-hidden />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function requestFeedbackNudge(detail) {
  try {
    window.dispatchEvent(new CustomEvent("descall:feedback-nudge", { detail: detail || {} }));
  } catch {
    /* ignore */
  }
}
