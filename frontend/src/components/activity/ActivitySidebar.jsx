import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Search,
  RefreshCw,
  Megaphone,
  MessageSquarePlus,
  Plus,
  X,
  Users,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { getPresenceStatus, isVisiblyOnline } from "../../lib/presence";
import { openFeedbackModal } from "../../lib/feedbackNudge";
import { useT } from "../../context/LocaleContext";

const TYPE_COLOR = {
  game: "#23a55a",
  music: "#1db954",
  dev: "#5865f2",
  creative: "#eb459e",
  browser: "#4f9ef8",
  communication: "#5865f2",
  media: "#f0b232",
  launcher: "#747f8d",
  manual: "#5865f2",
  app: "#747f8d",
};

export function PresenceCard({ friend, presence, onlineUsers, onSelect }) {
  const t = useT();
  const status = getPresenceStatus(onlineUsers, friend.id);
  const isOnline = isVisiblyOnline(onlineUsers, friend.id);
  const accentColor = presence ? TYPE_COLOR[presence.appType] || "#5865f2" : null;

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="activity-presence-card"
      style={{ borderLeftColor: accentColor || "transparent" }}
      onClick={() => onSelect?.(friend)}
    >
      <div className="activity-presence-avatar">
        <Avatar name={friend.username} user={friend} size={36} />
        <StatusBadge status={isOnline ? status : "offline"} />
      </div>
      <div className="activity-presence-info">
        <span className="activity-presence-name">{friend.username}</span>
        {presence ? (
          <span className="activity-presence-status" style={{ color: accentColor }}>
            <span className="activity-presence-icon">{presence.icon || "🎮"}</span>
            {presence.displayName}
          </span>
        ) : (
          <span className="activity-presence-idle">{t("Online")}</span>
        )}
      </div>
    </motion.button>
  );
}

export function useOnlinePresenceLists(friends, friendPresence, onlineUsers, searchQuery = "") {
  return useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const activeList = [];
    const idleList = [];
    for (const friend of friends || []) {
      const name = (friend.username || friend.displayName || "").toLowerCase();
      if (q && !name.includes(q)) continue;
      const presence = friendPresence?.[friend.id];
      const isOnline = isVisiblyOnline(onlineUsers, friend.id);
      if (!isOnline) continue;
      if (presence?.displayName) activeList.push({ friend, presence });
      else idleList.push({ friend, presence: null });
    }
    const typeOrder = ["game", "music", "creative", "dev", "media", "browser", "communication", "app", "manual"];
    activeList.sort(
      (a, b) => typeOrder.indexOf(a.presence?.appType) - typeOrder.indexOf(b.presence?.appType)
    );
    return { active: activeList, idle: idleList, onlineCount: activeList.length + idleList.length };
  }, [friends, friendPresence, onlineUsers, searchQuery]);
}

export default function ActivitySidebar({
  friends,
  friendPresence,
  onlineUsers,
  onRefresh,
  onMobileClose,
  onAddFriend,
  onFriendSelect,
}) {
  const t = useT();
  const searchRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { active, idle, onlineCount } = useOnlinePresenceLists(
    friends,
    friendPresence,
    onlineUsers,
    searchQuery
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  return (
    <aside className="sidebar-secondary activity-sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-header">
          <h2 className="sidebar-title">{t("Activity")}</h2>
          <div className="sidebar-actions">
            {onMobileClose && (
              <button
                type="button"
                className="icon-btn mobile-sidebar-close"
                onClick={onMobileClose}
                title={t("Close")}
              >
                <X size={18} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              title={t("Refresh")}
              onClick={handleRefresh}
            >
              <RefreshCw size={18} className={isRefreshing ? "spin-refresh" : ""} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t("Search")}
              onClick={() => searchRef.current?.focus()}
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t("Announcements")}
              onClick={() => openFeedbackModal({ type: "praise", source: "activity_sidebar" })}
            >
              <Megaphone size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t("Send Feedback")}
              onClick={() => openFeedbackModal({ type: "suggestion", source: "activity_sidebar" })}
            >
              <MessageSquarePlus size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t("Add friend")}
              onClick={() => onAddFriend?.()}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="sidebar-search">
          <Search size={16} className="search-icon" />
          <input
            ref={searchRef}
            type="text"
            placeholder={t("Search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="sidebar-content activity-sidebar-content">
          {onlineCount > 0 && (
            <div className="activity-sidebar-summary">
              <Users size={14} />
              <span>{t("{count} online", { count: onlineCount })}</span>
            </div>
          )}

          {active.length > 0 && (
            <div className="activity-sidebar-section">
              <div className="activity-sidebar-label">
                {t("Active Now — {count}", { count: active.length })}
              </div>
              <AnimatePresence initial={false}>
                {active.map(({ friend, presence }) => (
                  <PresenceCard
                    key={friend.id}
                    friend={friend}
                    presence={presence}
                    onlineUsers={onlineUsers}
                    onSelect={onFriendSelect}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {idle.length > 0 && (
            <div className="activity-sidebar-section" style={{ marginTop: active.length ? 12 : 0 }}>
              <div className="activity-sidebar-label">
                {t("Online — {count}", { count: idle.length })}
              </div>
              <AnimatePresence initial={false}>
                {idle.map(({ friend }) => (
                  <PresenceCard
                    key={friend.id}
                    friend={friend}
                    presence={null}
                    onlineUsers={onlineUsers}
                    onSelect={onFriendSelect}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {onlineCount === 0 && (
            <div className="activity-empty-state">
              <div className="activity-empty-icon">
                <Zap size={28} />
              </div>
              <p>{searchQuery.trim() ? t("No matches") : t("No friends online")}</p>
              <span>
                {searchQuery.trim()
                  ? t("Try a different name")
                  : t("When friends come online, their activity shows up here.")}
              </span>
              {!searchQuery.trim() && (
                <button type="button" className="activity-empty-cta" onClick={() => onAddFriend?.()}>
                  <Plus size={14} />
                  {t("Add friend")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
