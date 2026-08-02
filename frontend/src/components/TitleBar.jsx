import { useState, useEffect } from "react";
import { Minus, Square, X } from "lucide-react";

/**
 * Frameless Electron title bar — always mounted while the desktop app runs.
 * Adds `body.electron-app` so layout offsets below this bar (no overlap).
 */
export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron =
    typeof window !== "undefined" && !!window.electronAPI?.isElectron;

  useEffect(() => {
    if (!isElectron) return undefined;

    document.body.classList.add("electron-app");
    document.documentElement.classList.add("electron-app");

    if (window.electronAPI?.onMaximizedChange) {
      window.electronAPI.onMaximizedChange((maximized) => {
        setIsMaximized(Boolean(maximized));
      });
    }

    // Keep class for the life of the desktop session (do not remove on route change)
    return undefined;
  }, [isElectron]);

  if (!isElectron) return null;

  return (
    <div className="titlebar" role="banner">
      <div className="titlebar-brand">
        <div className="titlebar-logo" aria-hidden>
          D
        </div>
        <span className="titlebar-title">Descall</span>
      </div>

      <div className="titlebar-controls">
        <button
          type="button"
          className="win-btn minimize"
          onClick={() => window.electronAPI?.minimizeWindow?.()}
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="win-btn maximize"
          onClick={() => window.electronAPI?.maximizeWindow?.()}
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Square size={12} strokeWidth={2} />
          ) : (
            <Square size={14} strokeWidth={2} />
          )}
        </button>
        <button
          type="button"
          className="win-btn close"
          onClick={() => window.electronAPI?.closeWindow?.()}
          title="Close"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
