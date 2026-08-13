import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import ErrorBoundary from "../components/ErrorBoundary";
import MarketingLocaleProvider from "./MarketingLocaleProvider";
import { markAnalyticsAllowed } from "./analyticsGate";

const MarketingBoot = lazy(() => import("./MarketingBoot.jsx"));

const Router =
  typeof window !== "undefined" && window.location.protocol === "file:"
    ? HashRouter
    : BrowserRouter;

/**
 * Isolated marketing React tree — no Toast/motion, no full i18n catalogs,
 * no authenticated App/LiveKit, no Vercel analytics until engagement.
 */
export async function hydrateMarketing() {
  await import("./marketing-entry.css");

  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  // First CTA / sign-in intent unlocks analytics for this session.
  const unlock = () => markAnalyticsAllowed();
  window.addEventListener("descall:marketing-engage", unlock, { once: true });

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <MarketingLocaleProvider>
          <Router>
            <Suspense fallback={null}>
              <MarketingBoot />
            </Suspense>
          </Router>
        </MarketingLocaleProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
