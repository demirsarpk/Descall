import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Users, User, Phone, Video, Plus, Search,
  ChevronLeft, Bell, LogOut, Settings, UserPlus, X, Hash
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import MessageComposer from "../chat/MessageComposer";
import TypingIndicator from "../chat/TypingIndicator";
import UserPanel from "./UserPanel";
import { useMobile } from "../../hooks/useMobile";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

const TABS = [
  { id: "chats", label: "Sohbetler", icon: MessageSquare },
  { id: "friends", label: "Arkadaşlar", icon: Users },
  { id: "groups", label: "Gruplar", icon: Hash },
  { id: "profile", label: "Profil", icon: User },
];

export default function MobileAppLayout({
  children,
  me,
  socket,
  onLogout,
  activeDmUser,
  activeGroup,
  groups = [],
  dms = [],
  friends = [],
  onlineUsers = [],
  onDmSelect,
  onGroupSelect,
  onSendMessage,
  onVoiceCall,
  onVideoCall,
  onGroupVoiceCall,
  onGroupVideoCall,
  onAdminClick,
  isAdmin,
  onRefreshGroups,
  onGroupCreated,
  friendNotice,
  activeCallBanner,
  onJoinActiveCall,
  onDismissActiveBanner,
  friendRequests = [],
  onAcceptFriend,
  onDeclineFriend,
  notifPermission,
  onRequestNotifPermission,
  typingDmUser,
  typingGroupUsers,
  onTypingDmStart,
  onTypingDmStop,
  onTypingGroupStart,
  onTypingGroupStop,
}) {
  const { isPortrait, vibrate } = useMobile();
  const [activeTab, setActiveTab] = useState("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addTab, setAddTab] = useState("friend");
  const [friendUsername, setFriendUsername] = useState("");
  const [groupName, setGroupName] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const messagesRef = useRef(null);

  const inConversation = !!(activeDmUser || activeGroup);
  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;
  const showNotifBanner = !isElectron && !notifDismissed && notifPermission === "default";

  useEffect(() => {
    document.documentElement.classList.add("mobile-active");
    document.body.classList.add("mobile-active");
    return () => {
      document.documentElement.classList.remove("mobile-active");
      document.body.classList.remove("mobile-active");
    };
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [activeDmUser?.id, activeGroup?.id, children]);

  useEffect(() => {
    if (!socket) return;
    const onFriendError = ({ message }) => {
      setAddError(message || "İşlem başarısız.");
      setTimeout(() => setAddError(""), 4000);
    };
    const onFriendSent = ({ to } = {}) => {
      setAddSuccess(to ? `${to} kullanıcısına istek gönderildi` : "İstek gönderildi.");
      setTimeout(() => setAddSuccess(""), 3000);
    };
    socket.on("friend:error", onFriendError);
    socket.on("friend:request:sent", onFriendSent);
    return () => {
      socket.off("friend:error", onFriendError);
      socket.off("friend:request:sent", onFriendSent);
    };
  }, [socket]);

  const onlineIds = useMemo(
    () => new Set((onlineUsers || []).map((u) => u.id)),
    [onlineUsers]
  );

  const filteredDms = useMemo(() => {
    const list = Array.isArray(dms) ? dms : [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((d) => d.username?.toLowerCase().includes(q));
  }, [dms, searchQuery]);

  const filteredGroups = useMemo(() => {
    const list = Array.isArray(groups) ? groups : [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((g) => g.name?.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  const { onlineFriends, offlineFriends } = useMemo(() => {
    const list = Array.isArray(friends) ? friends : [];
    const on = list.filter((f) => onlineIds.has(f.id));
    const off = list.filter((f) => !onlineIds.has(f.id));
    return { onlineFriends: on, offlineFriends: off };
  }, [friends, onlineIds]);

  const typingNames = useMemo(() => {
    if (activeDmUser) return typingDmUser ? [typingDmUser.username] : [];
    if (activeGroup) {
      const map = typingGroupUsers?.[activeGroup.id];
      if (!map) return [];
      return [...map.values()].map((u) => u.username);
    }
    return [];
  }, [activeDmUser, activeGroup, typingDmUser, typingGroupUsers]);

  const handleTabChange = (tabId) => {
    vibrate(20);
    setActiveTab(tabId);
    setSearchQuery("");
  };

  const handleDmSelect = (dm) => {
    vibrate(30);
    onDmSelect?.(dm);
  };

  const handleGroupSelect = (group) => {
    vibrate(30);
    onGroupSelect?.(group);
  };

  const handleBack = () => {
    vibrate(20);
    onDmSelect?.(null);
    onGroupSelect?.(null);
  };

  const handleAddFriend = () => {
    if (!friendUsername.trim()) return;
    setAddLoading(true);
    setAddError("");
    setAddSuccess("");
    socket?.emit("friend:request", { toUsername: friendUsername.trim() });
    setFriendUsername("");
    setAddLoading(false);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setAddLoading(true);
    setAddError("");
    setAddSuccess("");
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/groups/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grup oluşturulamadı");
      onGroupCreated?.(data.group || data);
      setGroupName("");
      setAddSuccess("Grup oluşturuldu!");
      setTimeout(() => { setShowAddSheet(false); setAddSuccess(""); }, 1200);
      onRefreshGroups?.();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const landscapeSplit = !isPortrait;

  const renderListItem = (item, type) => {
    const isDm = type === "dm";
    const isActive = isDm
      ? activeDmUser?.id === item.id
      : activeGroup?.id === item.id;
    const isOnline = onlineIds.has(item.id);

    return (
      <button
        key={item.id}
        className={`mobile-list-item mobile-glass-light ${isActive ? "active" : ""}`}
        onClick={() => (isDm ? handleDmSelect(item) : handleGroupSelect(item))}
      >
        {isDm ? (
          <div className="mobile-list-avatar">
            <Avatar name={item.username} size={44} imageUrl={item.avatarUrl} />
            <StatusBadge status={isOnline ? "online" : "offline"} />
          </div>
        ) : (
          <div className="mobile-group-icon">
            {item.icon ? (
              <img src={item.icon} alt="" />
            ) : (
              <span>{item.name?.charAt(0)?.toUpperCase()}</span>
            )}
          </div>
        )}
        <div className="mobile-list-body">
          <span className="mobile-list-title">{isDm ? item.username : item.name}</span>
          <span className="mobile-list-subtitle">
            {isDm
              ? (isOnline ? "Çevrimiçi" : "Çevrimdışı")
              : `${item.memberCount || item.members?.length || 0} üye`}
          </span>
        </div>
      </button>
    );
  };

  const renderChatsTab = () => (
    <>
      {filteredDms.length === 0 ? (
        <div className="mobile-empty">
          <div className="mobile-empty-icon"><MessageSquare size={32} /></div>
          <h3>Henüz sohbet yok</h3>
          <p>Arkadaşlar sekmesinden birini seçerek sohbet başlatın.</p>
        </div>
      ) : (
        <div className="mobile-list">
          {filteredDms.map((dm) => renderListItem(dm, "dm"))}
        </div>
      )}
    </>
  );

  const renderFriendsTab = () => (
    <>
      {friendRequests?.length > 0 && (
        <>
          <div className="mobile-section-label">İstekler — {friendRequests.length}</div>
          {friendRequests.map((req) => (
            <div key={req.id} className="mobile-request-row mobile-glass-light">
              <Avatar name={req.username} size={40} imageUrl={req.avatarUrl} />
              <span className="mobile-request-name">{req.username}</span>
              <div className="mobile-request-actions">
                <button className="mobile-request-btn accept" onClick={() => onAcceptFriend?.(req.id)}>
                  <UserPlus size={16} />
                </button>
                <button className="mobile-request-btn decline" onClick={() => onDeclineFriend?.(req.id)}>
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {onlineFriends.length > 0 && (
        <>
          <div className="mobile-section-label">Çevrimiçi — {onlineFriends.length}</div>
          <div className="mobile-list">
            {onlineFriends.map((f) => renderListItem(f, "dm"))}
          </div>
        </>
      )}
      {offlineFriends.length > 0 && (
        <>
          <div className="mobile-section-label">Çevrimdışı — {offlineFriends.length}</div>
          <div className="mobile-list">
            {offlineFriends.map((f) => renderListItem(f, "dm"))}
          </div>
        </>
      )}
      {friends.length === 0 && !friendRequests?.length && (
        <div className="mobile-empty">
          <div className="mobile-empty-icon"><Users size={32} /></div>
          <h3>Arkadaş ekle</h3>
          <p>Kullanıcı adıyla arkadaş isteği gönderin.</p>
        </div>
      )}
    </>
  );

  const renderGroupsTab = () => (
    <>
      {filteredGroups.length === 0 ? (
        <div className="mobile-empty">
          <div className="mobile-empty-icon"><Hash size={32} /></div>
          <h3>Grup yok</h3>
          <p>Yeni bir grup oluşturun veya davet ile katılın.</p>
        </div>
      ) : (
        <div className="mobile-list">
          {filteredGroups.map((g) => renderListItem(g, "group"))}
        </div>
      )}
    </>
  );

  const renderProfileTab = () => (
    <div className="mobile-profile-card mobile-glass">
      <div className="mobile-profile-avatar">
        <Avatar name={me?.username} size={80} imageUrl={me?.avatarUrl} />
        <StatusBadge status="online" />
      </div>
      <h2 className="mobile-profile-name">{me?.displayName || me?.username}</h2>
      <p className="mobile-profile-username">@{me?.username}</p>
      <div className="mobile-profile-actions">
        <button className="mobile-profile-btn" onClick={() => setUserPanelOpen(true)}>
          <Settings size={20} />
          Ayarlar
        </button>
        {isAdmin && (
          <button className="mobile-profile-btn" onClick={onAdminClick}>
            <User size={20} />
            Yönetim Paneli
          </button>
        )}
        <button className="mobile-profile-btn danger" onClick={onLogout}>
          <LogOut size={20} />
          Çıkış Yap
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "friends": return renderFriendsTab();
      case "groups": return renderGroupsTab();
      case "profile": return renderProfileTab();
      default: return renderChatsTab();
    }
  };

  const renderConversation = () => {
    const title = activeDmUser?.username || activeGroup?.name || "";
    const subtitle = activeDmUser
      ? (onlineIds.has(activeDmUser.id) ? "Çevrimiçi" : "Çevrimdışı")
      : `${activeGroup?.memberCount || activeGroup?.members?.length || 0} üye`;

    return (
      <div className="mobile-conv-panel">
        <header className="mobile-conv-header mobile-glass">
          <button className="mobile-back-btn" onClick={handleBack} aria-label="Geri">
            <ChevronLeft size={22} />
          </button>
          <div className="mobile-list-avatar">
            {activeDmUser ? (
              <Avatar name={activeDmUser.username} size={40} imageUrl={activeDmUser.avatarUrl} />
            ) : (
              <div className="mobile-group-icon" style={{ width: 40, height: 40 }}>
                {activeGroup?.icon ? (
                  <img src={activeGroup.icon} alt="" />
                ) : (
                  <span>{activeGroup?.name?.charAt(0)?.toUpperCase()}</span>
                )}
              </div>
            )}
          </div>
          <div className="mobile-conv-info">
            <h1 className="mobile-conv-title">{title}</h1>
            <span className="mobile-conv-status">{subtitle}</span>
          </div>
          <div className="mobile-conv-actions">
            <button
              className="mobile-icon-btn"
              onClick={() => (activeGroup ? onGroupVoiceCall?.() : onVoiceCall?.())}
              aria-label="Sesli arama"
            >
              <Phone size={18} />
            </button>
            <button
              className="mobile-icon-btn"
              onClick={() => (activeGroup ? onGroupVideoCall?.() : onVideoCall?.())}
              aria-label="Görüntülü arama"
            >
              <Video size={18} />
            </button>
          </div>
        </header>

        {friendNotice && (
          <div style={{
            padding: "8px 16px", background: "var(--mobile-accent-soft)",
            color: "var(--mobile-accent)", fontSize: 13, textAlign: "center",
          }}>
            {friendNotice}
          </div>
        )}

        <div className="mobile-messages" ref={messagesRef}>
          {children}
        </div>

        <AnimatePresence>
          {typingNames.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ padding: "0 12px 4px" }}
            >
              <TypingIndicator names={typingNames} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mobile-composer-wrap">
          <MessageComposer
            onSend={onSendMessage}
            activeDmUser={activeDmUser}
            activeGroup={activeGroup}
            onTypingDmStart={onTypingDmStart}
            onTypingDmStop={onTypingDmStop}
            onTypingGroupStart={onTypingGroupStart}
            onTypingGroupStop={onTypingGroupStop}
          />
        </div>
      </div>
    );
  };

  const tabTitles = { chats: "Sohbetler", friends: "Arkadaşlar", groups: "Gruplar", profile: "Profil" };

  return (
    <div className={`mobile-app ${landscapeSplit ? "landscape-split" : ""} ${inConversation ? "in-conversation" : ""}`}>
      <AnimatePresence>
        {showNotifBanner && (
          <motion.div
            className="mobile-notif-banner"
            initial={{ y: -60 }}
            animate={{ y: 0 }}
            exit={{ y: -60 }}
          >
            <Bell size={16} />
            <span style={{ flex: 1 }}>Bildirimler için izin verin</span>
            <button onClick={async () => { await onRequestNotifPermission?.(); setNotifDismissed(true); }}>
              İzin Ver
            </button>
            <button onClick={() => setNotifDismissed(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)" }}>
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {landscapeSplit && inConversation ? (
        <div className="mobile-main-split">
          <aside className="mobile-sidebar-panel">
            <div className="mobile-list">
              {(activeTab === "groups" ? filteredGroups : filteredDms).map((item) =>
                renderListItem(item, activeTab === "groups" ? "group" : "dm")
              )}
            </div>
          </aside>
          {renderConversation()}
        </div>
      ) : inConversation ? (
        <div className="mobile-content conversation">
          {renderConversation()}
        </div>
      ) : (
        <>
          <header className="mobile-header">
            <h1 className="mobile-header-title">{tabTitles[activeTab]}</h1>
            <div className="mobile-header-actions">
              {activeTab !== "profile" && (
                <button
                  className="mobile-icon-btn primary"
                  onClick={() => {
                    setAddTab(activeTab === "groups" ? "group" : "friend");
                    setShowAddSheet(true);
                  }}
                  aria-label="Ekle"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </header>

          {activeTab !== "profile" && (
            <div className="mobile-search mobile-glass-light">
              <Search size={18} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ara..."
              />
            </div>
          )}

          <main className="mobile-content">
            {renderTabContent()}
          </main>

          <nav className="mobile-tab-bar mobile-glass" aria-label="Ana menü">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`mobile-tab ${activeTab === id ? "active" : ""}`}
                onClick={() => handleTabChange(id)}
                aria-current={activeTab === id ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={activeTab === id ? 2.2 : 1.8} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {/* Add friend / group sheet */}
      <AnimatePresence>
        {showAddSheet && (
          <motion.div
            className="mobile-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddSheet(false)}
          >
            <motion.div
              className="mobile-sheet mobile-glass"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mobile-sheet-handle" />
              <h2>{addTab === "group" ? "Grup Oluştur" : "Arkadaş Ekle"}</h2>
              <div className="mobile-sheet-tabs">
                <button
                  className={`mobile-sheet-tab ${addTab === "friend" ? "active" : ""}`}
                  onClick={() => setAddTab("friend")}
                >
                  Arkadaş
                </button>
                <button
                  className={`mobile-sheet-tab ${addTab === "group" ? "active" : ""}`}
                  onClick={() => setAddTab("group")}
                >
                  Grup
                </button>
              </div>
              {addError && <div className="mobile-sheet-error">{addError}</div>}
              {addSuccess && <div className="mobile-sheet-success">{addSuccess}</div>}
              {addTab === "friend" ? (
                <>
                  <input
                    className="mobile-input"
                    placeholder="Kullanıcı adı"
                    value={friendUsername}
                    onChange={(e) => setFriendUsername(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="mobile-submit-btn"
                    disabled={addLoading || !friendUsername.trim()}
                    onClick={handleAddFriend}
                  >
                    İstek Gönder
                  </button>
                </>
              ) : (
                <>
                  <input
                    className="mobile-input"
                    placeholder="Grup adı"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="mobile-submit-btn"
                    disabled={addLoading || !groupName.trim()}
                    onClick={handleCreateGroup}
                  >
                    Grup Oluştur
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {userPanelOpen && (
          <UserPanel
            me={me}
            onClose={() => setUserPanelOpen(false)}
            onLogout={onLogout}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
