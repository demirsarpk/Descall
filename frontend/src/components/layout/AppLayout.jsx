import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, MessageSquare, Users, Phone, Activity, Settings } from "lucide-react";
import NavigationRail from "./NavigationRail";
import ServerSidebar from "./ServerSidebar";
import ChatPanel from "./ChatPanel";
import UserPanel from "./UserPanel";
import ActivitySidebar from "../activity/ActivitySidebar";
import { useActivity } from "../../hooks/useActivity";
import { useMobile } from "../../hooks/useMobile";
import { useMobileKeyboard } from "../../hooks/useMobileKeyboard";

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
}) {
  const { isMobile } = useMobile();
  useMobileKeyboard(isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState("friend");
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const activity = useActivity({ socket, me, friends });

  const closeMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  const openMobileDrawer = useCallback(() => setMobileDrawerOpen(true), []);

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

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
    if (isMobile) setMobileDrawerOpen(true);
  }, [isMobile]);

  const handleMobileBack = useCallback(() => {
    if (activeDmUser) onDmSelect?.(null);
    if (activeGroup) onGroupSelect?.(null);
    openMobileDrawer();
  }, [activeDmUser, activeGroup, onDmSelect, onGroupSelect, openMobileDrawer]);

  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;
  const showNotifBanner = !isElectron && !notifBannerDismissed && notifPermission === "default";
  const inConversation = !!(activeDmUser || activeGroup);

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
      className={`app-root${isMobile ? " is-mobile" : ""}${mobileDrawerOpen ? " mobile-drawer-open" : ""}${userPanelOpen ? " mobile-settings-open" : ""}`}
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
            <span>Mesaj, arama ve mention bildirimleri almak için izin verin</span>
            <button
              type="button"
              className="app-notif-banner-btn"
              onClick={async () => {
                await onRequestNotifPermission?.();
                setNotifBannerDismissed(true);
              }}
            >
              İzin Ver
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

      {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {isMobile && mobileDrawerOpen && (
          <motion.button
            type="button"
            className="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close menu"
            onClick={closeMobileDrawer}
          />
        )}
      </AnimatePresence>

      {/* Sidebar shell: nav rail + list sidebar (same components as desktop) */}
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

        {activeView === "activity" ? (
          <ActivitySidebar
            friends={friends}
            friendPresence={activity.friendPresence}
            onlineUsers={onlineUsers}
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
          />
        )}
      </div>

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
      >
        {children}
      </ChatPanel>

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
          />
        )}
      </AnimatePresence>

      {isMobile && !userPanelOpen && (
        <nav className="mobile-tab-bar" aria-label="Primary">
          <button
            type="button"
            className={`mobile-tab ${activeView === "chat" ? "active" : ""}`}
            onClick={() => handleViewChange("chat")}
          >
            <MessageSquare size={20} />
            <span>Chat</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${activeView === "friends" ? "active" : ""}`}
            onClick={() => handleViewChange("friends")}
          >
            <Users size={20} />
            <span>Friends</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${activeView === "calls" ? "active" : ""}`}
            onClick={() => handleViewChange("calls")}
          >
            <Phone size={20} />
            <span>Calls</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${activeView === "activity" ? "active" : ""}`}
            onClick={() => handleViewChange("activity")}
          >
            <Activity size={20} />
            <span>Activity</span>
          </button>
          <button
            type="button"
            className="mobile-tab"
            onClick={openUserPanel}
          >
            <Settings size={20} />
            <span>You</span>
          </button>
        </nav>
      )}
    </div>
  );
}
