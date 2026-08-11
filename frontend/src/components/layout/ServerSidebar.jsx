import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Settings, Hash,
  ChevronDown, Bell, UserPlus, X, User, Users, Megaphone,
  MoreHorizontal, LogOut, Edit3, Check, UserRoundPlus, RefreshCw, MessageSquarePlus, Star, Bug, Lightbulb, ChevronDown as ChevronDownIcon,
  Link2, Sparkles, Loader2, UsersRound,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";
import { addMemberToGroup } from "../../api/groups";
import { getFriendSuggestions } from "../../api/friends";
import { resolveDisplayName } from "../../lib/userProfile";
import { isVisiblyOnline } from "../../lib/presence";
import CallsView from "../calls/CallsView";
import GroupInviteModal from "../groups/GroupInviteModal";
import { markFeedbackSubmitted } from "../../lib/feedbackNudge";
import { useLocale, useT } from "../../context/LocaleContext";
import AdminBadge from "../social/AdminBadge";
import InviteCard from "../friends/InviteCard";

const FEEDBACK_TYPE_TO_CATEGORY = {
  suggestion: "feature",
  bug: "bug",
  praise: "improvement",
};

const RATING_TO_PRIORITY = {
  1: "critical",
  2: "high",
  3: "medium",
  4: "low",
  5: "low",
};

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
  onRefresh,
  friendRequests,
  onAcceptFriend,
  onDeclineFriend,
  onMobileClose,
  isMobile = false,
  dmUnread = {},
  groupUnread = {},
  me = null,
  onStartCall,
  onOpenChatFromCalls,
  onStartGroupCall,
  onOpenGroupFromCalls,
}) {
  const t = useT();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    dms: true,
    groups: true,
    friends: true,
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
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [sentUsernames, setSentUsernames] = useState(() => new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onFriendError = ({ message }) => {
      setAddError(message || t("Friend action failed."));
      setTimeout(() => setAddError(""), 4000);
    };
    const onFriendSent = ({ to } = {}) => {
      setAddSuccess(to ? t("Request sent to {to}", { to }) : t("Request sent."));
      setTimeout(() => setAddSuccess(""), 3000);
      if (to) setSentUsernames((prev) => new Set(prev).add(to));
    };
    socket.on("friend:error", onFriendError);
    socket.on("friend:request:sent", onFriendSent);
    return () => {
      socket.off("friend:error", onFriendError);
      socket.off("friend:request:sent", onFriendSent);
    };
  }, [socket, t]);

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

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    setSuggestionsError("");
    try {
      const data = await getFriendSuggestions(14);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (err) {
      setSuggestionsError(err.message || t("Failed to load suggestions"));
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (showAddModal && addTab === "quickadd") {
      fetchSuggestions();
    }
  }, [showAddModal, addTab]);

  const handleQuickAdd = (username) => {
    if (!username || sentUsernames.has(username)) return;
    socket?.emit("friend:request", { toUsername: username });
    // Optimistic — friend:request:sent / friend:error confirm or roll this back.
    setSentUsernames((prev) => new Set(prev).add(username));
  };

  const handleAddFriend = async () => {
    if (!friendUsername.trim()) return;
    setAddLoading(true);
    setAddError("");
    setAddSuccess("");
    try {
      socket?.emit("friend:request", { toUsername: friendUsername.trim() });
      setFriendUsername("");
    } catch (err) {
      setAddError(t("Failed to send friend request"));
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
      if (!res.ok) throw new Error(data.error || data.details || t("Failed to create group (status {status})", { status: res.status }));
      setAddSuccess(t('Group "{name}" created', { name: groupName.trim() }));
      setGroupName("");
      setSelectedGroupMembers([]);
      setTimeout(() => setAddSuccess(""), 3000);
      setShowAddModal(false);
      // Optimistically add the new group immediately, then do a background refresh
      if (data.group) onGroupCreated?.(data.group);
      onRefreshGroups?.();
    } catch (err) {
      setAddError(err.message || t("Network error. Is backend deployed?"));
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
      (dm.displayName || dm.username || "").toLowerCase().includes(searchQuery.toLowerCase())
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
            {activeView === "chat" && t("Chats")}
            {activeView === "dms" && t("Direct Messages")}
            {activeView === "groups" && t("Groups")}
            {activeView === "friends" && t("Friends")}
            {activeView === "calls" && t("Calls")}
          </h2>
          <div className="sidebar-actions">
            {onMobileClose && (
              <button type="button" className="icon-btn mobile-sidebar-close" onClick={onMobileClose} title={t("Close")}>
                <X size={18} />
              </button>
            )}
            <button
              className="icon-btn"
              title={t("Refresh")}
              onClick={async () => {
                setIsRefreshing(true);
                await onRefresh?.();
                setTimeout(() => setIsRefreshing(false), 800);
              }}
              style={{ position: 'relative' }}
            >
              <RefreshCw size={18} className={isRefreshing ? 'spin-refresh' : ''} />
            </button>
            <button
              className="icon-btn"
              title={t("Search")}
              onClick={() => {
                const searchInput = document.querySelector('.search-input');
                searchInput?.focus();
              }}
            >
              <Search size={18} />
            </button>
            <button
              className="icon-btn"
              title={t("Announcements")}
              onClick={() => setShowAnnouncements(!showAnnouncements)}
            >
              <Megaphone size={18} />
            </button>
            <button
              className="icon-btn"
              title={t("Send Feedback")}
              onClick={() => { setShowFeedback(true); setFeedbackSent(false); setFeedbackText(''); setFeedbackRating(0); setFeedbackType('suggestion'); }}
            >
              <MessageSquarePlus size={18} />
            </button>
            {activeView === "friends" && me?.username && (
              <button
                className="icon-btn"
                title={t("Copy invite link")}
                onClick={async () => {
                  try {
                    const { buildFriendInviteUrl } = await import("../../lib/referral");
                    const { Funnel } = await import("../../site/analytics");
                    const url = buildFriendInviteUrl(me.username);
                    await navigator.clipboard.writeText(url);
                    Funnel.inviteGenerated({ method: "copy_link", username: me.username });
                    setAddSuccess(t("Invite link copied"));
                    setTimeout(() => setAddSuccess(""), 3000);
                  } catch {
                    setAddError(t("Could not copy invite link"));
                    setTimeout(() => setAddError(""), 3000);
                  }
                }}
              >
                <Link2 size={18} />
              </button>
            )}
            <button
              className="icon-btn"
              title={t("Add")}
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

        {/* Feedback Modal */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              className="feedback-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { if (e.target === e.currentTarget) { setShowFeedback(false); setFeedbackSent(false); } }}
            >
              <motion.div
                className="feedback-modal"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {feedbackSent ? (
                  <div className="feedback-success">
                    <div className="feedback-success-icon">✓</div>
                    <h3>{t("Thanks for your feedback!")}</h3>
                    <p>{t("We review every submission and use it to make Descall better.")}</p>
                    <button className="feedback-close-btn" onClick={() => { setShowFeedback(false); setFeedbackSent(false); }}>{t("Close")}</button>
                  </div>
                ) : (
                  <>
                    <div className="feedback-header">
                      <div className="feedback-header-left">
                        <MessageSquarePlus size={20} />
                        <h3>{t("Send Feedback")}</h3>
                      </div>
                      <button className="icon-btn" onClick={() => setShowFeedback(false)}><X size={18} /></button>
                    </div>

                    <div className="feedback-type-row">
                      {[
                        { id: 'suggestion', label: t('Suggestion'), icon: <Lightbulb size={14} /> },
                        { id: 'bug', label: t('Bug Report'), icon: <Bug size={14} /> },
                        { id: 'praise', label: t('Praise'), icon: <Star size={14} /> },
                      ].map(ft => (
                        <button
                          key={ft.id}
                          className={`feedback-type-btn${feedbackType === ft.id ? ' active' : ''}`}
                          onClick={() => setFeedbackType(ft.id)}
                        >
                          {ft.icon} {ft.label}
                        </button>
                      ))}
                    </div>

                    <div className="feedback-rating-row">
                      <span className="feedback-rating-label">{t("Overall experience")}</span>
                      <div className="feedback-stars">
                        {[1,2,3,4,5].map(n => (
                          <button
                            key={n}
                            className={`feedback-star${feedbackRating >= n ? ' active' : ''}`}
                            onClick={() => setFeedbackRating(n)}
                            aria-label={t("{n} star", { n })}
                          >
                            <Star size={18} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      className="feedback-textarea"
                      placeholder={feedbackType === 'bug' ? t('Describe the bug — what happened and how to reproduce it…') : feedbackType === 'praise' ? t('Tell us what you love about Descall…') : t('Share your idea or suggestion…')}
                      value={feedbackText}
                      onChange={e => setFeedbackText(e.target.value)}
                      rows={5}
                      maxLength={1000}
                    />
                    <div className="feedback-char-count">{feedbackText.length}/1000</div>

                    <button
                      className="feedback-submit-btn"
                      disabled={feedbackText.trim().length < 5 || feedbackSending}
                      onClick={async () => {
                        if (feedbackText.trim().length < 5) return;
                        setFeedbackSending(true);
                        try {
                          await fetch(`${API_BASE_URL}/api/feedback/submit`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                            body: JSON.stringify({
                              category: FEEDBACK_TYPE_TO_CATEGORY[feedbackType] || 'other',
                              priority: RATING_TO_PRIORITY[feedbackRating] || 'medium',
                              message: feedbackText.trim(),
                            }),
                          });
                        } catch (_) {}
                        setFeedbackSending(false);
                        setFeedbackSent(true);
                        markFeedbackSubmitted();
                      }}
                    >
                      {feedbackSending ? t('Sending…') : t('Submit Feedback')}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="sidebar-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder={t("Search")}
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
              isMobile={isMobile}
              unreadById={dmUnread}
            />
          )}

          {activeView === "groups" && (
            <GroupList
              groups={filteredGroups}
              friends={friends}
              activeGroup={activeGroup}
              expanded={expandedSections.groups}
              onToggle={() => toggleSection("groups")}
              onGroupSelect={onGroupSelect}
              onGroupLeft={onGroupLeft}
              onGroupRenamed={onGroupRenamed}
              isMobile={isMobile}
              unreadById={groupUnread}
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
              isMobile={isMobile}
              me={me}
              onShareInvite={async () => {
                try {
                  const { buildFriendInviteUrl } = await import("../../lib/referral");
                  const { Funnel } = await import("../../site/analytics");
                  const url = buildFriendInviteUrl(me?.username);
                  await navigator.clipboard.writeText(url);
                  Funnel.inviteGenerated({ method: "empty_state", username: me?.username });
                  setAddSuccess(t("Invite link copied"));
                  setTimeout(() => setAddSuccess(""), 3000);
                } catch {
                  setAddError(t("Could not copy invite link"));
                  setTimeout(() => setAddError(""), 3000);
                }
              }}
              onQuickAdd={() => { setAddTab("quickadd"); setShowAddModal(true); }}
            />
          )}

          {activeView === "calls" && (
            <CallsView
              compact
              me={me}
              friends={friends}
              groups={groups}
              onlineUsers={onlineUsers}
              socket={socket}
              onStartCall={onStartCall}
              onStartGroupCall={onStartGroupCall}
              onOpenChat={(user) => {
                onOpenChatFromCalls?.(user);
                onMobileClose?.();
              }}
              onOpenGroup={(group) => {
                onOpenGroupFromCalls?.(group);
                onMobileClose?.();
              }}
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
                  <h3>{t("Create New")}</h3>
                  <button className="icon-btn" onClick={() => setShowAddModal(false)}><X size={18} /></button>
                </div>

                <div className="add-modal-tabs">
                  <button className={`add-modal-tab ${addTab === "quickadd" ? "active" : ""}`} onClick={() => { setAddTab("quickadd"); setAddError(""); setAddSuccess(""); }}>
                    <Sparkles size={16} /> {t("Quick Add")}
                  </button>
                  <button className={`add-modal-tab ${addTab === "friend" ? "active" : ""}`} onClick={() => { setAddTab("friend"); setAddError(""); setAddSuccess(""); }}>
                    <User size={16} /> {t("Add Friend")}
                  </button>
                  <button className={`add-modal-tab ${addTab === "group" ? "active" : ""}`} onClick={() => { setAddTab("group"); setAddError(""); setAddSuccess(""); }}>
                    <Users size={16} /> {t("Create Group")}
                  </button>
                </div>

                <div className="add-modal-body">
                  {addTab === "quickadd" && (
                    <div className="quick-add-panel">
                      <p className="quick-add-intro">
                        {t("People you may know — ranked by mutual friends and shared groups.")}
                      </p>
                      {suggestionsLoading ? (
                        <div className="quick-add-loading">
                          <Loader2 size={22} className="spin" />
                          <span>{t("Finding people you may know...")}</span>
                        </div>
                      ) : suggestionsError ? (
                        <div className="quick-add-empty">
                          <span>{suggestionsError}</span>
                          <button type="button" className="add-modal-btn" onClick={fetchSuggestions}>
                            <RefreshCw size={14} /> {t("Try again")}
                          </button>
                        </div>
                      ) : suggestions.length === 0 ? (
                        <div className="quick-add-empty">
                          <UsersRound size={28} style={{ opacity: 0.5 }} />
                          <span>{t("No suggestions right now — check back after you join a few groups or make some friends.")}</span>
                        </div>
                      ) : (
                        <div className="quick-add-list">
                          {suggestions.map((s) => {
                            const sent = sentUsernames.has(s.username);
                            return (
                              <motion.div
                                key={s.id}
                                className="quick-add-card"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18 }}
                              >
                                <Avatar user={s} size={40} />
                                <div className="quick-add-card-meta">
                                  <span className="quick-add-card-name">{s.displayName || s.username}</span>
                                  {s.reason === "mutual" ? (
                                    <span className="quick-add-card-badge mutual">
                                      <UsersRound size={11} />
                                      {t("{count} mutual friends", { count: s.mutualFriends })}
                                    </span>
                                  ) : s.reason === "group" ? (
                                    <span className="quick-add-card-badge group">
                                      <Hash size={11} />
                                      {t("{count} shared groups", { count: s.sharedGroups })}
                                    </span>
                                  ) : (
                                    <span className="quick-add-card-badge suggested">
                                      <Sparkles size={11} />
                                      {t("Suggested for you")}
                                    </span>
                                  )}
                                </div>
                                <motion.button
                                  type="button"
                                  className={`quick-add-btn ${sent ? "sent" : ""}`}
                                  whileTap={{ scale: 0.94 }}
                                  disabled={sent}
                                  onClick={() => handleQuickAdd(s.username)}
                                >
                                  {sent ? <Check size={15} /> : <UserPlus size={15} />}
                                  {sent ? t("Sent") : t("Add")}
                                </motion.button>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {addTab === "friend" && (
                    <>
                      <label className="add-modal-label">{t("Enter a username to add")}</label>
                      <input className="add-modal-input" value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} placeholder={t("e.g. johndoe")} onKeyDown={(e) => e.key === "Enter" && handleAddFriend()} />
                      <motion.button type="button" className="add-modal-btn" onClick={handleAddFriend} disabled={addLoading || !friendUsername.trim()} whileTap={{ scale: 0.97 }}>
                        {addLoading ? t("Sending...") : t("Send Friend Request")}
                      </motion.button>
                    </>
                  )}
                  {addTab === "group" && (
                    <>
                      <label className="add-modal-label">{t("Group name")}</label>
                      <input className="add-modal-input" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t("e.g. Gaming Squad")} onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()} />
                      
                      <label className="add-modal-label" style={{ marginTop: 12 }}>{t("Add members (optional)")}</label>
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
                                <span style={{ fontSize: 13 }}>{resolveDisplayName(friend)}</span>
                                {isSelected && <span style={{ marginLeft: "auto", color: "var(--primary)" }}>✓</span>}
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: 8, color: "var(--text-muted)", fontSize: 12 }}>
                            {t("No friends to add. Add friends first.")}
                          </div>
                        )}
                      </div>
                      
                      <motion.button type="button" className="add-modal-btn" onClick={handleCreateGroup} disabled={addLoading || !groupName.trim()} whileTap={{ scale: 0.97 }}>
                        {addLoading ? t("Creating...") : t("Create Group")}
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
                    <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>{t("Loading announcements...")}</div>
                  ) : announcements.length === 0 ? (
                    <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "14px", textAlign: "center" }}>{t("No announcements")}</div>
                  ) : (
                    announcements.map((a) => (
                      <div key={a.id} className="announcement-item">
                        <div className="announcement-title">{a.title}</div>
                        <div className="announcement-content">{a.content}</div>
                        <div className="announcement-meta">
                          {a.author && <span className="announcement-author">{t("By {author}", { author: a.author })}</span>}
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

function SidebarSectionContent({ expanded, children }) {
  return (
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          key="section-body"
          className="section-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: "hidden" }}
        >
          <motion.div
            initial={{ y: -6 }}
            animate={{ y: 0 }}
            exit={{ y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionChevron({ expanded }) {
  return (
    <motion.span
      className="section-chevron"
      animate={{ rotate: expanded ? 0 : -90 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: "inline-flex", transformOrigin: "50% 50%" }}
      aria-hidden="true"
    >
      <ChevronDown size={16} />
    </motion.span>
  );
}

function formatConversationTime(iso, t, locale) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const loc = locale === "tr" ? "tr-TR" : locale === "en" ? "en-US" : undefined;
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return t("Yesterday");
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    if (d >= weekAgo) {
      return d.toLocaleDateString(loc, { weekday: "short" });
    }
    return d.toLocaleDateString(loc, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatUnreadCount(n) {
  const count = Number(n) || 0;
  if (count <= 0) return null;
  if (count > 99) return "99+";
  return String(count);
}

function UnreadBadge({ count }) {
  const label = formatUnreadCount(count);
  return (
    <AnimatePresence mode="popLayout">
      {label && (
        <motion.span
          key={label}
          className="conv-unread-badge"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          aria-label={`${label} unread`}
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

const LIST_LAYOUT_TRANSITION = {
  layout: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  opacity: { duration: 0.2 },
};

function DMList({ dms, activeDmUser, onlineUsers, expanded, onToggle, onDmSelect, isMobile, unreadById = {} }) {
  const t = useT();
  const { locale } = useLocale();
  const safeDms = Array.isArray(dms) ? dms : [];

  return (
    <div className="sidebar-section">
      <button
        className="section-header"
        onClick={onToggle}
      >
        <span className="section-title">{t("CHATS")}</span>
        <SectionChevron expanded={expanded} />
      </button>

      <SidebarSectionContent expanded={expanded}>
        {safeDms.length === 0 ? (
          <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
            {t("No conversations yet")}
          </div>
        ) : (
          <div className="conv-list">
            {safeDms.map((dm) => {
              const isOnline = isVisiblyOnline(onlineUsers, dm.id);
              const isActive = activeDmUser?.id === dm.id;
              const unread = dm.unreadCount || unreadById[dm.id] || 0;
              const timeLabel = formatConversationTime(dm.lastActivity, t, locale);

              return (
                <motion.button
                  key={dm.id}
                  layout
                  className={`dm-item conv-row ${isActive ? "active" : ""} ${unread > 0 ? "has-unread" : ""}`}
                  onClick={() => onDmSelect?.(dm)}
                  whileHover={{ scale: 1.01 }}
                  transition={LIST_LAYOUT_TRANSITION}
                >
                  <div className="dm-avatar">
                    <Avatar
                      name={resolveDisplayName(dm)}
                      size={40}
                      user={dm}
                    />
                    <StatusBadge status={onlineUsers?.find((u) => u.id === dm.id)?.status || (isOnline ? "online" : "offline")} />
                  </div>
                  <div className="dm-info conv-row-body">
                    <div className="conv-row-top">
                      <span className={`dm-name ${unread > 0 ? "unread" : ""}`}>{resolveDisplayName(dm)}</span>
                      {timeLabel && (
                        <span className={`conv-time ${unread > 0 ? "unread" : ""}`}>{timeLabel}</span>
                      )}
                    </div>
                    <div className="conv-row-bottom">
                      <span className={`dm-preview ${unread > 0 ? "unread" : ""}`}>
                        {dm.lastMessage || t("No messages yet")}
                      </span>
                      <UnreadBadge count={unread} />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </SidebarSectionContent>
    </div>
  );
}

function AddMemberDialog({ group, friends, onClose, onMemberAdded }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filtered = (friends || []).filter((f) =>
    f.username?.toLowerCase().includes(query.toLowerCase())
  );

  const handleAdd = async (friend) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await addMemberToGroup(group.id, friend.id);
      setSuccess(`${friend.username} added to ${group.name}`);
      onMemberAdded?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 16 }}
        transition={{ type: "spring", damping: 24, stiffness: 340 }}
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-3)",
          borderRadius: 16,
          padding: 0,
          width: 340,
          maxHeight: 520,
          boxShadow: "var(--shadow-xl)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border-2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--primary-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--primary)",
            }}>
              <UserRoundPlus size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-0)" }}>{t("Add Member")}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{group.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "transparent", color: "var(--text-muted)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-2)" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)", pointerEvents: "none",
            }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search friends…")}
              style={{
                width: "100%", padding: "8px 10px 8px 32px",
                background: "var(--surface-2)", border: "1px solid var(--border-3)",
                borderRadius: 8, color: "var(--text-1)", fontSize: 13,
                outline: "none", boxSizing: "border-box",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--primary)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border-3)"; }}
            />
          </div>
        </div>

        {/* Friend list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              {(friends || []).length === 0 ? t("No friends to add") : t("No results")}
            </div>
          ) : (
            filtered.map((friend) => (
              <button
                key={friend.id}
                disabled={loading}
                onClick={() => handleAdd(friend)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "9px 12px", borderRadius: 8, border: "none",
                  background: "transparent", cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.12s", textAlign: "left",
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ flexShrink: 0 }}>
                  <Avatar name={resolveDisplayName(friend)} size={34} user={friend} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{resolveDisplayName(friend)}</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
                  fontSize: 11, color: "var(--primary)", fontWeight: 600,
                }}>
                  <UserRoundPlus size={13} />
                  Add
                </div>
              </button>
            ))
          )}
        </div>

        {/* Feedback */}
        {(error || success) && (
          <div style={{
            padding: "10px 16px", borderTop: "1px solid var(--border-2)",
            fontSize: 12, fontWeight: 500,
            color: error ? "var(--danger)" : "#23a55a",
            background: error ? "var(--danger-soft)" : "rgba(35,165,90,0.1)",
          }}>
            {error || success}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function GroupContextMenu({ group, onClose, onLeave, onRename, onAddMember, onInvite, anchorRef }) {
  const t = useT();
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, visibility: "hidden" });

  useLayoutEffect(() => {
    const anchor = anchorRef?.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const updatePosition = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 6;
      const pad = 8;

      let top = anchorRect.bottom + gap;
      if (top + menuRect.height > window.innerHeight - pad) {
        top = anchorRect.top - menuRect.height - gap;
      }
      top = Math.max(pad, Math.min(top, window.innerHeight - menuRect.height - pad));

      let left = anchorRect.right - menuRect.width;
      left = Math.max(pad, Math.min(left, window.innerWidth - menuRect.width - pad));

      setPosition({ top, left, visibility: "visible" });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !anchorRef?.current?.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, anchorRef]);

  return createPortal(
    <motion.div
      ref={menuRef}
      role="menu"
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        visibility: position.visibility,
        zIndex: 10000,
        background: "rgba(40, 40, 44, 0.92)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45)",
        minWidth: 180,
        overflow: "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => { onInvite?.(); onClose(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", fontSize: 13, color: "var(--text-1)",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-3)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        <Link2 size={14} style={{ color: "var(--primary)" }} />
        {t("Invite People")}
      </button>
      <div style={{ height: 1, background: "var(--border-2)", margin: "2px 0" }} />
      <button
        onClick={() => { onAddMember(); onClose(); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", fontSize: 13, color: "var(--text-1)",
          transition: "background 0.1s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-3)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
      >
        <UserRoundPlus size={14} style={{ color: "var(--text-muted)" }} />
        {t("Add Member")}
      </button>
      <div style={{ height: 1, background: "var(--border-2)", margin: "2px 0" }} />
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
        {t("Rename Group")}
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
        {t("Leave Group")}
      </button>
    </motion.div>,
    document.body
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  const t = useT();
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
            {t("Cancel")}
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
  const t = useT();
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
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "var(--text-0)" }}>{t("Rename Group")}</h3>
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
            {t("Cancel")}
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
            {t("Rename")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GroupList({ groups, friends, activeGroup, expanded, onToggle, onGroupSelect, onGroupLeft, onGroupRenamed, isMobile, unreadById = {} }) {
  const t = useT();
  const { locale } = useLocale();
  const safeGroups = Array.isArray(groups) ? groups : [];
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(null);   // group object
  const [confirmRename, setConfirmRename] = useState(null); // group object
  const [addMemberGroup, setAddMemberGroup] = useState(null); // group object
  const [inviteGroup, setInviteGroup] = useState(null); // group object
  const [actionError, setActionError] = useState("");
  const [swipeOpenId, setSwipeOpenId] = useState(null);
  const menuRef = useRef(null);
  const dotBtnRefs = useRef({});

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

  const openAction = (group, action) => {
    setSwipeOpenId(null);
    setOpenMenuId(null);
    if (action === "invite") setInviteGroup(group);
    else if (action === "add") setAddMemberGroup(group);
    else if (action === "rename") setConfirmRename(group);
    else if (action === "leave") setConfirmLeave(group);
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
          <span className="section-title">{t("GROUPS")}</span>
          <SectionChevron expanded={expanded} />
        </button>

        <SidebarSectionContent expanded={expanded}>
              {safeGroups.length === 0 ? (
                <div style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
                  {t("No groups yet")}
                </div>
              ) : (
                safeGroups.map((group) => {
                  const isActive = activeGroup?.id === group.id;
                  const unread = group.unreadCount || unreadById[group.id] || 0;
                  const timeLabel = formatConversationTime(group.lastActivity, t, locale);
                  const preview = group.lastMessage || t("No messages yet");
                  const swipeOpen = isMobile && swipeOpenId === group.id;

                  return (
                    <motion.div
                      key={group.id}
                      layout={!isMobile}
                      ref={openMenuId === group.id ? menuRef : null}
                      className={`conv-group-wrap${isMobile ? " is-swipeable" : ""}${swipeOpen ? " swipe-open" : ""}`}
                      transition={LIST_LAYOUT_TRANSITION}
                      style={{ position: "relative" }}
                    >
                      {isMobile ? (
                        <SwipeableGroupRow
                          group={group}
                          isActive={isActive}
                          unread={unread}
                          timeLabel={timeLabel}
                          preview={preview}
                          swipeOpen={swipeOpen}
                          onOpen={() => onGroupSelect?.(group)}
                          onAction={(action) => openAction(group, action)}
                          onSwipeOpenChange={(open) => {
                            setSwipeOpenId(open ? group.id : null);
                            if (open) setOpenMenuId(null);
                          }}
                          onCloseOthers={() => {
                            if (swipeOpenId && swipeOpenId !== group.id) setSwipeOpenId(null);
                          }}
                        />
                      ) : (
                        <>
                          <GroupRowFront
                            group={group}
                            isActive={isActive}
                            unread={unread}
                            timeLabel={timeLabel}
                            preview={preview}
                            isMobile={false}
                            swipeOpen={false}
                            onOpen={() => onGroupSelect?.(group)}
                            onSwipeOpenChange={() => {}}
                            onCloseOthers={() => {}}
                          />
                          {isActive && (
                            <button
                              ref={(el) => { dotBtnRefs.current[group.id] = el; }}
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
                                onAddMember={() => setAddMemberGroup(group)}
                                onInvite={() => setInviteGroup(group)}
                                anchorRef={{ current: dotBtnRefs.current[group.id] }}
                              />
                            )}
                          </AnimatePresence>
                        </>
                      )}
                    </motion.div>
                  );
                })
              )}
        </SidebarSectionContent>
      </div>

      <AnimatePresence>
        {confirmLeave && (
          <ConfirmDialog
            title={t("Leave Group")}
            message={t('Are you sure you want to leave "{name}"? You won\'t be able to see its messages anymore.', { name: confirmLeave.name })}
            confirmLabel={t("Leave")}
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

      <AnimatePresence>
        {addMemberGroup && (
          <AddMemberDialog
            group={addMemberGroup}
            friends={friends}
            onClose={() => setAddMemberGroup(null)}
            onMemberAdded={() => {}}
          />
        )}
      </AnimatePresence>

      <GroupInviteModal
        group={inviteGroup}
        open={Boolean(inviteGroup)}
        onClose={() => setInviteGroup(null)}
      />
    </>
  );
}

const GROUP_SWIPE_WIDTH = 248;

function GroupRowContent({ group, unread, timeLabel, preview }) {
  return (
    <>
      <div className="group-icon" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
        {group.icon ? (
          <img src={group.icon} alt={group.name} style={{ width: "100%", height: "100%", borderRadius: 10, objectFit: "cover" }} />
        ) : (
          <span>{group.name?.charAt(0)?.toUpperCase()}</span>
        )}
      </div>
      <div className="group-info conv-row-body">
        <div className="conv-row-top">
          <span className={`group-name ${unread > 0 ? "unread" : ""}`}>{group.name}</span>
          {timeLabel && (
            <span className={`conv-time ${unread > 0 ? "unread" : ""}`}>{timeLabel}</span>
          )}
        </div>
        <div className="conv-row-bottom">
          <span className={`group-members dm-preview ${unread > 0 ? "unread" : ""}`}>{preview}</span>
          <UnreadBadge count={unread} />
        </div>
      </div>
    </>
  );
}

/** Mobile swipe-to-reveal: front + actions as flex siblings (same row height). */
function SwipeableGroupRow({
  group,
  isActive,
  unread,
  timeLabel,
  preview,
  swipeOpen,
  onOpen,
  onAction,
  onSwipeOpenChange,
  onCloseOthers,
}) {
  const t = useT();
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const axisLock = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef(0);

  const setOffset = (value) => {
    dragOffsetRef.current = value;
    setDragOffset(value);
  };

  const visualOffset = isDragging
    ? dragOffset
    : swipeOpen
      ? -GROUP_SWIPE_WIDTH
      : 0;

  const onTouchStart = (e) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    startOffset.current = swipeOpen ? -GROUP_SWIPE_WIDTH : 0;
    axisLock.current = null;
    isDraggingRef.current = true;
    setIsDragging(true);
    setOffset(startOffset.current);
    onCloseOthers?.();
  };

  const onTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!axisLock.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisLock.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axisLock.current === "y") {
        isDraggingRef.current = false;
        setIsDragging(false);
        setOffset(swipeOpen ? -GROUP_SWIPE_WIDTH : 0);
        return;
      }
    }
    if (axisLock.current !== "x") return;
    if (e.cancelable) e.preventDefault();
    const next = Math.min(0, Math.max(-GROUP_SWIPE_WIDTH, startOffset.current + dx));
    setOffset(next);
  };

  const onTouchEnd = () => {
    if (!isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      return;
    }
    const shouldOpen = dragOffsetRef.current < -GROUP_SWIPE_WIDTH * 0.35;
    isDraggingRef.current = false;
    setIsDragging(false);
    onSwipeOpenChange?.(shouldOpen);
    setOffset(shouldOpen ? -GROUP_SWIPE_WIDTH : 0);
  };

  useEffect(() => {
    if (isDraggingRef.current) return;
    setOffset(swipeOpen ? -GROUP_SWIPE_WIDTH : 0);
  }, [swipeOpen]);

  return (
    <div
      className="group-swipe-viewport"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="group-swipe-track"
        style={{
          transform: `translate3d(${visualOffset}px,0,0)`,
          transition: isDragging ? "none" : "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        <button
          type="button"
          className={`group-item conv-row group-row-front ${isActive ? "active" : ""} ${unread > 0 ? "has-unread" : ""}`}
          onClick={() => {
            if (swipeOpen) {
              onSwipeOpenChange?.(false);
              return;
            }
            onOpen?.();
          }}
        >
          <GroupRowContent group={group} unread={isActive ? 0 : unread} timeLabel={timeLabel} preview={preview} />
        </button>
        <div className="group-swipe-actions" aria-hidden={!swipeOpen}>
          <button type="button" className="group-swipe-btn invite" onClick={() => onAction?.("invite")}>
            <Link2 size={15} />
            <span>{t("Invite")}</span>
          </button>
          <button type="button" className="group-swipe-btn add" onClick={() => onAction?.("add")}>
            <UserRoundPlus size={15} />
            <span>{t("Add")}</span>
          </button>
          <button type="button" className="group-swipe-btn rename" onClick={() => onAction?.("rename")}>
            <Edit3 size={15} />
            <span>{t("Rename")}</span>
          </button>
          <button type="button" className="group-swipe-btn leave" onClick={() => onAction?.("leave")}>
            <LogOut size={15} />
            <span>{t("Leave")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupRowFront({
  group,
  isActive,
  unread,
  timeLabel,
  preview,
  isMobile,
  swipeOpen,
  onOpen,
  onSwipeOpenChange,
}) {
  return (
    <motion.button
      layout={!isMobile}
      type="button"
      className={`group-item conv-row group-row-front ${isActive ? "active" : ""} ${unread > 0 ? "has-unread" : ""}`}
      onClick={() => {
        if (isMobile && swipeOpen) {
          onSwipeOpenChange?.(false);
          return;
        }
        onOpen?.();
      }}
      whileHover={isMobile ? undefined : { scale: 1.01 }}
      transition={LIST_LAYOUT_TRANSITION}
      style={{
        width: "100%",
        paddingRight: !isMobile && isActive ? 40 : undefined,
      }}
    >
      <GroupRowContent
        group={group}
        unread={isActive ? 0 : unread}
        timeLabel={timeLabel}
        preview={preview}
      />
    </motion.button>
  );
}

function FriendsList({ friends, onlineUsers, expanded, onToggle, onFriendSelect, friendRequests, onAcceptFriend, onDeclineFriend, isMobile, onQuickAdd, me, onShareInvite }) {
  const t = useT();
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
  const pendingRequests = Array.isArray(friendRequests) ? friendRequests : [];

  const onlineFriends = safeFriends.filter((f) => isVisiblyOnline(safeOnlineUsers, f.id));
  const offlineFriends = safeFriends.filter((f) => !isVisiblyOnline(safeOnlineUsers, f.id));

  return (
    <div className="sidebar-section">
      <button
        className="section-header"
        onClick={onToggle}
        style={{ position: "relative" }}
      >
        <span className="section-title" style={{ flex: 1, textAlign: "left" }}>{t("FRIENDS")}</span>
        {pendingRequests.length > 0 && (
          <span style={{
            background: "var(--danger)", color: "#fff", fontSize: 10, fontWeight: 700,
            borderRadius: 10, padding: "1px 6px", minWidth: 16, textAlign: "center", lineHeight: "16px",
            marginRight: 6,
          }}>
            {pendingRequests.length}
          </span>
        )}
        {onQuickAdd && (
          <span
            role="button"
            tabIndex={0}
            title={t("Quick Add")}
            aria-label={t("Quick Add")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickAdd(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onQuickAdd(); } }}
            className="friends-quick-add-btn"
          >
            <Sparkles size={13} />
          </span>
        )}
        <SectionChevron expanded={expanded} />
      </button>

      <SidebarSectionContent expanded={expanded}>
            {me?.username && (
              <div style={{ padding: "8px 10px 4px" }}>
                <InviteCard username={me.username} compact />
              </div>
            )}
            {pendingRequests.length > 0 && (
              <div className="friend-category">
                <span className="category-label" style={{ color: "var(--warning)" }}>
                  {t("Pending — {count}", { count: pendingRequests.length })}
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
                      <Avatar name={req.username} size={32} user={req} />
                    </div>
                    <span className="friend-name" style={{ flex: 1, fontSize: 13 }}>{req.username}</span>
                    <button
                      type="button"
                      title={t("Accept")}
                      aria-label={t("Accept Friend")}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onAcceptFriend?.(req.id);
                      }}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: "none",
                        background: "var(--success-soft)", color: "var(--success)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "background 0.15s",
                        touchAction: "manipulation",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--success)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--success-soft)"}
                    >
                      <UserPlus size={14} />
                    </button>
                    <button
                      type="button"
                      title={t("Decline")}
                      aria-label={t("Decline")}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeclineFriend?.(req.id);
                      }}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: "none",
                        background: "var(--danger-soft)", color: "var(--danger)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "background 0.15s",
                        touchAction: "manipulation",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--danger)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "var(--danger-soft)"}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {onlineFriends.length > 0 && (
              <div className="friend-category">
                <span className="category-label">{t("Online — {count}", { count: onlineFriends.length })}</span>
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
                        name={resolveDisplayName(friend)} 
                        size={32}
                        user={friend}
                      />
                      <StatusBadge
                        status={safeOnlineUsers.find((u) => u.id === friend.id)?.status || "online"}
                      />
                    </div>
                    <div className="friend-meta">
                      <span className="friend-name">
                        {resolveDisplayName(friend)}
                        <AdminBadge user={friend} variant="inline" />
                      </span>
                      {(friend.customStatus || friend.custom_status) && (
                        <span className="friend-custom-status">
                          {friend.customStatus || friend.custom_status}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {offlineFriends.length > 0 && (
              <div className="friend-category">
                <span className="category-label">{t("Offline — {count}", { count: offlineFriends.length })}</span>
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
                        name={resolveDisplayName(friend)}
                        size={32}
                        user={friend}
                      />
                      <StatusBadge status="offline" />
                    </div>
                    <div className="friend-meta">
                      <span className="friend-name">
                        {resolveDisplayName(friend)}
                        <AdminBadge user={friend} variant="inline" />
                      </span>
                      {(friend.customStatus || friend.custom_status) && (
                        <span className="friend-custom-status">
                          {friend.customStatus || friend.custom_status}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
            {safeFriends.length === 0 && pendingRequests.length === 0 && (
              <div className="sidebar-empty-friends">
                <div className="empty-illustration empty-illu-friends compact" aria-hidden="true">
                  <div className="empty-illu-blob" />
                  <div className="empty-illu-blob secondary" />
                </div>
                <strong>{t("No friends yet")}</strong>
                <span>{t("Share your invite link — friends join free and connect with you instantly.")}</span>
                <div className="sidebar-empty-friends-actions">
                  <button type="button" className="mkt-btn mkt-btn-soft" onClick={onQuickAdd}>
                    {t("Add friend")}
                  </button>
                </div>
              </div>
            )}
      </SidebarSectionContent>
    </div>
  );
}
