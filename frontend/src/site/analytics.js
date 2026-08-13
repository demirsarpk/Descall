/**
 * Unified analytics: PostHog (primary funnel) + Google Ads / optional GA4 / Clarity.
 *
 * Env (Vite build-time):
 *   VITE_PUBLIC_POSTHOG_KEY  — project API key (phc_…)
 *   VITE_PUBLIC_POSTHOG_HOST — e.g. https://eu.i.posthog.com
 *   VITE_GA_MEASUREMENT_ID
 *   VITE_GOOGLE_ADS_ID                 — defaults to AW-439578855
 *   VITE_GOOGLE_ADS_SIGNUP_LABEL       — overrides default Kaydolma label
 *                                      (label only or full AW-…/label send_to)
 *   VITE_CLARITY_ID
 *
 * Public project key is safe to ship in the client bundle. Env overrides win;
 * production falls back to the Descall EU project so Vercel builds work without
 * Dashboard env wiring. Local/dev can leave the key empty to no-op.
 */

import posthog from "posthog-js";

let booted = false;
let posthogReady = false;
let gtagJsBooted = false;
const gtagConfiguredIds = new Set();

/** Descall EU project — public `phc_` key (not a secret). */
const DESCALL_POSTHOG_KEY = "phc_ztiuFNjFuPcfrCV6ANXunnYaZh4yH99ZhxFZf2cryacQ";
const DESCALL_POSTHOG_HOST = "https://eu.i.posthog.com";
/** Google Ads account tag (public). */
const DEFAULT_GOOGLE_ADS_ID = "AW-439578855";
/** "Kaydolma işlemi (2)" conversion label from Google Ads event snippet. */
const DEFAULT_GOOGLE_ADS_SIGNUP_LABEL = "OLLZCM7ZmuEcEOfhzdEB";
const GADS_SIGNUP_SENT_KEY = "descall:gads_signup_conversion_sent";

function posthogKey() {
  const fromEnv = String(import.meta.env.VITE_PUBLIC_POSTHOG_KEY || "").trim();
  if (fromEnv) return fromEnv;
  // Production builds always track; local/dev stays quiet unless env is set.
  if (import.meta.env.PROD) return DESCALL_POSTHOG_KEY;
  return "";
}

function posthogHost() {
  return String(
    import.meta.env.VITE_PUBLIC_POSTHOG_HOST || DESCALL_POSTHOG_HOST
  ).trim();
}

function googleAdsId() {
  return String(import.meta.env.VITE_GOOGLE_ADS_ID || DEFAULT_GOOGLE_ADS_ID).trim();
}

function googleAdsSignupSendTo() {
  const adsId = googleAdsId();
  const raw = String(
    import.meta.env.VITE_GOOGLE_ADS_SIGNUP_LABEL || DEFAULT_GOOGLE_ADS_SIGNUP_LABEL || ""
  ).trim();
  if (!raw || !adsId) return "";
  return raw.includes("/") ? raw : `${adsId}/${raw}`;
}

/**
 * Load googletagmanager gtag.js once and `config` each id exactly once.
 * Safe on SSR (no-op) and when an ad blocker strips the script.
 */
function ensureGtagConfigs(ids, { anonymizeIpIds } = {}) {
  if (typeof window === "undefined") return;
  const list = [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!list.length) return;

  try {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      };
    }

    const existing = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    if (!existing) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(list[0])}`;
      document.head.appendChild(s);
    }

    if (!gtagJsBooted) {
      window.gtag("js", new Date());
      gtagJsBooted = true;
    }

    const anon = anonymizeIpIds instanceof Set ? anonymizeIpIds : new Set();
    for (const id of list) {
      if (gtagConfiguredIds.has(id)) continue;
      gtagConfiguredIds.add(id);
      if (anon.has(id)) {
        window.gtag("config", id, { anonymize_ip: true });
      } else {
        window.gtag("config", id);
      }
    }
  } catch (err) {
    console.warn("[analytics] gtag init failed", err);
  }
}

/**
 * Fire Google Ads Sign-Up conversion only after a confirmed new account.
 * Never throws. Deduped per browser session.
 * send_to: AW-439578855/OLLZCM7ZmuEcEOfhzdEB ("Kaydolma işlemi (2)").
 */
export function trackGoogleAdsSignUpConversion(properties = {}) {
  if (typeof window === "undefined") return;
  try {
    try {
      if (sessionStorage.getItem(GADS_SIGNUP_SENT_KEY) === "1") return;
    } catch {
      /* private mode — continue; still fire once this page load */
    }

    const adsId = googleAdsId();
    const sendTo = googleAdsSignupSendTo();
    if (!adsId || !sendTo) return;
    ensureGtagConfigs([adsId]);

    if (typeof window.gtag !== "function") return;

    try {
      sessionStorage.setItem(GADS_SIGNUP_SENT_KEY, "1");
    } catch {
      /* ignore */
    }

    window.gtag("event", "conversion", {
      send_to: sendTo,
      ...(properties.method ? { method: properties.method } : {}),
    });
  } catch {
    /* Tracking must never break Sign Up */
  }
}

export function initAnalytics() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const phKey = posthogKey();
  if (phKey) {
    try {
      posthog.init(phKey, {
        api_host: posthogHost(),
        ui_host: "https://eu.posthog.com",
        person_profiles: "identified_only",
        capture_pageview: false, // we send $pageview ourselves with SPA routes
        capture_pageleave: true,
        capture_exceptions: true,
        persistence: "localStorage+cookie",
        // Project settings enable replay/surveys; keep client aligned.
        disable_session_recording: false,
        session_recording: {
          maskAllInputs: true,
          recordCrossOriginIframes: false,
        },
        advanced_disable_feature_flags_on_first_load: false,
        loaded: (ph) => {
          posthogReady = true;
          // Attach UTM / ref once for session correlation
          try {
            const params = new URLSearchParams(window.location.search);
            const utm = {};
            for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"]) {
              const v = params.get(key);
              if (v) utm[key] = v;
            }
            if (Object.keys(utm).length) ph.register(utm);
          } catch {
            /* ignore */
          }
        },
      });
      posthogReady = true;
    } catch (err) {
      console.warn("[analytics] PostHog init failed", err);
    }
  }

  const gaId = String(import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();
  const adsId = googleAdsId();
  const clarityId = import.meta.env.VITE_CLARITY_ID || "";

  // Single gtag.js load — config Google Ads + optional GA4 without duplicates.
  const gtagIds = [];
  if (adsId) gtagIds.push(adsId);
  if (gaId) gtagIds.push(gaId);
  ensureGtagConfigs(gtagIds, { anonymizeIpIds: new Set(gaId ? [gaId] : []) });

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
  const page = path || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
  try {
    if (posthogReady || posthogKey()) {
      posthog.capture("$pageview", { $current_url: typeof window !== "undefined" ? window.location.href : page, path: page });
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", { page_path: page });
    }
  } catch {
    /* ignore */
  }
}

/**
 * Funnel / product event. Always safe to call.
 * @param {string} event
 * @param {Record<string, unknown>} [properties]
 */
export function trackEvent(event, properties = {}) {
  if (!event) return;
  try {
    if (posthogReady || posthogKey()) {
      posthog.capture(event, properties);
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, properties);
    }
  } catch {
    /* ignore */
  }
}

export function identifyUser(user) {
  if (!user?.id) return;
  try {
    if (posthogReady || posthogKey()) {
      posthog.identify(String(user.id), {
        username: user.username || undefined,
        email: user.email || undefined,
      });
    }
  } catch {
    /* ignore */
  }
}

export function resetAnalyticsUser() {
  try {
    if (posthogReady || posthogKey()) posthog.reset();
  } catch {
    /* ignore */
  }
}

/** Multivariate / boolean flags (client-evaluated). Safe no-op when PostHog is off. */
export function getFeatureFlag(key, fallback = false) {
  if (!key) return fallback;
  try {
    if (!(posthogReady || posthogKey())) return fallback;
    const value = posthog.getFeatureFlag(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function getFeatureFlagPayload(key, fallback = null) {
  if (!key) return fallback;
  try {
    if (!(posthogReady || posthogKey())) return fallback;
    const payload = posthog.getFeatureFlagPayload(key);
    if (payload == null) return fallback;
    if (typeof payload === "string") {
      try {
        return JSON.parse(payload);
      } catch {
        return payload;
      }
    }
    return payload;
  } catch {
    return fallback;
  }
}

/** Named funnel helpers — keep event names stable for PostHog insights. */
export const Funnel = {
  landingView: (props) => trackEvent("landing_view", props),
  ctaClick: (props) => trackEvent("cta_click", props),
  registerStart: (props) => trackEvent("register_start", props),
  /** Call only after auth/API confirms a brand-new account (never on login). */
  registerComplete: (props) => {
    trackEvent("register_complete", props);
    trackGoogleAdsSignUpConversion(props || {});
  },
  loginComplete: (props) => trackEvent("login_complete", props),
  inviteGenerated: (props) => trackEvent("invite_generated", props),
  inviteLanding: (props) => trackEvent("invite_landing", props),
  inviteRegisterComplete: (props) => trackEvent("invite_register_complete", props),
};
