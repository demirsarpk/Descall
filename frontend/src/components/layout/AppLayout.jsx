import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Users, Settings, Bell, 
  LogOut, User, Search, Plus, BellOff, X
} from "lucide-react";
import NavigationRail from "./NavigationRail";
import ServerSidebar from "./ServerSidebar";
import ServerIconBar from "../servers/ServerIconBar";
import ChatPanel from "./ChatPanel";
import UserPanel from "./UserPanel";
import MobileAppLayout from "./MobileAppLayout";
import ActivitySidebar from "../activity/ActivitySidebar";
import { useActivity } from "../../hooks/useActivity";
import { useMobile } from "../../hooks/useMobile";
import { Avatar } from "../ui/Avatar";

/**
 * COMPLETELY REBUILT MAIN LAYOUT
 * Discord-inspired grid system
 * No old layout remnants
 */
export default function AppLayout({
  children,
  me,
  socket,
  onLogout,
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
}) {
  const { isMobile } = useMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState("friend");
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);

  const activity = useActivity({ socket, me, friends });

  if (isMobile) {
    return (
      <MobileAppLayout
        me={me}
        socket={socket}
        onLogout={onLogout}
        activeDmUser={activeDmUser}
        activeGroup={activeGroup}
        groups={groups}
        dms={dms}
        friends={friends}
        onlineUsers={onlineUsers}
        onDmSelect={onDmSelect}
        onGroupSelect={onGroupSelect}
        onSendMessage={onSendMessage}
        onVoiceCall={onVoiceCall}
        onVideoCall={onVideoCall}
        onGroupVoiceCall={onGroupVoiceCall}
        onGroupVideoCall={onGroupVideoCall}
        onAdminClick={onAdminClick}
        isAdmin={isAdmin}
        onRefreshGroups={onRefreshGroups}
        onGroupCreated={onGroupCreated}
        onGroupLeft={onGroupLeft}
        onGroupRenamed={onGroupRenamed}
        onRefresh={onRefresh}
        friendNotice={friendNotice}
        activeCallBanner={activeCallBanner}
        onJoinActiveCall={onJoinActiveCall}
        onDismissActiveBanner={onDismissActiveBanner}
        friendRequests={friendRequests}
        onAcceptFriend={onAcceptFriend}
        onDeclineFriend={onDeclineFriend}
        notifPermission={notifPermission}
        onRequestNotifPermission={onRequestNotifPermission}
        typingDmUser={typingDmUser}
        typingGroupUsers={typingGroupUsers}
        onTypingDmStart={onTypingDmStart}
        onTypingDmStop={onTypingDmStop}
        onTypingGroupStart={onTypingGroupStart}
        onTypingGroupStop={onTypingGroupStop}
        guilds={guilds}
        activeGuild={activeGuild}
        activeGuildChannel={activeGuildChannel}
        onGuildSelect={onGuildSelect}
        onGuildChannelSelect={onGuildChannelSelect}
        onCreateGuild={onCreateGuild}
        onJoinGuild={onJoinGuild}
        onLeaveGuild={onLeaveGuild}
        onDeleteGuild={onDeleteGuild}
        onRefreshGuilds={onRefreshGuilds}
      >
        {children}
      </MobileAppLayout>
    );
  }

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  const showNotifBanner = !isElectron && !notifBannerDismissed && notifPermission === 'default';

  const handleAddClick = () => {
    if (activeView === "groups") setAddTab("group");
    else if (activeView === "friends") setAddTab("friend");
    else setAddTab("friend");
    setShowAddModal(true);
  };

  const handleVoiceClick = () => {
    if (activeDmUser && onVoiceCall) {
      onVoiceCall();
    } else if (activeGroup && onGroupVoiceCall) {
      onGroupVoiceCall();
    }
  };

  return (
    <div className="app-root" data-view={activeView}>
      {/* Web notification permission banner */}
      <AnimatePresence>
        {showNotifBanner && (
          <motion.div
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '10px 16px',
              background: 'var(--primary)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <Bell size={15} style={{ flexShrink: 0 }} />
            <span>Mesaj, arama ve mention bildirimleri almak için izin verin</span>
            <button
              onClick={async () => {
                await onRequestNotifPermission?.();
                setNotifBannerDismissed(true);
              }}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'rgba(255,255,255,0.22)',
                color: 'white',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              İzin Ver
            </button>
            <button
              onClick={() => setNotifBannerDismissed(true)}
              style={{
                marginLeft: 4,
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 4,
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Navigation Rail - Leftmost vertical bar */}
      <NavigationRail
        activeView={activeView}
        onViewChange={setActiveView}
        onAdminClick={onAdminClick}
        onUserClick={() => setUserPanelOpen(!userPanelOpen)}
        onAddClick={handleAddClick}
        onVoiceClick={handleVoiceClick}
        me={me}
        isAdmin={isAdmin}
      />

      {/* Activity sidebar replaces ServerSidebar when activity view is active */}
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
        onDmSelect={onDmSelect}
        onGroupSelect={onGroupSelect}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        addTab={addTab}
        setAddTab={setAddTab}
        onFriendSelect={onDmSelect}
        onRefreshGroups={onRefreshGroups}
        onGroupCreated={onGroupCreated}
        onGroupLeft={onGroupLeft}
        onGroupRenamed={onGroupRenamed}
        onRefresh={onRefresh}
        friendRequests={friendRequests}
        onAcceptFriend={onAcceptFriend}
        onDeclineFriend={onDeclineFriend}
      />
      )}

      {/* Main Chat Panel - Center content area */}
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
        onSettings={() => setUserPanelOpen(true)}
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
      >
        {children}
      </ChatPanel>

      {/* User Panel - Right sidebar (optional) */}
      <AnimatePresence>
        {userPanelOpen && (
          <UserPanel 
            me={me}
            onClose={() => setUserPanelOpen(false)}
            onLogout={onLogout}
            onSettings={() => {}}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
