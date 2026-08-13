/**
 * Marketing analytics gate — third parties stay cold until explicit engage/CTA.
 */
const STORAGE_KEY = "descall:analytics_allowed";

export function isAnalyticsAllowed() {
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return Boolean(typeof window !== "undefined" && window.__descallAnalyticsAllowed);
}

export function markAnalyticsAllowed() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.__descallAnalyticsAllowed = true;
    try {
      window.dispatchEvent(new CustomEvent("descall:analytics-allowed"));
    } catch {
      /* ignore */
    }
  }
}

/** Fire when user opens auth / clicks primary marketing CTA. */
export function signalMarketingEngage(detail = {}) {
  markAnalyticsAllowed();
  try {
    window.dispatchEvent(new CustomEvent("descall:marketing-engage", { detail }));
  } catch {
    /* ignore */
  }
}
