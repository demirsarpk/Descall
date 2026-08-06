/**
 * Lightweight analytics bootstrap (GA4 / Clarity).
 * Set VITE_GA_MEASUREMENT_ID and/or VITE_CLARITY_ID at build time.
 * No-ops when IDs are missing — safe for local/dev.
 */

let booted = false;

export function initAnalytics() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID || "";
  const clarityId = import.meta.env.VITE_CLARITY_ID || "";

  if (gaId) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", gaId, { anonymize_ip: true });
  }

  if (clarityId) {
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", clarityId);
  }
}

export function trackPageView(path) {
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", { page_path: path });
    }
  } catch {
    /* ignore */
  }
}
