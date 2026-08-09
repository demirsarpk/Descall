import { useRef, useEffect, useState, useMemo, cloneElement, isValidElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Video, Users, Hash,
  Settings, Search, MessageSquare, X, ChevronDown, ChevronRight, Menu, ChevronLeft,
  UserPlus, Plus, Crown
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import MessageList from "../chat/MessageList";
import MessageComposer from "../chat/MessageComposer";
import ActiveCallBanner from "../ActiveCallBanner";
import ActivityView from "../activity/ActivityView";
import TypingIndicator from "../chat/TypingIndicator";
import GuildChatView from "../servers/GuildChatView";
import EmptyState from "../ui/EmptyState";
import CallsView from "../calls/CallsView";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";
import { getPresenceStatus, STATUS_META, isVisiblyOnline } from "../../lib/presence";
import { resolveDisplayName } from "../../lib/userProfile";
import { useT } from "../../context/LocaleContext";
import AdminBadge from "../social/AdminBadge";
import UserProfileModal from "../social/UserProfileModal";

export default function ChatPanel({
  activeView,
  activeDmUser,
  activeGroup,
  activeGuild,
  activeGuildChannel,
  socket,
  me,
  sidebarCollapsed,
  onlineUsers,
  messages = [],
  friendNotice,
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  onGroupVoiceCall,
  onGroupVideoCall,
  onSettings,
  activeCallBanner,
  onJoinActiveCall,
  onDismissActiveBanner,
  activity,
  friends,
  typingDmUser,
  typingGroupUsers,
  onTypingDmStart,
  onTypingDmStop,
  onTypingGroupStart,
  onTypingGroupStop,
  replyTo = null,
  onClearReply,
  isMobile = false,
  onMenuClick,
  onMobileBack,
  showMobileBack = false,
  onAddClick,
  onViewChange,
  onStartCall,
  onOpenChatFromCalls,
  onStartGroupCall,
  onOpenGroupFromCalls,
  onStartDm,
  groups = [],
  children
}) {
  const t = useT();
  const messagesRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [profileTarget, setProfileTarget] = useState(null);

  const typingNames = useMemo(() => {
    if (!activeDmUser && !activeGroup) return [];
    if (activeDmUser) return typingDmUser ? [resolveDisplayName(typingDmUser)] : [];
    const groupMap = typingGroupUsers?.[activeGroup.id];
    if (!(groupMap instanceof Map)) return [];
    return Array.from(groupMap.values()).map((u) => resolveDisplayName(u));
  }, [activeDmUser, activeGroup, typingDmUser, typingGroupUsers]);

  const scrollToBottom = () => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    setShowSearch(false);
    setSearchQuery("");
  }, [activeDmUser, activeGroup]);

  // Close members sheet when leaving a conversation surface
  useEffect(() => {
    if (!activeDmUser && !activeGroup) setShowMembers(false);
  }, [activeDmUser, activeGroup]);

  const getTitle = () => {
    if (activeDmUser) return resolveDisplayName(activeDmUser);
    if (activeGroup) return activeGroup.name;
    if (activeGuildChannel) return activeGuildChannel.name;
    if (activeView === "chat") return t("Chats");
    if (activeView === "dms") return t("Direct Messages");
    if (activeView === "groups") return t("Groups");
    if (activeView === "calls")    return t("Calls");
    if (activeView === "activity") return t("Activity");
    if (activeView === "servers") return activeGuild?.name || t("Servers");
    return t("Descall");
  };

  const getSubtitle = () => {
    if (activeDmUser) {
      const status = getPresenceStatus(onlineUsers, activeDmUser.id);
      const label = STATUS_META[status]?.label || "Offline";
      return t(label);
    }
    if (activeGroup) {
      return t("{count} members", { count: activeGroup.memberCount || 0 });
    }
    if (activeGuildChannel) {
      return activeGuild?.name || "";
    }
    return "";
  };

  const emptyCopy = (() => {
    if (activeView === "friends") {
      return {
        title: t("Find your friends"),
        body: isMobile
          ? t("Open the menu to see friends and who is online")
          : t("Add a friend to start chatting and calling"),
        primary: { label: t("Add friend"), action: () => onAddClick?.("friend"), icon: UserPlus },
        secondary: { label: t("Browse chats"), action: () => onViewChange?.("chat"), icon: MessageSquare },
        icon: Users,
        illustration: "friends",
      };
    }
    if (activeView === "groups") {
      return {
        title: t("No group selected"),
        body: isMobile
          ? t("Open the menu to browse your groups")
          : t("Create a group or pick one from the sidebar"),
        primary: { label: t("Create group"), action: () => onAddClick?.("group"), icon: Plus },
        secondary: { label: t("Find friends"), action: () => onViewChange?.("friends"), icon: UserPlus },
        icon: Users,
        illustration: "groups",
      };
    }
    if (activeView === "calls") {
      return {
        title: t("Ready when you are"),
        body: t("Pick a DM or group, then start a voice or video call"),
        primary: { label: t("Open chats"), action: () => onViewChange?.("chat"), icon: MessageSquare },
        secondary: { label: t("Open groups"), action: () => onViewChange?.("groups"), icon: Users },
        icon: Phone,
        illustration: "calls",
      };
    }
    return {
      title: t("Welcome to Descall"),
      body: isMobile
        ? t("Open the menu to select a conversation")
        : t("Select a conversation — or start a new one"),
      primary: { label: t("Start a chat"), action: () => onAddClick?.("friend"), icon: UserPlus },
      secondary: { label: t("Create group"), action: () => onAddClick?.("group"), icon: Plus },
      icon: MessageSquare,
      illustration: "chat",
    };
  })();

  return (
    <div className="chat-panel-shell">
      <main className="main-panel">
        {/* Header — hidden on activity view since ActivityView has its own header */}
        <header className="panel-header" style={activeView === "activity" ? { display: 'none' } : {}}>
        <div className="header-left">
          {isMobile && (
            <button
              type="button"
              className="icon-btn mobile-nav-btn"
              onClick={showMobileBack ? onMobileBack : onMenuClick}
              aria-label={showMobileBack ? t("Back to list") : t("Open menu")}
            >
              {showMobileBack ? <ChevronLeft size={22} /> : <Menu size={20} />}
            </button>
          )}
          {activeDmUser && (
            <button
              type="button"
              className="header-avatar"
              onClick={() => setProfileTarget(activeDmUser)}
              aria-label={t("View profile")}
              title={t("View profile")}
            >
              <Avatar 
                name={resolveDisplayName(activeDmUser)} 
                size={40}
                user={activeDmUser}
              />
              <StatusBadge status={getPresenceStatus(onlineUsers, activeDmUser.id)} />
            </button>
          )}
          {activeGroup && (
            <div className="header-icon">
              {activeGroup.icon ? (
                <img src={activeGroup.icon} alt={activeGroup.name} />
              ) : (
                <span>{activeGroup.name?.charAt(0)?.toUpperCase()}</span>
              )}
            </div>
          )}
          {activeGuildChannel && (
            <div className="header-icon" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              <Hash size={20} />
            </div>
          )}
          <div
            className="header-title-block"
            role={activeDmUser ? "button" : undefined}
            tabIndex={activeDmUser ? 0 : undefined}
            onClick={activeDmUser ? () => setProfileTarget(activeDmUser) : undefined}
            onKeyDown={activeDmUser ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setProfileTarget(activeDmUser);
              }
            } : undefined}
            title={activeDmUser ? t("View profile") : undefined}
            style={{ cursor: activeDmUser ? "pointer" : "default" }}
          >
            <h1
              className="header-title"
              style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap" }}
            >
              {getTitle()}
              {activeDmUser && <AdminBadge user={activeDmUser} variant="inline" />}
            </h1>
            {getSubtitle() && (
              <span className="header-subtitle">{getSubtitle()}</span>
            )}
          </div>
        </div>

        <div className="header-right">
          <button
            className={`icon-btn ${showSearch ? "active" : ""}`}
            title={t("Search")}
            onClick={() => { setShowSearch(!showSearch); setShowMembers(false); }}
          >
            <Search size={20} />
          </button>
          <button
            className={`icon-btn ${showMembers ? "active" : ""}`}
            title={t("Members")}
            onClick={() => { setShowMembers(!showMembers); setShowSearch(false); }}
          >
            <Users size={20} />
          </button>
          {(activeDmUser || activeGroup) && (
            <>
              <button 
                className="icon-btn" 
                title={t("Voice Call")}
                onClick={() => activeGroup ? onGroupVoiceCall?.() : onVoiceCall?.()}
              >
                <Phone size={20} />
              </button>
              <button 
                className="icon-btn" 
                title={t("Video Call")}
                onClick={() => activeGroup ? onGroupVideoCall?.() : onVideoCall?.()}
              >
                <Video size={20} />
              </button>
            </>
          )}
          <button 
            className="icon-btn" 
            title={t("Settings")}
            onClick={() => onSettings?.()}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Friend Notice Banner */}
      <AnimatePresence>
        {friendNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="friend-notice-banner"
            style={{
              padding: "10px 16px",
              backgroundColor: "var(--primary-soft)",
              color: "var(--primary)",
              fontSize: "13px",
              fontWeight: 500,
              textAlign: "center",
              borderBottom: "1px solid var(--border)"
            }}
          >
            {friendNotice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity view fills the full panel — rendered outside messages-container to avoid double-scroll */}
      {activeView === "activity" ? (
        <ActivityView
          me={activity?.me}
          currentActivity={activity?.currentActivity}
          manualOverride={activity?.manualOverride}
          history={activity?.history}
          friendPresence={activity?.friendPresence}
          friends={friends}
          settings={activity?.settings}
          isElectron={activity?.isElectron}
          onSetManual={activity?.setManual}
          onClearManual={activity?.clearManual}
          onUpdatePrivacy={activity?.updatePrivacy}
          onlineUsers={onlineUsers}
        />
      ) : activeView === "calls" && !activeDmUser && !activeGroup ? (
        <CallsView
          me={me}
          friends={friends}
          groups={groups}
          onlineUsers={onlineUsers}
          socket={socket}
          onStartCall={onStartCall}
          onStartGroupCall={onStartGroupCall}
          onOpenChat={onOpenChatFromCalls}
          onOpenGroup={onOpenGroupFromCalls}
        />
      ) : activeGuildChannel ? (
        <GuildChatView
          socket={socket}
          me={me}
          guildId={activeGuild?.id}
          channelId={activeGuildChannel?.id}
          channelName={activeGuildChannel?.name}
        />
      ) : (
      <div className="messages-container" ref={messagesRef}>
        {showSearch && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="chat-search-bar">
            <Search size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search messages...")}
              autoFocus
            />
            <button className="icon-btn" onClick={() => { setShowSearch(false); setSearchQuery(""); }}><X size={16} /></button>
          </motion.div>
        )}
        {(activeDmUser || activeGroup) ? (
          isValidElement(children)
            ? cloneElement(children, { searchQuery: showSearch ? searchQuery : "" })
            : children
        ) : (
          <EmptyState
            icon={emptyCopy.icon || MessageSquare}
            title={emptyCopy.title}
            body={emptyCopy.body}
            illustration={emptyCopy.illustration || "chat"}
            primary={!isMobile ? emptyCopy.primary : undefined}
            secondary={!isMobile ? emptyCopy.secondary : undefined}
          />
        )}
      </div>
      )}

      {/* Typing + composer only on real chat surfaces — never under Activity / guild views */}
      {activeView !== "activity" && !activeGuildChannel && (activeDmUser || activeGroup) && (
        <>
          <AnimatePresence>
            {typingNames.length > 0 && (
              <motion.div
                key="typing-bar"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                style={{ padding: "0 16px 4px", overflow: "hidden" }}
              >
                <TypingIndicator names={typingNames} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="composer-container">
            <MessageComposer
              onSend={onSendMessage}
              disabled={!activeDmUser && !activeGroup}
              activeDmUser={activeDmUser}
              activeGroup={activeGroup}
              onTypingDmStart={onTypingDmStart}
              onTypingDmStop={onTypingDmStop}
              onTypingGroupStart={onTypingGroupStart}
              onTypingGroupStop={onTypingGroupStop}
              replyTo={replyTo}
              onClearReply={onClearReply}
            />
          </div>
        </>
      )}
    </main>

    <UserProfileModal
      open={!!profileTarget}
      onClose={() => setProfileTarget(null)}
      userId={profileTarget?.id}
      username={profileTarget?.username}
      avatarUrl={profileTarget?.avatarUrl || profileTarget?.avatar_url}
      me={me}
      friends={friends}
      onlineUsers={onlineUsers}
      onStartDm={onStartDm}
    />

    {/* Members Panel */}
    <AnimatePresence>
      {showMembers && (
        <>
          <motion.div
            key="members-backdrop"
            className="members-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowMembers(false)}
            aria-hidden="true"
          />
          <motion.aside
            key="members-panel"
            className="members-panel"
            role="complementary"
            aria-label={t("Members")}
            initial={isMobile ? { x: "100%" } : { x: 24, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { x: "100%" } : { x: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
            {(() => {
              const raw =
                activeGroup?.members?.length > 0
                  ? activeGroup.members
                  : activeDmUser
                    ? [activeDmUser]
                    : [];
              const ownerId = activeGroup?.created_by ?? null;
              const decorated = raw.map((m) => {
                const status = getPresenceStatus(onlineUsers, m.id);
                return {
                  ...m,
                  _status: status,
                  _online: isVisiblyOnline(onlineUsers, m.id),
                  _isOwner: ownerId != null && m.id === ownerId,
                };
              });
              const online = decorated
                .filter((m) => m._online)
                .sort((a, b) => Number(b._isOwner) - Number(a._isOwner) || resolveDisplayName(a).localeCompare(resolveDisplayName(b)));
              const offline = decorated
                .filter((m) => !m._online)
                .sort((a, b) => Number(b._isOwner) - Number(a._isOwner) || resolveDisplayName(a).localeCompare(resolveDisplayName(b)));

              const renderRow = (m) => {
                const name = resolveDisplayName(m);
                const statusLabel = t(STATUS_META[m._status]?.label || "Offline");
                return (
                  <div
                    key={m.id}
                    className={`member-row${m._online ? "" : " is-offline"}`}
                  >
                    <div className="member-avatar-wrap">
                      <Avatar name={name} size={36} user={m} />
                      <StatusBadge status={m._status} />
                    </div>
                    <div className="member-meta">
                      <div className="member-name-row">
                        <span className="member-name">{name}</span>
                        <AdminBadge user={m} variant="inline" />
                        {m._isOwner && (
                          <span className="member-owner-badge" title={t("Owner")}>
                            <Crown size={11} strokeWidth={2.25} aria-hidden="true" />
                            <span className="member-owner-text">{t("Owner")}</span>
                          </span>
                        )}
                      </div>
                      <span className="member-status-label">{statusLabel}</span>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  <div className="members-panel-header">
                    <h4>
                      {t("Members")}
                      <span className="members-panel-count">{decorated.length}</span>
                    </h4>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setShowMembers(false)}
                      title={t("Close")}
                      aria-label={t("Close")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="members-panel-scroll">
                    {online.length > 0 && (
                      <section className="members-section">
                        <h5 className="members-section-label">
                          {t("Online — {count}", { count: online.length })}
                        </h5>
                        <div className="members-section-list">{online.map(renderRow)}</div>
                      </section>
                    )}
                    {offline.length > 0 && (
                      <section className="members-section">
                        <h5 className="members-section-label">
                          {t("Offline — {count}", { count: offline.length })}
                        </h5>
                        <div className="members-section-list">{offline.map(renderRow)}</div>
                      </section>
                    )}
                    {decorated.length === 0 && (
                      <p className="members-empty">{t("No members")}</p>
                    )}
                  </div>
                </>
              );
            })()}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
    </div>
  );
}

