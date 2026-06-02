import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Video, MoreVertical, Users,
  Settings, Bell, Search, Plus, MessageSquare, X, ChevronDown, ChevronRight
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import MessageList from "../chat/MessageList";
import MessageComposer from "../chat/MessageComposer";
import ActiveCallBanner from "../ActiveCallBanner";
import ActivityView from "../activity/ActivityView";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

export default function ChatPanel({
  activeView,
  activeDmUser,
  activeGroup,
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
  children
}) {
  const messagesRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMembers, setShowMembers] = useState(false);

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
    if (activeView === "groups") return "Groups";
    if (activeView === "calls")    return "Calls";
    if (activeView === "activity") return "Activity";
    return "Descall";
  };

  const getSubtitle = () => {
    if (activeDmUser) {
      const isOnline = onlineUsers?.some(u => u.id === activeDmUser.id);
      return isOnline ? "Online" : "Offline";
    }
    if (activeGroup) {
      return `${activeGroup.memberCount || 0} members`;
    }
    return "";
  };

  return (
    <>
      <main className="main-panel">
        {/* Header — hidden on activity view since ActivityView has its own header */}
        <header className="panel-header" style={activeView === "activity" ? { display: 'none' } : {}}>
        <div className="header-left">
          {activeDmUser && (
            <div className="header-avatar">
              <Avatar 
                name={activeDmUser.username} 
                size={40}
                imageUrl={activeDmUser.avatarUrl}
              />
              <StatusBadge status={onlineUsers?.some(u => u.id === activeDmUser.id) ? "online" : "offline"} />
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
          <button
            className={`icon-btn ${showSearch ? "active" : ""}`}
            title="Search"
            onClick={() => { setShowSearch(!showSearch); setShowMembers(false); }}
          >
            <Search size={20} />
          </button>
          <button
            className={`icon-btn ${showMembers ? "active" : ""}`}
            title="Members"
            onClick={() => { setShowMembers(!showMembers); setShowSearch(false); }}
          >
            <Users size={20} />
          </button>
          {(activeDmUser || activeGroup) && (
            <>
              <button 
                className="icon-btn" 
                title="Voice Call"
                onClick={() => activeGroup ? onGroupVoiceCall?.() : onVoiceCall?.()}
              >
                <Phone size={20} />
              </button>
              <button 
                className="icon-btn" 
                title="Video Call"
                onClick={() => activeGroup ? onGroupVideoCall?.() : onVideoCall?.()}
              >
                <Video size={20} />
              </button>
            </>
          )}
          <button 
            className="icon-btn" 
            title="Settings"
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
      ) : (
      <div className="messages-container" ref={messagesRef}>
        {showSearch && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="chat-search-bar">
            <Search size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              autoFocus
            />
            <button className="icon-btn" onClick={() => { setShowSearch(false); setSearchQuery(""); }}><X size={16} /></button>
          </motion.div>
        )}
        {(activeDmUser || activeGroup) ? children : (
          <div className="empty-state">
            <div className="empty-icon">
              {activeView === "dms" && <MessageSquare size={64} />}
              {activeView === "groups" && <Users size={64} />}
              {activeView === "chat" && <MessageSquare size={64} />}
              {activeView === "calls" && <Phone size={64} />}
            </div>
            <h2>Welcome to Descall</h2>
            <p>Select a conversation to start chatting</p>
          </div>
        )}
      </div>
      )}

      {/* Composer */}
      {(activeDmUser || activeGroup) && (
        <div className="composer-container">
          <MessageComposer
            onSend={onSendMessage}
            disabled={!activeDmUser && !activeGroup}
          />
        </div>
      )}
    </main>

    {/* Members Panel - Absolute positioned sidebar */}
    <AnimatePresence>
      {showMembers && (
        <motion.aside
          className="members-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 240, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="members-panel-header">
            <h4>Members</h4>
            <button className="icon-btn" onClick={() => setShowMembers(false)} title="Close">
              <X size={16} />
            </button>
          </div>
          {(activeGroup?.members?.length > 0 ? activeGroup.members : activeDmUser ? [activeDmUser] : []).map((m) => (
            <div key={m.id} className="member-row">
              <div className="member-avatar-wrap">
                <Avatar name={m.username} size={32} imageUrl={m.avatarUrl} />
                <StatusBadge status={onlineUsers?.some((u) => u.id === m.id) ? "online" : "offline"} />
              </div>
              <span className="member-name">{m.username}</span>
            </div>
          ))}
        </motion.aside>
      )}
    </AnimatePresence>
  </>
  );
}

