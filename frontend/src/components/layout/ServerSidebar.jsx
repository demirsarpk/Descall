import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Settings, Hash,
  ChevronDown, ChevronRight, Bell, UserPlus, X, User, Users
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

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
  socket,
  onDmSelect,
  onGroupSelect,
  onFriendSelect
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    dms: true,
    groups: true,
    friends: true
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState("friend");
  const [friendUsername, setFriendUsername] = useState("");
  const [groupName, setGroupName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");

  const handleAddFriend = async () => {
    if (!friendUsername.trim()) return;
    setAddLoading(true);
    setAddError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: friendUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send friend request");
      setAddSuccess(`Friend request sent to ${friendUsername.trim()}`);
      setFriendUsername("");
      setTimeout(() => setAddSuccess(""), 3000);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setAddLoading(true);
    setAddError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      setAddSuccess(`Group "${groupName.trim()}" created`);
      setGroupName("");
      setTimeout(() => setAddSuccess(""), 3000);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

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
            <button 
              className="icon-btn" 
              title="Search"
              onClick={() => {
                const searchInput = document.querySelector('.search-input');
                searchInput?.focus();
              }}
            >
              <Search size={18} />
            </button>
            <button
              className="icon-btn"
              title="Add"
              onClick={() => {
                setShowAddModal(true);
                setAddTab(activeView === "groups" ? "group" : "friend");
                setAddError("");
                setAddSuccess("");
              }}
            >
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
              onDmSelect={onDmSelect}
            />
          )}

          {activeView === "groups" && (
            <GroupList
              groups={filteredGroups}
              activeGroup={activeGroup}
              expanded={expandedSections.groups}
              onToggle={() => toggleSection("groups")}
              onGroupSelect={onGroupSelect}
            />
          )}

          {activeView === "friends" && (
            <FriendsList
              friends={friends}
              onlineUsers={onlineUsers}
              expanded={expandedSections.friends}
              onToggle={() => toggleSection("friends")}
              onFriendSelect={onFriendSelect}
            />
          )}
        </div>

        {/* Add Friend / Create Group Modal - Moved to main component scope */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              className="add-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
            >
              <motion.div
                className="add-modal"
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="add-modal-header">
                  <h3>Create New</h3>
                  <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                </div>

                <div className="add-modal-tabs">
                  <button className={`add-modal-tab ${addTab === "friend" ? "active" : ""}`} onClick={() => { setAddTab("friend"); setAddError(""); setAddSuccess(""); }}>
                    <User size={16} /> Add Friend
                  </button>
                  <button className={`add-modal-tab ${addTab === "group" ? "active" : ""}`} onClick={() => { setAddTab("group"); setAddError(""); setAddSuccess(""); }}>
                    <Users size={16} /> Create Group
                  </button>
                </div>

                <div className="add-modal-body">
                  {addTab === "friend" && (
                    <>
                      <label className="add-modal-label">Enter a username to add</label>
                      <input className="add-modal-input" value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder="e.g. johndoe" onKeyDown={(e) => e.key === "Enter" && handleAddFriend()} />
                      <motion.button className="settings-action-btn" onClick={handleAddFriend} disabled={addLoading || !friendUsername.trim()} whileTap={{ scale: 0.97 }}>
                        {addLoading ? "Sending..." : "Send Friend Request"}
                      </motion.button>
                    </>
                  )}
                  {addTab === "group" && (
                    <>
                      <label className="add-modal-label">Group name</label>
                      <input className="add-modal-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Gaming Squad" onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()} />
                      <motion.button className="settings-action-btn" onClick={handleCreateGroup} disabled={addLoading || !groupName.trim()} whileTap={{ scale: 0.97 }}>
                        {addLoading ? "Creating..." : "Create Group"}
                      </motion.button>
                    </>
                  )}
                  {addError && <div className="add-modal-error">{addError}</div>}
                  {addSuccess && <div className="add-modal-success">{addSuccess}</div>}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
        <span className="section-title">Chats</span>
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

function GroupList({ groups, activeGroup, expanded, onToggle, onGroupSelect }) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  
  return (
    <div className="sidebar-section">
      <button 
        className="section-header"
        onClick={onToggle}
      >
        <span className="section-title">Groups</span>
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
                  onClick={() => onGroupSelect?.(group)}
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

function FriendsList({ friends, onlineUsers, expanded, onToggle, onFriendSelect }) {
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
                    onClick={() => onFriendSelect?.(friend)}
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
                    onClick={() => onFriendSelect?.(friend)}
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
