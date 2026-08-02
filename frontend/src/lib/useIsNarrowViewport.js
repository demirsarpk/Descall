import { useEffect, useState } from "react";

/** True when viewport width is below `breakpoint` (default 720). */
export function useIsNarrowViewport(breakpoint = 720) {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    // Safari < 14
    mq.addListener?.(apply);
    return () => {
      mq.removeEventListener?.("change", apply);
      mq.removeListener?.(apply);
    };
  }, [breakpoint]);

  return narrow;
}

/**
 * Styles for call-overlay popovers that must stay on-screen on mobile.
 * Desktop: absolute, anchored above the button.
 * Mobile: fixed bottom sheet spanning the viewport with safe insets.
 */
export function callPopoverStyle({ narrow, desktop = {} } = {}) {
  if (narrow) {
    return {
      position: "fixed",
      left: 12,
      right: 12,
      bottom: "max(12px, calc(env(safe-area-inset-bottom, 0px) + 88px))",
      width: "auto",
      maxWidth: "none",
      maxHeight: "min(70dvh, calc(100dvh - 120px))",
      overflowY: "auto",
      overflowX: "hidden",
      WebkitOverflowScrolling: "touch",
      zIndex: 10050,
      // framer-motion may set transform — neutralize horizontal centering
      transform: "none",
      ...desktop.mobileOverrides,
    };
  }
  return {
    position: "absolute",
    bottom: "calc(100% + 14px)",
    left: "50%",
    transform: "translateX(-50%)",
    maxWidth: "min(380px, calc(100vw - 24px))",
    maxHeight: "min(70vh, 480px)",
    overflowY: "auto",
    overflowX: "hidden",
    zIndex: 200,
    ...desktop,
  };
}
