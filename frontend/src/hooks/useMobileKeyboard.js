import { useEffect } from "react";

const KB_OPEN_THRESHOLD = 80;

function resetScroll() {
  try {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    // iOS sometimes leaves a residual visualViewport offset after blur.
    if (window.visualViewport && window.visualViewport.offsetTop) {
      window.scrollTo(0, 0);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Keep the mobile shell aligned to the visual viewport while the keyboard
 * is open, and hard-reset scroll/CSS when it closes (fixes stuck elevated composer).
 */
export function useMobileKeyboard(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const root = document.documentElement;
    const vv = window.visualViewport;
    let raf = 0;
    let lastOpen = false;

    const apply = () => {
      const layoutH = window.innerHeight || root.clientHeight || 0;
      const vvH = vv?.height ?? layoutH;
      const offsetTop = vv?.offsetTop ?? 0;
      const kb = Math.max(0, Math.round(layoutH - vvH - offsetTop));
      const open = kb >= KB_OPEN_THRESHOLD;

      root.style.setProperty("--vv-height", `${Math.round(vvH)}px`);
      root.style.setProperty("--vv-offset-top", `${Math.round(offsetTop)}px`);
      root.style.setProperty("--kb-inset", `${kb}px`);
      root.classList.toggle("kb-open", open);

      if (open !== lastOpen) {
        lastOpen = open;
        if (!open) {
          // Keyboard closed — clear any iOS focus-scroll residue.
          resetScroll();
          // Second pass after Safari finishes its close animation.
          window.setTimeout(resetScroll, 50);
          window.setTimeout(resetScroll, 180);
        }
      } else if (!open && (window.scrollY || document.documentElement.scrollTop || offsetTop > 1)) {
        resetScroll();
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    const onFocusOut = () => {
      // Blur path: wait a tick so iOS can update visualViewport first.
      window.setTimeout(schedule, 40);
      window.setTimeout(() => {
        const active = document.activeElement;
        const stillEditing =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable);
        if (!stillEditing) {
          root.classList.remove("kb-open");
          root.style.setProperty("--kb-inset", "0px");
          resetScroll();
        }
      }, 120);
    };

    apply();
    if (vv) {
      vv.addEventListener("resize", schedule);
      vv.addEventListener("scroll", schedule);
    }
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      cancelAnimationFrame(raf);
      if (vv) {
        vv.removeEventListener("resize", schedule);
        vv.removeEventListener("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", schedule);
      root.classList.remove("kb-open");
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--vv-offset-top");
      root.style.removeProperty("--kb-inset");
      resetScroll();
    };
  }, [enabled]);
}

export default useMobileKeyboard;
