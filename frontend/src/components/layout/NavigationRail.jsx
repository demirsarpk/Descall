import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Users, Settings,
  UserPlus, Phone, Shield, Plus, Zap, Crosshair
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { STATUS_META } from "../../lib/presence";
import { getUser } from "../../lib/storage";
import { resolveAvatarUrl, resolveDisplayName } from "../../lib/userProfile";
import { useT } from "../../context/LocaleContext";
import DescallBrand from "../brand/DescallBrand";

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
  const t = useT();
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const avatarBtnRef = useRef(null);
  const menuRef = useRef(null);

  const navItems = useMemo(
    () => [
      { id: "chat", icon: MessageSquare, label: t("nav.chats") },
      { id: "groups", icon: Users, label: t("nav.groups") },
      { id: "play", icon: Crosshair, label: t("nav.play") },
      { id: "friends", icon: UserPlus, label: t("nav.friends") },
      { id: "activity", icon: Zap, label: t("Activity") },
      { id: "calls", icon: Phone, label: t("nav.calls") },
    ],
    [t]
  );

  const statusKey = STATUS_META[myStatus] ? myStatus : "online";

  // Prefer live `me`, fall back to persisted session user so the rail never
  // flashes the letter placeholder when profile state briefly lags.
  const storedUser = getUser();
  const railUser = me?.avatarUrl || me?.avatar_url
    ? me
    : (storedUser && (!me?.id || storedUser.id === me.id) ? { ...me, ...storedUser } : me);
  const railAvatarUrl =
    resolveAvatarUrl(railUser) ||
    resolveAvatarUrl(storedUser) ||
    me?.avatarUrl ||
    me?.avatar_url ||
    storedUser?.avatarUrl ||
    storedUser?.avatar_url ||
    null;

  const placeMenu = () => {
    const el = avatarBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = 220;
    const gap = 10;
    let left = rect.right + gap;
    // If near right edge, flip left of avatar
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.left - menuWidth - gap);
    }
    // Anchor bottom of menu near avatar bottom
    const estimatedHeight = 260;
    let top = rect.bottom - estimatedHeight;
    if (top < 8) top = 8;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - estimatedHeight - 8);
    }
    setMenuPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!statusOpen) return undefined;
    placeMenu();
    const onReposition = () => placeMenu();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [statusOpen]);

  useEffect(() => {
    if (!statusOpen) return undefined;
    const onDoc = (e) => {
      if (avatarBtnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setStatusOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setStatusOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [statusOpen]);

  const statusMenu = (
    <AnimatePresence>
      {statusOpen && (
        <motion.div
          ref={menuRef}
          className="status-picker status-picker-portal"
          style={{ top: menuPos.top, left: menuPos.left }}
          role="menu"
          aria-label={t("Status")}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.14 }}
        >
          <div className="status-picker-header">{t("Set status")}</div>
          {STATUS_OPTIONS.map((key) => (
            <button
              key={key}
              type="button"
              role="menuitemradio"
              aria-checked={statusKey === key}
              className={`status-picker-item ${statusKey === key ? "active" : ""}`}
              onClick={() => {
                onStatusChange?.(key);
                setStatusOpen(false);
              }}
            >
              <span
                className={`status-picker-dot status-${key}`}
                style={{ background: STATUS_META[key]?.color || "var(--text-muted)" }}
              />
              <span className="status-picker-label">
                {t(key === "dnd" ? "Do Not Disturb" : STATUS_META[key]?.label || key)}
              </span>
            </button>
          ))}
          <div className="status-picker-divider" />
          <button
            type="button"
            role="menuitem"
            className="status-picker-item"
            onClick={() => {
              setStatusOpen(false);
              onUserClick?.();
            }}
          >
            <Settings size={15} />
            <span className="status-picker-label">{t("settings.title")}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <nav className="nav-rail">
      <div className="nav-rail-brand">
        {/* Icon-only: the full "Descall" wordmark doesn't fit this 72px/60px
            icon rail and was getting clipped to "Desc" by overflow:hidden. */}
        <DescallBrand compact />
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
          title={t("Add New")}
        >
          <Plus size={24} strokeWidth={2} />
        </motion.button>

        <motion.button
          className="rail-btn"
          onClick={onUserClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={t("settings.title")}
        >
          <Settings size={24} strokeWidth={2} />
        </motion.button>

        {isAdmin && (
          <motion.button
            className="rail-btn admin-btn"
            onClick={onAdminClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={t("admin.title")}
          >
            <Shield size={24} strokeWidth={2} />
          </motion.button>
        )}
      </div>

      <div className="nav-rail-bottom">
        <button
          type="button"
          ref={avatarBtnRef}
          className="rail-user-panel"
          onClick={() => setStatusOpen((v) => !v)}
          title={`${t(statusKey === "dnd" ? "Do Not Disturb" : STATUS_META[statusKey]?.label || "Online")} — ${t("change status")}`}
          aria-haspopup="menu"
          aria-expanded={statusOpen}
        >
          <div className="rail-user-avatar-wrap">
            <Avatar
              name={resolveDisplayName(railUser || me)}
              size={36}
              user={railUser}
              imageUrl={railAvatarUrl}
              animate="always"
              loading="eager"
            />
            <span className={`rail-user-status-dot status-${statusKey}`} />
          </div>
        </button>
      </div>

      {typeof document !== "undefined" ? createPortal(statusMenu, document.body) : null}
    </nav>
  );
}
