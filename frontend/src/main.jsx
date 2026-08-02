import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./context/ToastContext";
/* DESCALL v2.0 — Complete UI rebuild - New modular CSS system */
import "./styles.css";
import "./styles/blackjack.css";

// Apply saved theme / accent / chat font before first paint to avoid flash
try {
  const raw =
    localStorage.getItem("descall_user_settings") ||
    localStorage.getItem("descall_settings") ||
    "{}";
  const settings = JSON.parse(raw);
  document.documentElement.setAttribute("data-theme", settings.darkMode === false ? "light" : "dark");
  const accent = settings.accentColor || "#5865F2";
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
  if (settings.chatFontSize) {
    document.documentElement.style.setProperty("--chat-font-size", `${settings.chatFontSize}px`);
  }
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
