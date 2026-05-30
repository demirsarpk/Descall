import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, Users, Settings, Bell, 
  LogOut, User, Search, Plus
} from "lucide-react";
import NavigationRail from "./NavigationRail";
import ServerSidebar from "./ServerSidebar";
import ChatPanel from "./ChatPanel";
import UserPanel from "./UserPanel";
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
  onRefreshGroups
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState("friend");

  const handleAddClick = () => {
    setActiveView(activeView === "groups" ? "groups" : "dms");
    setAddTab(activeView === "groups" ? "group" : "friend");
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
    <div className="app-root">
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

      {/* Server/Channel Sidebar - Secondary sidebar */}
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
      />

      {/* Main Chat Panel - Center content area */}
      <ChatPanel 
        activeView={activeView}
        activeDmUser={activeDmUser}
        activeGroup={activeGroup}
        sidebarCollapsed={sidebarCollapsed}
        onlineUsers={onlineUsers}
        onSendMessage={onSendMessage}
        onVoiceCall={onVoiceCall}
        onVideoCall={onVideoCall}
        onGroupVoiceCall={onGroupVoiceCall}
        onGroupVideoCall={onGroupVideoCall}
        onSettings={() => setUserPanelOpen(true)}
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
