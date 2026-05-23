import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Phone, Video, MoreVertical, Users, 
  Settings, Bell, Search, Plus, MessageSquare
} from "lucide-react";
import { Avatar } from "../../ui/Avatar";
import StatusBadge from "../../ui/StatusBadge";
import MessageList from "../chat/MessageList";
import MessageComposer from "../chat/MessageComposer";

/**
 * COMPLETELY REBUILT CHAT PANEL
 * Discord-style main chat area
 * No old layout remnants
 */
export default function ChatPanel({ 
  activeView,
  activeDmUser,
  activeGroup,
  sidebarCollapsed,
  children
}) {
  const messagesRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeDmUser, activeGroup]);

  const getTitle = () => {
    if (activeDmUser) return activeDmUser.username;
    if (activeGroup) return activeGroup.name;
    if (activeView === "chat") return "Chats";
    if (activeView === "dms") return "Direct Messages";
    if (activeView === "groups") return "Servers";
    if (activeView === "calls") return "Calls";
    return "Descall";
  };

  const getSubtitle = () => {
    if (activeDmUser) {
      const isOnline = true; // Would check onlineUsers
      return isOnline ? "Online" : "Offline";
    }
    if (activeGroup) {
      return `${activeGroup.memberCount || 0} members`;
    }
    return "";
  };

  return (
    <main className="main-panel">
      {/* Header */}
      <header className="panel-header">
        <div className="header-left">
          {activeDmUser && (
            <div className="header-avatar">
              <Avatar 
                name={activeDmUser.username} 
                size={40}
                imageUrl={activeDmUser.avatarUrl}
              />
              <StatusBadge status="online" />
            </div>
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
          <div className="header-title-block">
            <h1 className="header-title">{getTitle()}</h1>
            {getSubtitle() && (
              <span className="header-subtitle">{getSubtitle()}</span>
            )}
          </div>
        </div>

        <div className="header-right">
          <button className="icon-btn" title="Search">
            <Search size={20} />
          </button>
          <button className="icon-btn" title="Members">
            <Users size={20} />
          </button>
          {(activeDmUser || activeGroup) && (
            <>
              <button className="icon-btn" title="Voice Call">
                <Phone size={20} />
              </button>
              <button className="icon-btn" title="Video Call">
                <Video size={20} />
              </button>
            </>
          )}
          <button className="icon-btn" title="Settings">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="messages-container" ref={messagesRef}>
        {children || (
          <div className="empty-state">
            <div className="empty-icon">
              {activeView === "dms" && <MessageSquare size={64} />}
              {activeView === "groups" && <Users size={64} />}
              {activeView === "chat" && <MessageSquare size={64} />}
            </div>
            <h2>Welcome to Descall</h2>
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>

      {/* Composer */}
      {(activeDmUser || activeGroup) && (
        <div className="composer-container">
          <MessageComposer />
        </div>
      )}
    </main>
  );
}
