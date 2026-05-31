import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./context/ToastContext";
/* DESCALL v2.0 — Complete UI rebuild - New modular CSS system */
import "./styles.css";

// Apply saved theme before first paint to avoid flash
try {
  const settings = JSON.parse(localStorage.getItem("descall_settings") || "{}");
  document.documentElement.setAttribute("data-theme", settings.darkMode === false ? "light" : "dark");
} catch {
  document.documentElement.setAttribute("data-theme", "dark");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
