import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Settings, Hash,
  ChevronDown, ChevronRight, Bell, UserPlus, X, User, Users, Megaphone
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
  onFriendSelect,
  showAddModal: showAddModalProp,
  setShowAddModal: setShowAddModalProp,
  addTab: addTabProp,
  setAddTab: setAddTabProp,
  onRefreshGroups
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    dms: true,
    groups: true,
    friends: true
  });
  const [internalShowAddModal, setInternalShowAddModal] = useState(false);
  const [internalAddTab, setInternalAddTab] = useState("friend");
  const showAddModal = showAddModalProp ?? internalShowAddModal;
  const setShowAddModal = setShowAddModalProp ?? setInternalShowAddModal;
  const addTab = addTabProp ?? internalAddTab;
  const setAddTab = setAddTabProp ?? setInternalAddTab;
  const [friendUsername, setFriendUsername] = useState("");
  const [groupName, setGroupName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  useEffect(() => {
    if (!socket) return;
    const onFriendError = ({ message }) => {
      setAddError(message || "Friend action failed.");
      setTimeout(() => setAddError(""), 4000);
    };
    const onFriendSent = ({ to } = {}) => {
      setAddSuccess(to ? `Request sent to ${to}` : "Request sent.");
      setTimeout(() => setAddSuccess(""), 3000);
    };
    socket.on("friend:error", onFriendError);
    socket.on("friend:request:sent", onFriendSent);
    return () => {
      socket.off("friend:error", onFriendError);
      socket.off("friend:request:sent", onFriendSent);
    };
  }, [socket]);

  useEffect(() => {
    if (showAnnouncements && announcements.length === 0) {
      const fetchAnnouncements = async () => {
        setAnnouncementsLoading(true);
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
          setAnnouncementsLoading(false);
        }
      };
      fetchAnnouncements();
    }
  }, [showAnnouncements]);

  const handleAddFriend = async () => {
    if (!friendUsername.trim()) return;
    setAddLoading(true);
    setAddError("");
    setAddSuccess("");
    try {
      socket?.emit("friend:request", { toUsername: friendUsername.trim() });
      setFriendUsername("");
    } catch (err) {
      setAddError("Failed to send friend request");
    } finally {
      setAddLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setAddLoading(true);
    setAddError("");
    setAddSuccess("");
    try {
      const token = getToken();
      const url = `${API_BASE_URL}/api/groups/create`;
      console.log("[CreateGroup] POST", url, { name: groupName.trim(), memberIds: selectedGroupMembers.map(m => m.id) });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: groupName.trim(),
          memberIds: selectedGroupMembers.map(m => m.id)
        }),
      });
      const data = await res.json();
      console.log("[CreateGroup] Response", res.status, data);
      if (!res.ok) throw new Error(data.error || data.details || `Failed to create group (status ${res.status})`);
      setAddSuccess(`Group "${groupName.trim()}" created`);
      setGroupName("");
      setSelectedGroupMembers([]);
      setTimeout(() => setAddSuccess(""), 3000);
      // Close modal and trigger groups refresh
      setShowAddModal(false);
      // Trigger groups refresh via callback
      onRefreshGroups?.();
    } catch (err) {
      console.error("[CreateGroup] Error:", err);
      setAddError(err.message || "Network error. Is backend deployed?");
    } finally {
      setAddLoading(false);
    }
  };

  const toggleGroupMember = (friend) => {
    setSelectedGroupMembers(prev => {
      const exists = prev.find(m => m.id === friend.id);
      if (exists) {
        return prev.filter(m => m.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
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
              title="Announcements"
              onClick={() => setShowAnnouncements(!showAnnouncements)}
            >
              <Megaphone size={18} />
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
          {(activeView === "chat" || activeView === "dms") && (
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
                      
                      <label className="add-modal-label" style={{ marginTop: 12 }}>Add members (optional)</label>
                      <div className="group-members-select" style={{ maxHeight: 150, overflowY: "auto", marginBottom: 12 }}>
                        {Array.isArray(friends) && friends.length > 0 ? (
                          friends.map(friend => {
                            const isSelected = selectedGroupMembers.find(m => m.id === friend.id);
                            return (
                              <div
                                key={friend.id}
                                className={`group-member-option ${isSelected ? "selected" : ""}`}
                                onClick={() => toggleGroupMember(friend)}
                                style={{
                                  padding: 8,
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  backgroundColor: isSelected ? "var(--primary-soft)" : "var(--surface-2)",
                                  marginBottom: 4
                                }}
                              >
                                <Avatar user={friend} size={24} />
                                <span style={{ fontSize: 13 }}>{friend.username}</span>
                                {isSelected && <span style={{ marginLeft: "auto", color: "var(--primary)" }}>✓</span>}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: 8, color: "var(--text-muted)", fontSize: 12 }}>
                            No friends to add. Add friends first.
                          </div>
                        )}
                      </div>
                      
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

        {/* Announcements Modal */}
        <AnimatePresence>
          {showAnnouncements && (
            <motion.div
              className="add-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAnnouncements(false)}
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
                  <h3>📢 Announcements</h3>
                  <button className="icon-btn" onClick={() => setShowAnnouncements(false)}><X size={18} /></button>
                </div>

                <div className="announcements-modal-content">
                  {announcementsLoading ? (
                    <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>Loading announcements...</div>
                  ) : announcements.length === 0 ? (
                    <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>No announcements</div>
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
