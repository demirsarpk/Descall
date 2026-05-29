import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Plus, Settings, Hash, 
  ChevronDown, ChevronRight, Bell, UserPlus
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";

/**
 * COMPLETELY REBUILT SERVER SIDEBAR
 * Discord-style channel/server list
 * No old layout remnants
 */
export default function ServerSidebar({ 
  collapsed, 
  onToggleCollapse,
  activeView,
  activeDmUser,
  activeGroup,
  groups,
  dms,
  friends,
  onlineUsers,
  socket
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    dms: true,
    groups: true,
    friends: true
  });

  const filteredDms = useMemo(() => {
    if (!Array.isArray(dms)) return [];
    if (!searchQuery) return dms;
    return dms.filter(dm => 
      dm.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dms, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!Array.isArray(groups)) return [];
    if (!searchQuery) return groups;
    return groups.filter(group => 
      group.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groups, searchQuery]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (collapsed) {
    return null; // Collapsed state handled by parent
  }

  return (
    <aside className="sidebar-secondary">
      <div className="sidebar-inner">
        {/* Header */}
        <div className="sidebar-header">
          <h2 className="sidebar-title">
            {activeView === "chat" && "Chats"}
            {activeView === "dms" && "Direct Messages"}
            {activeView === "groups" && "Servers"}
            {activeView === "calls" && "Calls"}
          </h2>
          <div className="sidebar-actions">
            <button className="icon-btn" title="Search">
              <Search size={18} />
            </button>
            <button className="icon-btn" title="Add">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Content */}
        <div className="sidebar-content">
          {activeView === "dms" && (
            <DMList 
              dms={filteredDms}
              activeDmUser={activeDmUser}
              onlineUsers={onlineUsers}
              expanded={expandedSections.dms}
              onToggle={() => toggleSection("dms")}
              onDmSelect={(dm) => {
                // DM selection should be handled by parent via onDmSelect prop
              }}
            />
          )}

          {activeView === "groups" && (
            <GroupList 
              groups={filteredGroups}
              activeGroup={activeGroup}
              expanded={expandedSections.groups}
              onToggle={() => toggleSection("groups")}
            />
          )}

          {activeView === "friends" && (
            <FriendsList 
              friends={friends}
              onlineUsers={onlineUsers}
              expanded={expandedSections.friends}
              onToggle={() => toggleSection("friends")}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

function DMList({ dms, activeDmUser, onlineUsers, expanded, onToggle, onDmSelect }) {
  const safeDms = Array.isArray(dms) ? dms : [];
  
  return (
    <div className="sidebar-section">
      <button 
        className="section-header"
        onClick={onToggle}
      >
        <span className="section-title">Direct Messages</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="section-content"
          >
            {safeDms.map((dm) => {
              const isOnline = onlineUsers?.some(u => u.id === dm.id);
              const isActive = activeDmUser?.id === dm.id;

              return (
                <motion.button
                  key={dm.id}
                  className={`dm-item ${isActive ? "active" : ""}`}
                  onClick={() => onDmSelect?.(dm)}
                  whileHover={{ scale: 1.02, backgroundColor: "var(--surface-2)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="dm-avatar">
                    <Avatar 
                      name={dm.username} 
                      size={40}
                      imageUrl={dm.avatarUrl}
                    />
                    <StatusBadge status={isOnline ? "online" : "offline"} />
                  </div>
                  <div className="dm-info">
                    <span className="dm-name">{dm.username}</span>
                    {dm.lastMessage && (
                      <span className="dm-preview">{dm.lastMessage}</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GroupList({ groups, activeGroup, expanded, onToggle }) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  
  return (
    <div className="sidebar-section">
      <button 
        className="section-header"
        onClick={onToggle}
      >
        <span className="section-title">Servers</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="section-content"
          >
            {safeGroups.map((group) => {
              const isActive = activeGroup?.id === group.id;

              return (
                <motion.button
                  key={group.id}
                  className={`group-item ${isActive ? "active" : ""}`}
                  whileHover={{ scale: 1.02, backgroundColor: "var(--surface-2)" }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="group-icon">
                    {group.icon ? (
                      <img src={group.icon} alt={group.name} />
                    ) : (
                      <span>{group.name?.charAt(0)?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="group-info">
                    <span className="group-name">{group.name}</span>
                    <span className="group-members">
                      {group.memberCount || 0} members
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FriendsList({ friends, onlineUsers, expanded, onToggle }) {
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
  
  const onlineFriends = safeFriends.filter(f => 
    safeOnlineUsers.some(u => u.id === f.id)
  );
  const offlineFriends = safeFriends.filter(f => 
    !safeOnlineUsers.some(u => u.id === f.id)
  );

  return (
    <div className="sidebar-section">
      <button 
        className="section-header"
        onClick={onToggle}
      >
        <span className="section-title">Friends</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="section-content"
          >
            {onlineFriends.length > 0 && (
              <div className="friend-category">
                <span className="category-label">Online — {onlineFriends.length}</span>
                {onlineFriends.map((friend) => (
                  <motion.button
                    key={friend.id}
                    className="friend-item"
                    whileHover={{ scale: 1.02, backgroundColor: "var(--surface-2)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="friend-avatar">
                      <Avatar 
                        name={friend.username} 
                        size={32}
                        imageUrl={friend.avatarUrl}
                      />
                      <StatusBadge status="online" />
                    </div>
                    <span className="friend-name">{friend.username}</span>
                  </motion.button>
                ))}
              </div>
            )}

            {offlineFriends.length > 0 && (
              <div className="friend-category">
                <span className="category-label">Offline — {offlineFriends.length}</span>
                {offlineFriends.map((friend) => (
                  <motion.button
                    key={friend.id}
                    className="friend-item offline"
                    whileHover={{ scale: 1.02, backgroundColor: "var(--surface-2)" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="friend-avatar">
                      <Avatar 
                        name={friend.username} 
                        size={32}
                        imageUrl={friend.avatarUrl}
                      />
                      <StatusBadge status="offline" />
                    </div>
                    <span className="friend-name">{friend.username}</span>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
