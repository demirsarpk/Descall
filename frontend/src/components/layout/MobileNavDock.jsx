import { useMemo } from "react";
import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useT } from "../../context/LocaleContext";
import {
  buildMobileDockItems,
  NAV_ICON_SIZE_MOBILE,
  NAV_ICON_STROKE,
} from "./navConfig";

/**
 * Floating glass bottom navigation for phones.
 * Replaces the squeezed desktop rail on mobile — primary destinations only.
 */
export default function MobileNavDock({
  activeView,
  onViewChange,
  onSettingsClick,
  hidden = false,
}) {
  const t = useT();
  const items = useMemo(() => buildMobileDockItems(t), [t]);

  if (hidden) return null;

  return (
    <nav className="mobile-nav-dock" aria-label={t("Primary navigation")}>
      <div className="mobile-nav-dock-shell">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              type="button"
              className={`mobile-nav-dock-btn ${isActive ? "active" : ""}`}
              onClick={() => onViewChange?.(item.id)}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="mobile-nav-dock-icon">
                <Icon size={NAV_ICON_SIZE_MOBILE} strokeWidth={NAV_ICON_STROKE} />
              </span>
              <span className="mobile-nav-dock-label">{item.label}</span>
            </motion.button>
          );
        })}
        <motion.button
          type="button"
          className="mobile-nav-dock-btn"
          onClick={onSettingsClick}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          aria-label={t("You")}
        >
          <span className="mobile-nav-dock-icon">
            <Settings size={NAV_ICON_SIZE_MOBILE} strokeWidth={NAV_ICON_STROKE} />
          </span>
          <span className="mobile-nav-dock-label">{t("You")}</span>
        </motion.button>
      </div>
    </nav>
  );
}
