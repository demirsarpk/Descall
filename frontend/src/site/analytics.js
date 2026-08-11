/**
 * Unified analytics: PostHog (primary funnel) + optional GA4 / Clarity.
 *
 * Env (Vite build-time):
 *   VITE_PUBLIC_POSTHOG_KEY  — project API key (phc_…)
 *   VITE_PUBLIC_POSTHOG_HOST — e.g. https://eu.i.posthog.com
 *   VITE_GA_MEASUREMENT_ID
 *   VITE_CLARITY_ID
 *
 * Safe no-op when keys are missing (local/dev).
 */

import posthog from "posthog-js";

let booted = false;
let posthogReady = false;

function posthogKey() {
  return String(import.meta.env.VITE_PUBLIC_POSTHOG_KEY || "").trim();
}

function posthogHost() {
  return String(import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com").trim();
}

export function initAnalytics() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const phKey = posthogKey();
  if (phKey) {
    try {
      posthog.init(phKey, {
        api_host: posthogHost(),
        person_profiles: "identified_only",
        capture_pageview: false, // we send $pageview ourselves with SPA routes
        capture_pageleave: true,
        persistence: "localStorage+cookie",
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

/** Named funnel helpers — keep event names stable for PostHog insights. */
export const Funnel = {
  landingView: (props) => trackEvent("landing_view", props),
  ctaClick: (props) => trackEvent("cta_click", props),
  registerStart: (props) => trackEvent("register_start", props),
  registerComplete: (props) => trackEvent("register_complete", props),
  loginComplete: (props) => trackEvent("login_complete", props),
  inviteGenerated: (props) => trackEvent("invite_generated", props),
  inviteLanding: (props) => trackEvent("invite_landing", props),
  inviteRegisterComplete: (props) => trackEvent("invite_register_complete", props),
};
