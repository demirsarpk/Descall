import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./context/ToastContext";
/* DESCALL v2.0 — Import modular design system */
import "./styles/base.css";        /* Design tokens + reset + base components */
import "./styles/layout.css";       /* Nav rail, sidebar, chat panel layout */
import "./styles/components.css";   /* DM items, messages, modals, buttons */
import "./styles/voice-chat.css";   /* Video conference, call overlays */
import "./styles.css";              /* Legacy styles (v1 compatibility) */
import "./styles.animations.css";   /* Animation keyframes */

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
