import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, MessageSquare, Users, Phone, Activity, Settings, Crosshair, Server } from "lucide-react";
import NavigationRail from "./NavigationRail";
import ServerSidebar from "./ServerSidebar";
import ServersSidebar from "../servers/ServersSidebar";
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
  onLeaveVoiceRoom,
  isInGroupVoiceRoom = false,
  onDismissActiveBanner,
  friendRequests,
  onAcceptFriend,
  onDeclineFriend,
  notifPermission,
  onRequestNotifPermission,
  typingDmUser,
  typingGroupUsers,
  typingChannelUsers,
  onTypingDmStart,
  onTypingDmStop,
  onTypingGroupStart,
  onTypingGroupStop,
  onTypingChannelStart,
  onTypingChannelStop,
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
  activeTimeout = null,
  friendsLoaded = true,
  groupsLoaded = true,
  servers = [],
  serversLoaded = false,
  activeServer = null,
  activeChannel = null,
  channelUnread = {},
  ownedServerCount = 0,
  maxOwnedServers = 10,
  onServerSelect,
  onChannelSelect,
  onServerBack,
  onChannelBack,
  onCreateServer,
  onLeaveServer,
  onDeleteServer,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onRolesChanged,
  serverFolders = [],
  onServerFoldersChange,
  onMoveServerToFolder,
  onReorderServers,
  onRefreshServers,
  onJoinServer,
  onServerUpdated,
  serverVoice = null,
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
  }, [isMobile, setUserPanelOpen]);

  const closeUserPanel = useCallback(() => {
    setUserPanelOpen(false);
    // Play / Activity are full-page surfaces — never reopen the chat drawer over them.
    if (
      isMobile &&
      activeView !== "play" &&
      activeView !== "activity" &&
      !activeDmUser &&
      !activeGroup &&
      !(activeView === "servers" && activeChannel)
    ) {
      setMobileDrawerOpen(true);
    }
  }, [isMobile, activeDmUser, activeGroup, activeServer, activeChannel, activeView, setUserPanelOpen]);

  useEffect(() => {
    if (!isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  // Mobile: keep the sidebar open for server list + channel list.
  // Only treat an opened channel as "in conversation" (main pane).
  // Play / Activity own the viewport (rail is inside their page or unused) —
  // forcing the drawer open here left a rail-only shell over LFG and broke layout.
  useEffect(() => {
    if (!isMobile) return;
    if (activeView === "play" || activeView === "activity") {
      setMobileDrawerOpen(false);
      return;
    }
    const inServersChannel = activeView === "servers" && !!activeChannel;
    if (!activeDmUser && !activeGroup && !inServersChannel) {
      setMobileDrawerOpen(true);
    }
  }, [isMobile, activeDmUser, activeGroup, activeChannel, activeView]);

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
      if (activeDmUser) onDmSelect?.(null);
      if (activeGroup) onGroupSelect?.(null);
      if (activeServer) onServerBack?.();
    }
    if (view === "chat" || view === "groups") {
      if (activeServer) onServerBack?.();
    }
    if (view === "servers") {
      if (activeDmUser) onDmSelect?.(null);
      if (activeGroup) onGroupSelect?.(null);
    }
    if (isMobile) {
      setMobileDrawerOpen(view !== "play" && view !== "activity");
    }
  }, [isMobile, activeDmUser, activeGroup, activeServer, onDmSelect, onGroupSelect, onServerBack, setActiveView]);

  const handleMobileBack = useCallback(() => {
    // Servers: channel → channel list → server list
    if (activeView === "servers" && activeChannel) {
      onChannelBack?.();
      openMobileDrawer();
      return;
    }
    if (activeView === "servers" && activeServer) {
      onServerBack?.();
      openMobileDrawer();
      return;
    }
    if (activeDmUser) onDmSelect?.(null);
    if (activeGroup) onGroupSelect?.(null);
    openMobileDrawer();
  }, [
    activeView,
    activeDmUser,
    activeGroup,
    activeServer,
    activeChannel,
    onDmSelect,
    onGroupSelect,
    onServerBack,
    onChannelBack,
    openMobileDrawer,
  ]);

  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;
  const inServersChannel = activeView === "servers" && !!activeServer && !!activeChannel;
  const inConversation = !!(activeDmUser || activeGroup || inServersChannel);
  // On a narrow conversation surface the fixed banner sits directly over the
  // DM header, stealing profile/voice-call taps. Offer it once the user leaves
  // the conversation instead.
  const showNotifBanner =
    !isElectron &&
    !notifBannerDismissed &&
    notifPermission === "default" &&
    !(isMobile && inConversation);

  const handleAddClick = (tab) => {
    const nextTab =
      tab === "friend" || tab === "group" || tab === "quickadd"
        ? tab
        : activeView === "groups"
          ? "group"
          : "friend";
    setAddTab(nextTab);
    setShowAddModal(true);
    // Activity replaces ServerSidebar (where the Add Friend modal lives).
    // Switch to Friends so the modal can mount — otherwise the CTA is a no-op.
    if (activeView === "activity") {
      setActiveView("friends");
      if (isMobile) setMobileDrawerOpen(true);
    }
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
        ) : activeView === "servers" ? (
          <ServersSidebar
            servers={servers}
            serversLoaded={serversLoaded}
            serverFolders={serverFolders}
            onServerFoldersChange={onServerFoldersChange}
            onMoveServerToFolder={onMoveServerToFolder}
            activeServer={activeServer}
            activeChannel={activeChannel}
            channelUnread={channelUnread}
            ownedCount={ownedServerCount}
            maxOwned={maxOwnedServers}
            onSelectServer={onServerSelect}
            onSelectChannel={onChannelSelect}
            onBackToList={onServerBack}
            onCreateServer={onCreateServer}
            onLeaveServer={onLeaveServer}
            onDeleteServer={onDeleteServer}
            onCreateChannel={onCreateChannel}
            onUpdateChannel={onUpdateChannel}
            onDeleteChannel={onDeleteChannel}
            onRolesChanged={onRolesChanged}
            onReorderServers={onReorderServers}
            onRefresh={onRefreshServers}
            onJoinServer={onJoinServer}
            onServerUpdated={onServerUpdated}
            serverVoice={serverVoice}
            onMobileClose={isMobile ? closeMobileDrawer : undefined}
            isMobile={isMobile}
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
            friendsLoaded={friendsLoaded}
            groupsLoaded={groupsLoaded}
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
        activeServer={activeServer}
        activeChannel={activeChannel}
        socket={socket}
        me={me}
        activeTimeout={activeTimeout}
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
        onLeaveVoiceRoom={onLeaveVoiceRoom}
        isInGroupVoiceRoom={isInGroupVoiceRoom}
        onDismissActiveBanner={onDismissActiveBanner}
        activity={{ ...activity, me }}
        friends={friends}
        typingDmUser={typingDmUser}
        typingGroupUsers={typingGroupUsers}
        typingChannelUsers={typingChannelUsers}
        onTypingDmStart={onTypingDmStart}
        onTypingDmStop={onTypingDmStop}
        onTypingGroupStart={onTypingGroupStart}
        onTypingGroupStop={onTypingGroupStop}
        onTypingChannelStart={onTypingChannelStart}
        onTypingChannelStop={onTypingChannelStop}
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
        serverVoice={serverVoice}
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
            activity={activity}
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
            className={`mobile-tab ${activeView === "servers" ? "active" : ""}`}
            onClick={() => handleViewChange("servers")}
          >
            <Server size={20} />
            <span>{t("Servers")}</span>
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
