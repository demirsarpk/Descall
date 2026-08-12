import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { Avatar } from "../components/ui/Avatar";
import StatusBadge from "../components/ui/StatusBadge";

const ToastContext = createContext(null);

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => (prev || []).filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message, type = "info", meta = null) => {
    const allowed = ["info", "success", "error", "warning", "presence"];
    const t = allowed.includes(type) ? type : "info";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type: t, meta }]);
    setTimeout(() => {
      setToasts((prev) => (prev || []).filter((x) => x.id !== id));
    }, t === "presence" ? 4500 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast: push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            if (t.type === "presence") {
              const user = t.meta?.user || null;
              const name = t.meta?.name || t.message;
              return (
                <motion.div
                  key={t.id}
                  className="toast-item toast-presence"
                  initial={{ opacity: 0, y: 16, scale: 0.96, x: 12 }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                >
                  <div className="toast-presence-avatar">
                    <Avatar name={name} size={36} user={user} animate="always" />
                    <StatusBadge status="online" />
                  </div>
                  <div className="toast-presence-copy">
                    <span className="toast-presence-title">{name}</span>
                    <span className="toast-presence-sub">{t.meta?.subtitle || "Online"}</span>
                  </div>
                  <button
                    type="button"
                    className="toast-dismiss"
                    aria-label="Dismiss"
                    onClick={() => dismiss(t.id)}
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              );
            }

            const Icon = ICONS[t.type] || Info;
            return (
              <motion.div
                key={t.id}
                className={`toast-item toast-${t.type}`}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
              >
                <Icon size={18} className="toast-icon" aria-hidden />
                <div className="toast-body">{t.message}</div>
                <button
                  type="button"
                  className="toast-dismiss"
                  aria-label="Dismiss"
                  onClick={() => dismiss(t.id)}
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {} };
  return ctx;
}
