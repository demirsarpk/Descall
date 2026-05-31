import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Settings, Hash,
  ChevronDown, ChevronRight, Bell, UserPlus, X, User, Users, Megaphone,
  MoreHorizontal, LogOut, Edit3, Check
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
  onRefreshGroups,
  onGroupCreated,
  onGroupLeft,
  onGroupRenamed,
  friendRequests,
  onAcceptFriend,
  onDeclineFriend,
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
      const url = `${API_BASE_URL}/groups/create`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: groupName.trim(),
          memberIds: selectedGroupMembers.map(m => m.id)
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || `Failed to create group (status ${res.status})`);
      setAddSuccess(`Group "${groupName.trim()}" created`);
      setGroupName("");
      setSelectedGroupMembers([]);
      setTimeout(() => setAddSuccess(""), 3000);
      setShowAddModal(false);
      // Optimistically add the new group immediately, then do a background refresh
      if (data.group) onGroupCreated?.(data.group);
      onRefreshGroups?.();
    } catch (err) {
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
            {activeView === "groups" && "Groups"}
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
              onGroupLeft={onGroupLeft}
              onGroupRenamed={onGroupRenamed}
            />
          )}

          {activeView === "friends" && (
            <FriendsList
              friends={friends}
              onlineUsers={onlineUsers}
              expanded={expandedSections.friends}
              onToggle={() => toggleSection("friends")}
              onFriendSelect={onFriendSelect}
              friendRequests={friendRequests}
              onAcceptFriend={onAcceptFriend}
              onDeclineFriend={onDeclineFriend}
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
                  whileHover={{ scale: 1.01 }}
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

function GroupContextMenu({ group, onClose, onLeave, onRename }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }}
      transition={{ duration: 0.12 }}
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 2px)",
        zIndex: 200,
        background: "var(--surface-2)",
        border: "1px solid var(--border-3)",
        borderRadius: 10,
        boxShadow: "var(--shadow-xl)",
        minWidth: 170,
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { onRename(); onClose(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", fontSize: 13, color: "var(--text-1)",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-3)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        <Edit3 size={14} style={{ color: "var(--text-muted)" }} />
        Rename Group
      </button>
      <div style={{ height: 1, background: "var(--border-2)", margin: "2px 0" }} />
      <button
        onClick={() => { onLeave(); onClose(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", fontSize: 13, color: "var(--danger)",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--danger-soft)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        <LogOut size={14} />
        Leave Group
      </button>
    </motion.div>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 320 }}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-3)",
          borderRadius: 14,
          padding: "24px 28px",
          minWidth: 320,
          maxWidth: 400,
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text-0)" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border-3)",
              background: "var(--surface-3)", color: "var(--text-1)", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: danger ? "var(--danger)" : "var(--primary)",
              color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RenameDialog({ group, onConfirm, onCancel }) {
  const [value, setValue] = useState(group.name);
  const trimmed = value.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 50 && trimmed !== group.name;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 320 }}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-3)",
          borderRadius: 14,
          padding: "24px 28px",
          minWidth: 320,
          maxWidth: 400,
          boxShadow: "var(--shadow-xl)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-0)" }}>Rename Group</h3>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && valid) onConfirm(trimmed); if (e.key === "Escape") onCancel(); }}
          maxLength={50}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            border: "1px solid var(--border-3)", background: "var(--surface-1)",
            color: "var(--text-0)", fontSize: 14, outline: "none",
            boxSizing: "border-box", marginBottom: 6,
          }}
        />
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginBottom: 18 }}>
          {value.length}/50
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border-3)",
              background: "var(--surface-3)", color: "var(--text-1)", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => valid && onConfirm(trimmed)}
            disabled={!valid}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none",
              background: valid ? "var(--primary)" : "var(--surface-active)",
              color: valid ? "#fff" : "var(--text-muted)",
              cursor: valid ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            <Check size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
            Rename
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GroupList({ groups, activeGroup, expanded, onToggle, onGroupSelect, onGroupLeft, onGroupRenamed }) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(null);   // group object
  const [confirmRename, setConfirmRename] = useState(null); // group object
  const [actionError, setActionError] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  const handleLeave = async (group) => {
    try {
      const res = await fetch(`${API_BASE_URL}/groups/${group.id}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed to leave group`);
      onGroupLeft?.(group.id);
    } catch (err) {
      setActionError(err.message);
      setTimeout(() => setActionError(""), 4000);
    } finally {
      setConfirmLeave(null);
    }
  };

  const handleRename = async (group, newName) => {
    try {
      const res = await fetch(`${API_BASE_URL}/groups/${group.id}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: newName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to rename group");
      onGroupRenamed?.(group.id, newName);
    } catch (err) {
      setActionError(err.message);
      setTimeout(() => setActionError(""), 4000);
    } finally {
      setConfirmRename(null);
    }
  };

  return (
    <>
      {actionError && (
        <div style={{
          margin: "4px 8px", padding: "8px 12px", borderRadius: 8,
          background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12,
        }}>
          {actionError}
        </div>
      )}

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
              {safeGroups.length === 0 ? (
                <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
                  No groups yet
                </div>
              ) : (
                safeGroups.map((group) => {
                  const isActive = activeGroup?.id === group.id;

                  return (
                    <div
                      key={group.id}
                      ref={openMenuId === group.id ? menuRef : null}
                      style={{ position: "relative" }}
                    >
                      <motion.button
                        className={`group-item ${isActive ? "active" : ""}`}
                        onClick={() => onGroupSelect?.(group)}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        style={{ width: "100%", paddingRight: isActive ? 36 : undefined }}
                      >
                        <div className="group-icon" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                          {group.icon ? (
                            <img src={group.icon} alt={group.name} style={{ width: "100%", height: "100%", borderRadius: 10, objectFit: "cover" }} />
                          ) : (
                            <span>{group.name?.charAt(0)?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="group-info">
                          <span className="group-name">{group.name}</span>
                          <span className="group-members">{group.memberCount || 0} members</span>
                        </div>
                      </motion.button>

                      {/* Three-dot menu button — visible only on active group */}
                      {isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === group.id ? null : group.id); }}
                          style={{
                            position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                            width: 26, height: 26, borderRadius: 6, border: "none",
                            background: openMenuId === group.id ? "var(--surface-active)" : "var(--surface-3)",
                            color: "var(--text-2)", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "background 0.15s",
                            zIndex: 10,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-active)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = openMenuId === group.id ? "var(--surface-active)" : "var(--surface-3)"}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      )}

                      <AnimatePresence>
                        {openMenuId === group.id && (
                          <GroupContextMenu
                            group={group}
                            onClose={() => setOpenMenuId(null)}
                            onLeave={() => setConfirmLeave(group)}
                            onRename={() => setConfirmRename(group)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmLeave && (
          <ConfirmDialog
            title="Leave Group"
            message={`Are you sure you want to leave "${confirmLeave.name}"? You won't be able to see its messages anymore.`}
            confirmLabel="Leave"
            danger
            onConfirm={() => handleLeave(confirmLeave)}
            onCancel={() => setConfirmLeave(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmRename && (
          <RenameDialog
            group={confirmRename}
            onConfirm={(newName) => handleRename(confirmRename, newName)}
            onCancel={() => setConfirmRename(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FriendsList({ friends, onlineUsers, expanded, onToggle, onFriendSelect, friendRequests, onAcceptFriend, onDeclineFriend }) {
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
  const pendingRequests = Array.isArray(friendRequests) ? friendRequests : [];

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
        style={{ position: "relative" }}
      >
        <span className="section-title">Friends</span>
        {pendingRequests.length > 0 && (
          <span style={{
            background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700,
            borderRadius: 10, padding: "1px 6px", minWidth: 16, textAlign: "center", lineHeight: "16px",
          }}>
            {pendingRequests.length}
          </span>
        )}
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
            {pendingRequests.length > 0 && (
              <div className="friend-category">
                <span className="category-label" style={{ color: "var(--warning)" }}>
                  Pending — {pendingRequests.length}
                </span>
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 8px", borderRadius: 8,
                      background: "var(--surface-2)", marginBottom: 4,
                    }}
                  >
                    <div className="friend-avatar" style={{ flexShrink: 0 }}>
                      <Avatar name={req.username} size={32} imageUrl={req.avatarUrl} />
                    </div>
                    <span className="friend-name" style={{ flex: 1, fontSize: 13 }}>{req.username}</span>
                    <button
                      title="Accept"
                      onClick={() => onAcceptFriend?.(req.id)}
                      style={{
                        width: 26, height: 26, borderRadius: 6, border: "none",
                        background: "var(--success-soft)", color: "var(--success)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--success)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--success-soft)"}
                    >
                      <UserPlus size={13} />
                    </button>
                    <button
                      title="Decline"
                      onClick={() => onDeclineFriend?.(req.id)}
                      style={{
                        width: 26, height: 26, borderRadius: 6, border: "none",
                        background: "var(--danger-soft)", color: "var(--danger)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--danger)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--danger-soft)"}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

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
