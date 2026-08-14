/**
 * Consent + analytics gate.
 * Marketing third parties stay cold until the visitor accepts analytics cookies
 * (or an authenticated app session explicitly allows product analytics).
 */
const CONSENT_KEY = "descall:cookie_consent_v1";
const ALLOWED_KEY = "descall:analytics_allowed";

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.choice === "accepted" || parsed?.choice === "rejected") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function setCookieConsent(choice) {
  const payload = { choice, at: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  if (choice === "accepted") markAnalyticsAllowed();
  else clearAnalyticsAllowed();
  try {
    window.dispatchEvent(new CustomEvent("descall:cookie-consent", { detail: payload }));
  } catch {
    /* ignore */
  }
  return payload;
}

export function isAnalyticsAllowed() {
  const consent = getCookieConsent();
  if (consent?.choice === "rejected") return false;
  if (consent?.choice === "accepted") return true;
  try {
    if (sessionStorage.getItem(ALLOWED_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return Boolean(typeof window !== "undefined" && window.__descallAnalyticsAllowed);
}

export function markAnalyticsAllowed() {
  try {
    sessionStorage.setItem(ALLOWED_KEY, "1");
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

export function clearAnalyticsAllowed() {
  try {
    sessionStorage.removeItem(ALLOWED_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") window.__descallAnalyticsAllowed = false;
}

/** Product CTA / auth intent — does NOT grant analytics by itself (consent does). */
export function signalMarketingEngage(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent("descall:marketing-engage", { detail }));
  } catch {
    /* ignore */
  }
  // Hydrate React shell for interactive UI (auth, language, menu).
  try {
    window.dispatchEvent(new CustomEvent("descall:hydrate-marketing", { detail }));
  } catch {
    /* ignore */
  }
}
