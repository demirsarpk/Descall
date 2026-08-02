import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Users, Settings,
  UserPlus, Phone, Shield, Plus, Zap
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { STATUS_META } from "../../lib/presence";

const STATUS_OPTIONS = ["online", "idle", "dnd", "invisible"];

export default function NavigationRail({
  activeView,
  onViewChange,
  onAdminClick,
  onUserClick,
  onAddClick,
  onVoiceClick,
  me,
  isAdmin,
  myStatus = "online",
  onStatusChange,
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const statusWrapRef = useRef(null);

  const navItems = [
    { id: "chat",     icon: MessageSquare, label: "Chats"    },
    { id: "groups",   icon: Users,         label: "Groups"   },
    { id: "friends",  icon: UserPlus,      label: "Friends"  },
    { id: "activity", icon: Zap,           label: "Activity" },
    { id: "calls",    icon: Phone,         label: "Calls"    },
  ];

  useEffect(() => {
    if (!statusOpen) return undefined;
    const onDoc = (e) => {
      if (!statusWrapRef.current?.contains(e.target)) setStatusOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [statusOpen]);

  const statusKey = STATUS_META[myStatus] ? myStatus : "online";

  return (
    <nav className="nav-rail">
      <div className="nav-rail-brand">
        <div className="brand-icon">D</div>
        <span className="brand-wordmark">descall</span>
      </div>

      <div className="nav-rail-main">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <motion.button
              key={item.id}
              className={`rail-btn ${isActive ? "active" : ""}`}
              onClick={() => onViewChange(item.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={item.label}
            >
              <Icon size={24} strokeWidth={2} />
            </motion.button>
          );
        })}

        <div className="nav-rail-divider" />

        <motion.button
          className="rail-btn"
          onClick={onAddClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Add New"
        >
          <Plus size={24} strokeWidth={2} />
        </motion.button>

        <motion.button
          className="rail-btn"
          onClick={onUserClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="User Settings"
        >
          <Settings size={24} strokeWidth={2} />
        </motion.button>

        {isAdmin && (
          <motion.button
            className="rail-btn admin-btn"
            onClick={onAdminClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Admin Panel"
          >
            <Shield size={24} strokeWidth={2} />
          </motion.button>
        )}
      </div>

      <div className="nav-rail-bottom">
        <div className="rail-user-status-wrap" ref={statusWrapRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="rail-user-panel"
            onClick={() => setStatusOpen((v) => !v)}
            onDoubleClick={onUserClick}
            title={`${STATUS_META[statusKey]?.label || "Online"} — click to change`}
          >
            <div className="rail-user-avatar-wrap">
              <Avatar
                name={me?.username || "User"}
                size={36}
                user={me}
              />
              <span className={`rail-user-status-dot status-${statusKey}`} />
            </div>
          </button>

          <AnimatePresence>
            {statusOpen && (
              <motion.div
                className="status-picker"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
              >
                {STATUS_OPTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`status-picker-item ${statusKey === key ? "active" : ""}`}
                    onClick={() => {
                      onStatusChange?.(key);
                      setStatusOpen(false);
                    }}
                  >
                    <span
                      className="status-picker-dot"
                      style={{ background: STATUS_META[key]?.color || "var(--text-muted)" }}
                    />
                    {STATUS_META[key]?.label || key}
                  </button>
                ))}
                <button
                  type="button"
                  className="status-picker-item"
                  onClick={() => {
                    setStatusOpen(false);
                    onUserClick?.();
                  }}
                >
                  <Settings size={14} />
                  User Settings
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
