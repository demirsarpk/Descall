import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { resolveInitialLocale, translate, loadI18nCatalogs } from "./i18n";
import { isPublicMarketingPath } from "./site/marketingPaths";
import { getToken } from "./lib/storage";
import { isAnalyticsAllowed, markAnalyticsAllowed } from "./site/analyticsGate";

const path = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
const hasSession = Boolean(getToken());
const preferMarketingShell = !hasSession && isPublicMarketingPath(path);

/**
 * Schedule third-party analytics. Marketing waits for CTA/engage gate;
 * authenticated app can warm sooner after idle.
 */
function scheduleAnalytics({ preferMarketing }) {
  let started = false;
  const start = () => {
    if (started) return;
    if (preferMarketing && !isAnalyticsAllowed()) return;
    started = true;
    import("./site/analytics")
      .then((m) => m.initAnalytics())
      .catch(() => {});
  };

  if (preferMarketing) {
    window.addEventListener("descall:analytics-allowed", start, { once: true });
    window.setTimeout(() => {
      markAnalyticsAllowed();
      start();
    }, 20000);
    return;
  }

  const onEngage = () => {
    markAnalyticsAllowed();
    start();
  };
  for (const evt of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(evt, onEngage, { once: true, passive: true });
  }
  window.setTimeout(onEngage, 2500);
}

scheduleAnalytics({ preferMarketing: preferMarketingShell });

if (!preferMarketingShell) {
  import("./lib/noiseSuppression")
    .then((m) => m.preloadNoiseSuppression?.())
    .catch(() => {});
  import("./styles/blackjack.css").catch(() => {});
}

const Router =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? HashRouter
    : BrowserRouter;

try {
  const raw =
    localStorage.getItem("descall_user_settings") ||
    localStorage.getItem("descall_settings") ||
    "{}";
  const settings = JSON.parse(raw);
  document.documentElement.setAttribute(
    "data-theme",
    settings.premiumThemeKey || (settings.darkMode === false ? "light" : "dark")
  );
  const accent = settings.accentColor;
  if (accent && !settings.premiumThemeKey) {
    const hex = String(accent).replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const root = document.documentElement.style;
      root.setProperty("--primary", accent);
      root.setProperty("--primary-2", accent);
      root.setProperty("--primary-soft", `rgba(${r}, ${g}, ${b}, 0.12)`);
      root.setProperty("--primary-glow", `rgba(${r}, ${g}, ${b}, 0.35)`);
      root.setProperty("--accent", accent);
    }
  }
  if (settings.chatFontSize) {
    document.documentElement.style.setProperty("--chat-font-size", `${settings.chatFontSize}px`);
  }
  if (settings.uiDensity) {
    document.documentElement.setAttribute("data-density", settings.uiDensity);
  }
  if (settings.bubbleStyle) {
    document.documentElement.setAttribute("data-bubble", settings.bubbleStyle);
  }
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

const bootLocale = resolveInitialLocale();
const statusEl = document.getElementById("boot-status");
if (statusEl) statusEl.textContent = translate(bootLocale, "Starting app");

/**
 * Progressive marketing hydration: keep #seo-static visible and interactive
 * (native links work) until idle / engagement, then mount the React shell.
 */
function scheduleMarketingHydration(run) {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    cleanup();
    run();
  };
  const onEngage = (e) => {
    const t = e?.target;
    if (t && typeof t.closest === "function" && t.closest("#seo-static a[href]")) return;
    start();
  };
  const cleanup = () => {
    for (const evt of ["pointerdown", "keydown", "touchstart"]) {
      window.removeEventListener(evt, onEngage);
    }
  };
  for (const evt of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(evt, onEngage, { passive: true });
  }
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => start(), { timeout: 4000 });
  }
  window.setTimeout(start, 3500);
}

async function bootApp() {
  const [{ ToastProvider }, { LocaleProvider }, { default: IosPwaInstallBanner }] =
    await Promise.all([
      import("./context/ToastContext"),
      import("./context/LocaleContext"),
      import("./components/IosPwaInstallBanner"),
      import("./styles.css"),
      loadI18nCatalogs(),
    ]);

  const RootApp = lazy(() => import("./App.jsx"));
  const AnalyticsLazy = lazy(() =>
    import("@vercel/analytics/react").then((m) => ({ default: m.Analytics }))
  );

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <LocaleProvider>
            <Router>
              <Suspense fallback={null}>
                <RootApp />
              </Suspense>
              <IosPwaInstallBanner />
              <Suspense fallback={null}>
                <AnalyticsLazy />
              </Suspense>
            </Router>
          </LocaleProvider>
        </ToastProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

async function boot() {
  if (preferMarketingShell) {
    scheduleMarketingHydration(() => {
      import("./site/hydrateMarketing.jsx")
        .then((m) => m.hydrateMarketing())
        .catch((err) => console.error("[boot] marketing hydrate failed", err));
    });
    return;
  }
  await bootApp();
}

boot().catch((err) => {
  console.error("[boot] failed", err);
});

window.setTimeout(() => {
  try {
    window.__descallDismissBootSplash?.({ minMs: 0 });
  } catch {
    /* ignore */
  }
}, 12000);
