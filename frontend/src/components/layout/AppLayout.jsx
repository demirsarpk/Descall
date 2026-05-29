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
  onlineUsers
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState("chat"); // chat | dms | groups
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [userPanelOpen, setUserPanelOpen] = useState(false);

  return (
    <div className="app-root">
      {/* Navigation Rail - Leftmost vertical bar */}
      <NavigationRail 
        activeView={activeView}
        onViewChange={setActiveView}
        onAdminClick={() => setAdminMenuOpen(!adminMenuOpen)}
        onUserClick={() => setUserPanelOpen(!userPanelOpen)}
        me={me}
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
        onDmSelect={(dm) => {
          // DM selection handled by parent
        }}
        onGroupSelect={(group) => {
          // Group selection handled by parent
        }}
        onFriendSelect={(friend) => {
          // Friend selection handled by parent
        }}
      />

      {/* Main Chat Panel - Center content area */}
      <ChatPanel 
        activeView={activeView}
        activeDmUser={activeDmUser}
        activeGroup={activeGroup}
        sidebarCollapsed={sidebarCollapsed}
        onlineUsers={onlineUsers}
        onSendMessage={(message) => {
          // Message sending handled by parent
        }}
        onVoiceCall={() => {
          // Voice call handled by parent
        }}
        onVideoCall={() => {
          // Video call handled by parent
        }}
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
