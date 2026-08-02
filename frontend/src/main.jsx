import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./context/ToastContext";
/* DESCALL v2.0 — Complete UI rebuild - New modular CSS system */
import "./styles.css";
import "./styles/blackjack.css";

// Apply saved theme before first paint to avoid flash
try {
  const raw =
    localStorage.getItem("descall_user_settings") ||
    localStorage.getItem("descall_settings") ||
    "{}";
  const settings = JSON.parse(raw);
  document.documentElement.setAttribute("data-theme", settings.darkMode === false ? "light" : "dark");
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

const statusEl = document.getElementById("boot-status");
if (statusEl) statusEl.textContent = "Starting app";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

// Safety: never leave splash stuck if boot hangs
window.setTimeout(() => {
  try {
    window.__descallDismissBootSplash?.({ minMs: 0 });
  } catch {
    /* ignore */
  }
}, 12000);
