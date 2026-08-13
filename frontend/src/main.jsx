import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import IosPwaInstallBanner from "./components/IosPwaInstallBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./context/ToastContext";
import { LocaleProvider } from "./context/LocaleContext";
import { resolveInitialLocale, translate } from "./i18n";
import { initAnalytics } from "./site/analytics";
import { isPublicMarketingPath } from "./site/marketingPaths";
import { getToken } from "./lib/storage";
/* DESCALL v2.0 — Complete UI rebuild - New modular CSS system */
import "./styles.css";

// Boot PostHog (and optional GA/Clarity) for marketing + authenticated SPA.
initAnalytics();

const path = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
const hasSession = Boolean(getToken());
const preferMarketingShell = !hasSession && isPublicMarketingPath(path);

// Only warm noise-suppression WASM when the user is likely to open voice (app paths).
if (!preferMarketingShell) {
  import("./lib/noiseSuppression")
    .then((m) => m.preloadNoiseSuppression?.())
    .catch(() => {});
  // Blackjack CSS only needed inside the authenticated app.
  import("./styles/blackjack.css").catch(() => {});
}

const RootApp = preferMarketingShell
  ? lazy(() => import("./site/MarketingBoot.jsx"))
  : lazy(() => import("./App.jsx"));

// Electron loadFile() uses file:// — BrowserRouter cannot deep-link there.
const Router =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? HashRouter
    : BrowserRouter;

// Apply saved theme / accent / chat font before first paint to avoid flash
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <LocaleProvider>
          <Router>
            <Suspense fallback={null}>
              <RootApp />
            </Suspense>
            {!preferMarketingShell ? <IosPwaInstallBanner /> : null}
            <Analytics />
          </Router>
        </LocaleProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Safety: never leave splash stuck if boot hangs
window.setTimeout(() => {
  try {
    window.__descallDismissBootSplash?.({ minMs: 0 });
  } catch {
    /* ignore */
  }
}, 12000);
