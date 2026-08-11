import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { STATUS_META } from "../../lib/presence";
import { getUser } from "../../lib/storage";
import { resolveAvatarUrl, resolveDisplayName } from "../../lib/userProfile";
import { useT } from "../../context/LocaleContext";
import DescallBrand from "../brand/DescallBrand";
import {
  buildMainNavItems,
  buildToolNavItems,
  NAV_ICON_SIZE,
  NAV_ICON_STROKE,
} from "./navConfig";

const STATUS_OPTIONS = ["online", "idle", "dnd", "invisible"];

function RailButton({
  active = false,
  className = "",
  label,
  onClick,
  children,
  ...rest
}) {
  const btnRef = useRef(null);
  const [tip, setTip] = useState(null);

  const showTip = () => {
    const el = btnRef.current;
    if (!el || !label) return;
    const rect = el.getBoundingClientRect();
    setTip({
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  };

  const hideTip = () => setTip(null);

  return (
    <>
      <motion.button
        ref={btnRef}
        type="button"
        className={`rail-btn ${active ? "active" : ""} ${className}`.trim()}
        onClick={onClick}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        data-tooltip={label}
        {...rest}
      >
        <span className="rail-btn-inner">{children}</span>
      </motion.button>
      {typeof document !== "undefined" &&
        tip &&
        createPortal(
          <motion.div
            className="rail-tooltip"
            role="tooltip"
            style={{ top: tip.top, left: tip.left }}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {label}
          </motion.div>,
          document.body
        )}
    </>
  );
}

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

  const mainItems = useMemo(() => buildMainNavItems(t), [t]);
  const toolItems = useMemo(() => buildToolNavItems(t, { isAdmin }), [t, isAdmin]);

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
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.left - menuWidth - gap);
    }
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

  const handleToolAction = (action) => {
    if (action === "add") onAddClick?.();
    else if (action === "settings") onUserClick?.();
    else if (action === "admin") onAdminClick?.();
  };

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
            <Settings size={15} strokeWidth={NAV_ICON_STROKE} />
            <span className="status-picker-label">{t("settings.title")}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <nav className="nav-rail" aria-label={t("Primary navigation")}>
      <div className="nav-rail-brand">
        <div className="nav-rail-logo" aria-hidden="true">
          <DescallBrand compact />
        </div>
      </div>

      <div className="nav-rail-main">
        <div className="nav-rail-group" role="group" aria-label={t("nav.chats")}>
          {mainItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <RailButton
                key={item.id}
                active={isActive}
                label={item.label}
                onClick={() => onViewChange(item.id)}
              >
                <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
              </RailButton>
            );
          })}
        </div>

        <div className="nav-rail-divider" role="separator" aria-hidden="true" />

        <div className="nav-rail-group" role="group" aria-label={t("settings.title")}>
          {toolItems.map((item) => {
            const Icon = item.icon;
            return (
              <RailButton
                key={item.id}
                className={item.action === "admin" ? "admin-btn" : ""}
                label={item.label}
                onClick={() => handleToolAction(item.action)}
              >
                <Icon size={NAV_ICON_SIZE} strokeWidth={NAV_ICON_STROKE} />
              </RailButton>
            );
          })}
        </div>
      </div>

      <div className="nav-rail-bottom">
        <button
          type="button"
          ref={avatarBtnRef}
          className="rail-user-panel"
          onClick={() => setStatusOpen((v) => !v)}
          title={`${t(statusKey === "dnd" ? "Do Not Disturb" : STATUS_META[statusKey]?.label || "Online")} — ${t("change status")}`}
          aria-label={`${resolveDisplayName(railUser || me) || t("You")} — ${t("change status")}`}
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
