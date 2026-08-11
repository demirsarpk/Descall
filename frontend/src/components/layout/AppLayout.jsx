import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, MessageSquare, Users, Phone, Activity, Settings, Crosshair } from "lucide-react";
import NavigationRail from "./NavigationRail";
import ServerSidebar from "./ServerSidebar";
import ChatPanel from "./ChatPanel";
import UserPanel from "./UserPanel";
import ActivitySidebar from "../activity/ActivitySidebar";
import FeedbackNudgeBanner from "../feedback/FeedbackNudgeBanner";
import FeedbackModal from "../feedback/FeedbackModal";
import LfgWorkspace from "../lfg/LfgWorkspace";
import { useActivity } from "../../hooks/useActivity";
import { useMobile } from "../../hooks/useMobile";
import { useMobileKeyboard } from "../../hooks/useMobileKeyboard";
import { useT } from "../../context/LocaleContext";

/**
 * Single shared layout — desktop grid, mobile drawer adaptation.
 */
export default function AppLayout({
  children,
  me,
  socket,
  onLogout,
  onProfileUpdated,
  activeDmUser,
  activeGroup,
  groups,
  dms,
  friends,
  onlineUsers,
  onDmSelect,
  onGroupSelect,
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  onGroupVoiceCall,
  onGroupVideoCall,
  onStartCall,
  onStartGroupCallFromCalls,
  onAdminClick,
  isAdmin,
  onRefreshGroups,
  onGroupCreated,
  onGroupLeft,
  onGroupRenamed,
  onRefresh,
  friendNotice,
  activeCallBanner,
  onJoinActiveCall,
  onDismissActiveBanner,
  friendRequests,
  onAcceptFriend,
  onDeclineFriend,
  notifPermission,
  onRequestNotifPermission,
  typingDmUser,
  typingGroupUsers,
  onTypingDmStart,
  onTypingDmStop,
  onTypingGroupStart,
  onTypingGroupStop,
  guilds,
  activeGuild,
  activeGuildChannel,
  onGuildSelect,
  onGuildChannelSelect,
  onCreateGuild,
  onJoinGuild,
  onLeaveGuild,
  onDeleteGuild,
  onRefreshGuilds,
  dmUnread = {},
  groupUnread = {},
  myStatus = "online",
  onStatusChange,
  replyTo = null,
  onClearReply,
  activeView: controlledActiveView,
  onActiveViewChange,
  userPanelOpen: controlledUserPanelOpen,
  onUserPanelOpenChange,
  settingsTab,
  onSettingsTabChange,
}) {
  const t = useT();
  const { isMobile } = useMobile();
  useMobileKeyboard(isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [localActiveView, setLocalActiveView] = useState("chat");
  const [localUserPanelOpen, setLocalUserPanelOpen] = useState(false);
  const activeView = controlledActiveView ?? localActiveView;
  const userPanelOpen = controlledUserPanelOpen ?? localUserPanelOpen;
  const setActiveView = useCallback((view) => {
    if (onActiveViewChange) onActiveViewChange(view);
    else setLocalActiveView(view);
  }, [onActiveViewChange]);
  const setUserPanelOpen = useCallback((open) => {
    if (onUserPanelOpenChange) onUserPanelOpenChange(open);
    else setLocalUserPanelOpen(open);
  }, [onUserPanelOpenChange]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState("friend");
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const activity = useActivity({ socket, me, friends });

  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  const openMobileDrawer = useCallback(() => setMobileDrawerOpen(true), []);

  useEffect(() => {
    const onOpenFeedback = () => setShowFeedbackModal(true);
    window.addEventListener("descall:open-feedback", onOpenFeedback);
    return () => window.removeEventListener("descall:open-feedback", onOpenFeedback);
  }, []);

  const openUserPanel = useCallback(() => {
    setUserPanelOpen(true);
    if (isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  const closeUserPanel = useCallback(() => {
    setUserPanelOpen(false);
    if (isMobile && !activeDmUser && !activeGroup && !activeGuildChannel) {
      setMobileDrawerOpen(true);
    }
  }, [isMobile, activeDmUser, activeGroup, activeGuildChannel]);

  useEffect(() => {
    if (!isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile && !activeDmUser && !activeGroup && !activeGuildChannel) {
      setMobileDrawerOpen(true);
    }
  }, [isMobile, activeDmUser, activeGroup, activeGuildChannel]);

  useEffect(() => {
    if (!isMobile || !mobileDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, mobileDrawerOpen]);

  useEffect(() => {
    if (!isMobile || !userPanelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, userPanelOpen]);

  useEffect(() => {
    if (!userPanelOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeUserPanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userPanelOpen, closeUserPanel]);

  const handleDmSelect = useCallback((dm) => {
    onDmSelect?.(dm);
    if (isMobile) setMobileDrawerOpen(false);
  }, [onDmSelect, isMobile]);

  const handleGroupSelect = useCallback((group) => {
    onGroupSelect?.(group);
    if (isMobile) setMobileDrawerOpen(false);
  }, [onGroupSelect, isMobile]);

  const handleOpenChatFromCalls = useCallback((user) => {
    if (!user?.id) return;
    setActiveView("chat");
    handleDmSelect(user);
  }, [handleDmSelect]);

  const handleOpenGroupFromCalls = useCallback((group) => {
    if (!group?.id) return;
    setActiveView("groups");
    handleGroupSelect(group);
  }, [handleGroupSelect]);

  const handleStartCall = useCallback((user, type = "voice") => {
    if (!user?.id) return;
    onStartCall?.(user, type);
  }, [onStartCall]);

  const handleStartGroupCallFromCalls = useCallback((group, type = "voice") => {
    if (!group?.id) return;
    onStartGroupCallFromCalls?.(group, type);
  }, [onStartGroupCallFromCalls]);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
    if (view === "calls" || view === "activity" || view === "friends" || view === "play") {
      // Leave conversation so the dedicated view can fill the main panel
      if (activeDmUser) onDmSelect?.(null);
      if (activeGroup) onGroupSelect?.(null);
    }
    if (isMobile) {
      // Play + Activity are full-page layouts (no list drawer overlay).
      // Friends/calls/chat open the drawer to pick a conversation.
      setMobileDrawerOpen(view !== "play" && view !== "activity");
    }
  }, [isMobile, activeDmUser, activeGroup, onDmSelect, onGroupSelect]);

  const handleMobileBack = useCallback(() => {
    if (activeDmUser) onDmSelect?.(null);
    if (activeGroup) onGroupSelect?.(null);
    openMobileDrawer();
  }, [activeDmUser, activeGroup, onDmSelect, onGroupSelect, openMobileDrawer]);

  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;
  const inConversation = !!(activeDmUser || activeGroup);
  // On a narrow conversation surface the fixed banner sits directly over the
  // DM header, stealing profile/voice-call taps. Offer it once the user leaves
  // the conversation instead.
  const showNotifBanner =
    !isElectron &&
    !notifBannerDismissed &&
    notifPermission === "default" &&
    !(isMobile && inConversation);

  const handleAddClick = (tab) => {
    if (tab === "friend" || tab === "group") setAddTab(tab);
    else if (activeView === "groups") setAddTab("group");
    else if (activeView === "friends") setAddTab("friend");
    else setAddTab("friend");
    setShowAddModal(true);
  };

  const handleVoiceClick = () => {
    if (activeDmUser && onVoiceCall) onVoiceCall();
    else if (activeGroup && onGroupVoiceCall) onGroupVoiceCall();
  };

  return (
    <div
      className={`app-root${isMobile ? " is-mobile" : ""}${mobileDrawerOpen ? " mobile-drawer-open" : ""}${userPanelOpen ? " mobile-settings-open" : ""}${isMobile && inConversation ? " in-conversation" : ""}`}
      data-view={activeView}
    >
      <AnimatePresence>
        {showNotifBanner && (
          <motion.div
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="app-notif-banner"
          >
            <Bell size={15} style={{ flexShrink: 0 }} />
            <span>{t("Allow notifications for messages, calls, and mentions")}</span>
            <button
              type="button"
              className="app-notif-banner-btn"
              onClick={async () => {
                await onRequestNotifPermission?.();
                setNotifBannerDismissed(true);
              }}
            >
              {t("Allow")}
            </button>
            <button
              type="button"
              className="app-notif-banner-dismiss"
              onClick={() => setNotifBannerDismissed(true)}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Soft feedback reminder — top banner, auto-hides in 10s */}
      {me && !showNotifBanner && <FeedbackNudgeBanner enabled />}
      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />

      {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {isMobile && mobileDrawerOpen && (
          <motion.button
            type="button"
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label={t("Close menu")}
            onClick={closeMobileDrawer}
          />
        )}
      </AnimatePresence>

      {/* Sidebar shell: left vertical nav rail + list sidebar (desktop + mobile drawer). */}
      <div className={`app-sidebar-shell${mobileDrawerOpen ? " open" : ""}`}>
        <NavigationRail
          activeView={activeView}
          onViewChange={handleViewChange}
          onAdminClick={onAdminClick}
          onUserClick={openUserPanel}
          onAddClick={handleAddClick}
          onVoiceClick={handleVoiceClick}
          me={me}
          isAdmin={isAdmin}
          myStatus={myStatus}
          onStatusChange={onStatusChange}
        />

        {activeView === "play" ? null : activeView === "activity" ? (
          <ActivitySidebar
            friends={friends}
            friendPresence={activity.friendPresence}
            onlineUsers={onlineUsers}
            onRefresh={onRefresh}
            onAddFriend={() => handleAddClick("friend")}
            onFriendSelect={handleDmSelect}
            /* Full-page on mobile (not a drawer) — X returns to chats like Play. */
            onMobileClose={isMobile ? () => handleViewChange("chat") : undefined}
          />
        ) : (
          <ServerSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            activeView={activeView}
            activeDmUser={activeDmUser}
            activeGroup={activeGroup}
            groups={groups}
            dms={dms}
            friends={friends}
            onlineUsers={onlineUsers}
            socket={socket}
            me={me}
            onDmSelect={handleDmSelect}
            onGroupSelect={handleGroupSelect}
            showAddModal={showAddModal}
            setShowAddModal={setShowAddModal}
            addTab={addTab}
            setAddTab={setAddTab}
            onFriendSelect={handleDmSelect}
            onRefreshGroups={onRefreshGroups}
            onGroupCreated={onGroupCreated}
            onGroupLeft={onGroupLeft}
            onGroupRenamed={onGroupRenamed}
            onRefresh={onRefresh}
            friendRequests={friendRequests}
            onAcceptFriend={onAcceptFriend}
            onDeclineFriend={onDeclineFriend}
            onMobileClose={isMobile ? closeMobileDrawer : undefined}
            isMobile={isMobile}
            dmUnread={dmUnread}
            groupUnread={groupUnread}
            onStartCall={handleStartCall}
            onStartGroupCall={handleStartGroupCallFromCalls}
            onOpenChatFromCalls={handleOpenChatFromCalls}
            onOpenGroupFromCalls={handleOpenGroupFromCalls}
          />
        )}
      </div>

      {activeView === "play" ? (
        <LfgWorkspace
          me={me}
          socket={socket}
          onClose={() => handleViewChange("chat")}
          onGroupCreated={onGroupCreated}
          onOpenGroup={(group) => {
            handleGroupSelect(group);
            setActiveView("groups");
          }}
          onJoinVoice={(group) => {
            handleGroupSelect(group);
            setActiveView("groups");
            // Defer so activeGroup is set before voice starts
            window.setTimeout(() => onGroupVoiceCall?.(), 80);
          }}
        />
      ) : (
      <ChatPanel
        activeView={activeView}
        activeDmUser={activeDmUser}
        activeGroup={activeGroup}
        activeGuild={activeGuild}
        activeGuildChannel={activeGuildChannel}
        socket={socket}
        me={me}
        sidebarCollapsed={sidebarCollapsed}
        onlineUsers={onlineUsers}
        friendNotice={friendNotice}
        onSendMessage={onSendMessage}
        onVoiceCall={onVoiceCall}
        onVideoCall={onVideoCall}
        onGroupVoiceCall={onGroupVoiceCall}
        onGroupVideoCall={onGroupVideoCall}
        onSettings={openUserPanel}
        activeCallBanner={activeCallBanner}
        onJoinActiveCall={onJoinActiveCall}
        onDismissActiveBanner={onDismissActiveBanner}
        activity={{ ...activity, me }}
        friends={friends}
        typingDmUser={typingDmUser}
        typingGroupUsers={typingGroupUsers}
        onTypingDmStart={onTypingDmStart}
        onTypingDmStop={onTypingDmStop}
        onTypingGroupStart={onTypingGroupStart}
        onTypingGroupStop={onTypingGroupStop}
        replyTo={replyTo}
        onClearReply={onClearReply}
        isMobile={isMobile}
        onMenuClick={openMobileDrawer}
        onMobileBack={handleMobileBack}
        showMobileBack={isMobile && inConversation}
        onAddClick={handleAddClick}
        onViewChange={handleViewChange}
        onStartCall={handleStartCall}
        onStartGroupCall={handleStartGroupCallFromCalls}
        onOpenChatFromCalls={handleOpenChatFromCalls}
        onOpenGroupFromCalls={handleOpenGroupFromCalls}
        onStartDm={handleOpenChatFromCalls}
        onRefresh={onRefresh}
        groups={groups}
      >
        {children}
      </ChatPanel>
      )}

      <AnimatePresence>
        {userPanelOpen && (
          <UserPanel
            key="user-settings-panel"
            me={me}
            onClose={closeUserPanel}
            onLogout={onLogout}
            onProfileUpdated={onProfileUpdated}
            myStatus={myStatus}
            onStatusChange={onStatusChange}
            initialTab={settingsTab}
            onTabChange={onSettingsTabChange}
          />
        )}
      </AnimatePresence>

      {isMobile && !userPanelOpen && !inConversation && (
        <nav className="mobile-tab-bar" aria-label={t("Primary")}>
          <button
            type="button"
            className={`mobile-tab ${activeView === "chat" ? "active" : ""}`}
            onClick={() => handleViewChange("chat")}
          >
            <MessageSquare size={20} />
            <span>{t("Chat")}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${activeView === "friends" ? "active" : ""}`}
            onClick={() => handleViewChange("friends")}
          >
            <Users size={20} />
            <span>{t("Friends")}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${activeView === "play" ? "active" : ""}`}
            onClick={() => handleViewChange("play")}
          >
            <Crosshair size={20} />
            <span>{t("Play")}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${activeView === "calls" ? "active" : ""}`}
            onClick={() => handleViewChange("calls")}
          >
            <Phone size={20} />
            <span>{t("Calls")}</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${activeView === "activity" ? "active" : ""}`}
            onClick={() => handleViewChange("activity")}
          >
            <Activity size={20} />
            <span>{t("Activity")}</span>
          </button>
          <button
            type="button"
            className="mobile-tab"
            onClick={openUserPanel}
          >
            <Settings size={20} />
            <span>{t("You")}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
