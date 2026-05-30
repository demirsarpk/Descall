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
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

export default function ChatPanel({
  activeView,
  activeDmUser,
  activeGroup,
  sidebarCollapsed,
  onlineUsers,
  messages = [],
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  onGroupVoiceCall,
  onGroupVideoCall,
  onSettings,
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
    if (activeView === "calls") return "Calls";
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

      {/* Messages Area */}
      <div className="messages-container" ref={messagesRef}>
        {/* Announcements Section */}
        <AnnouncementsSection />

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
          <h4>Members</h4>
          {activeGroup?.members?.map((m) => (
            <div key={m.id} className="member-row">
              <Avatar name={m.username} size={32} imageUrl={m.avatarUrl} />
              <span>{m.username}</span>
              <StatusBadge status={onlineUsers?.some((u) => u.id === m.id) ? "online" : "offline"} />
            </div>
          )) || (
            activeDmUser && (
              <div className="member-row">
                <Avatar name={activeDmUser.username} size={32} imageUrl={activeDmUser.avatarUrl} />
                <span>{activeDmUser.username}</span>
                <StatusBadge status={onlineUsers?.some((u) => u.id === activeDmUser.id) ? "online" : "offline"} />
              </div>
            )
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  </>
  );
}

function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const token = getToken();
        const res = await fetch(`${API_BASE_URL}/api/announcements`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
      } catch (err) {
        console.error("Failed to load announcements:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <div className="chat-announcements-section">
      <button
        className="announcements-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="announcements-title">📢 Announcements</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="announcements-content"
          >
            {loading ? (
              <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: "13px" }}>Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div style={{ padding: "12px", color: "var(--text-muted)", fontSize: "13px" }}>No announcements</div>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="announcement-item">
                  <div className="announcement-title">{a.title}</div>
                  <div className="announcement-content">{a.content}</div>
                  <div className="announcement-meta">
                    {a.author && <span className="announcement-author">By {a.author}</span>}
                    {a.createdAt && <span className="announcement-date">{new Date(a.createdAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
