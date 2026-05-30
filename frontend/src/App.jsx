import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthView from "./components/AuthView";
import AppLayout from "./components/layout/AppLayout";
import DownloadPage from "./components/download/DownloadPage";
import { getMe, login, register } from "./api/auth";
import { getMyGroups } from "./api/groups";
import { createSocket } from "./socket";
import { API_BASE_URL } from "./config/api";
import { useCall } from "./hooks/useCall";
import { useGroupCall } from "./hooks/useGroupCall";
import {
  clearToken,
  clearUser,
  getToken,
  getUser,
  setToken,
  setUser,
} from "./lib/storage";
import audioManager, { initAudioManager } from "./lib/audioManager";
import notificationService from "./lib/notificationService";
import AdminPanel from "./components/admin/AdminPanel";
import TitleBar from "./components/TitleBar";
import MessageList from "./components/chat/MessageList";
import MessageComposer from "./components/chat/MessageComposer";
import CallOverlay from "./components/CallOverlay";

function mergeById(existing, incoming) {
  const ids = new Set(existing.map((m) => m.id));
  const out = [...(incoming || []).filter((m) => m && !ids.has(m.id)), ...existing];
  return out.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function normalizeGroups(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.groups)) return payload.groups;
  return [];
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [me, setMe] = useState(() => getUser());
  const [isConnected, setIsConnected] = useState(false);
  const [myStatus, setMyStatus] = useState("online");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [dmByUserId, setDmByUserId] = useState({});
  const [dmUnread, setDmUnread] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [friendNotice, setFriendNotice] = useState("");
  const [socketApi, setSocketApi] = useState(null);
  const [typingDmUser, setTypingDmUser] = useState(null);
  const [dmHasMore, setDmHasMore] = useState(true);
  const [loadingOlderDm, setLoadingOlderDm] = useState(false);
  const [reconnectState, setReconnectState] = useState("idle");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminChanged, setAdminChanged] = useState(false);
  const [peerScreenSharing, setPeerScreenSharing] = useState(false);
  const [myGroups, setMyGroups] = useState([]);

  const socketRef = useRef(null);
  const activeDmRef = useRef(null);
  const myIdRef = useRef(null);
  const transportFallbackStepRef = useRef(0);
  const prevOnlineUsersRef = useRef([]);
  const call = useCall(socketApi);
  const groupCall = useGroupCall(socketApi);

  useEffect(() => {
    myIdRef.current = me?.id ?? null;
  }, [me?.id]);

  useEffect(() => {
    activeDmRef.current = activeDmUser;
  }, [activeDmUser]);

  useEffect(() => {
    setTypingDmUser(null);
  }, [activeDmUser?.id]);

  useEffect(() => {
    if (activeDmUser && socketRef.current) {
      socketRef.current.emit("dm:history", { withUserId: activeDmUser.id });
    }
  }, [activeDmUser?.id]);

  const dmMessages = useMemo(
    () => (activeDmUser ? dmByUserId[activeDmUser.id] ?? [] : []),
    [activeDmUser, dmByUserId],
  );

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setSessionChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
              const { user } = await getMe(token);
        if (!cancelled) {
          setUser(user);
          setMe(user);
        }
      } catch (err) {
        if (!cancelled) {
          clearToken();
          clearUser();
          setMe(null);
        }
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initialize audio manager and notification service on app startup
  useEffect(() => {
    initAudioManager().catch(() => {});
    // Initialize notification service (will request permission on first user interaction)
    notificationService.init().catch(() => {});
    return () => { audioManager.destroy(); };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || !me || !sessionChecked) return;
    connectSocket(token);
    return () => { socketRef.current?.disconnect(); };
  }, [me?.id, sessionChecked]);

  // Listen for user:updated event to refresh me
  useEffect(() => {
    if (!socketApi) return;
    
    const handleUserUpdated = (data) => {
      const token = getToken();
      if (!token) return;
      (async () => {
        try {
          const { user } = await getMe(token);
          setMe(user);
          setUser(user);
        } catch {
          // Ignore error
        }
      })();
    };
    
    socketApi.on("user:updated", handleUserUpdated);
    return () => { socketApi.off("user:updated", handleUserUpdated); };
  }, [socketApi]);

  // Refresh me when admin panel closes with changes
  useEffect(() => {
    if (!adminChanged) return;
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const { user } = await getMe(token);
        setMe(user);
        setUser(user);
      } catch {
        // Ignore error
      } finally {
        setAdminChanged(false);
      }
    })();
  }, [adminChanged]);

  // Refresh user data from backend
  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const { user } = await getMe(token);
      setMe(user);
      setUser(user);
      return user;
    } catch (err) {
    }
  }, []);

  const verifyBackendEndpoint = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      if (!response.ok) throw new Error(`Backend health check failed with status ${response.status}`);
      const data = await response.json().catch(() => null);
      if (!data || (data.status !== "ok" && data.status !== "healthy")) throw new Error("Invalid backend health response.");
      return true;
    } catch {
      throw new Error(`Wrong backend URL (${API_BASE_URL}). VITE_API_BASE_URL must point to your Node/Socket backend service.`);
    }
  };

  const emitDmActive = useCallback((socket, peerId) => {
    if (typeof peerId === "string") socket.emit("dm:set_active", { withUserId: peerId });
    else socket.emit("dm:set_active", { withUserId: null });
  }, []);

  const connectSocket = (token, options = {}) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = createSocket(token, options);
    socketRef.current = socket;
    setSocketApi(socket);

    socket.on("connect", () => {
      setIsConnected(true);
      setReconnectState("connected");
      transportFallbackStepRef.current = 0;
      setAuthError("");
      emitDmActive(socket, activeDmRef.current?.id ?? null);
      // Request friend list on connect/reconnect
      socket.emit("friend:list");
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      setReconnectState(reason === "io client disconnect" ? "idle" : "disconnected");
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      setReconnectState("reconnecting");
      setAuthError(`Reconnecting… attempt ${attempt}`);
    });

    socket.io.on("reconnect", () => {
      setReconnectState("connected");
      setAuthError("");
      emitDmActive(socket, activeDmRef.current?.id ?? null);
    });

    socket.io.on("reconnect_failed", () => {
      setAuthError("Socket reconnect failed. Check backend URL and CORS.");
    });

    socket.on("connect_error", (error) => {
      setIsConnected(false);
      const msg = error?.message || "Socket authentication failed";
      if (transportFallbackStepRef.current === 0) {
        transportFallbackStepRef.current = 1;
        setAuthError("Connection retry: switching to polling-first…");
        connectSocket(token, { transports: ["polling", "websocket"] });
        return;
      }
      if (transportFallbackStepRef.current === 1) {
        transportFallbackStepRef.current = 2;
        setAuthError("Connection retry: switching to polling-only…");
        connectSocket(token, { transports: ["polling"] });
        return;
      }
      if (msg.toLowerCase().includes("xhr poll error") || msg.toLowerCase().includes("authentication failed") || msg.toLowerCase().includes("authentication required")) {
        clearToken(); clearUser(); setMe(null); socket.disconnect();
      }
      if (msg.toLowerCase().includes("xhr poll error")) {
        setAuthError("Socket connection failed. Check backend deploy status, backend URL, and CORS settings.");
        return;
      }
      setAuthError(msg);
    });

    socket.on("connected", (payload) => {
      // Don't override me from socket connected, use the me from /auth/me which has is_admin
      if (payload?.user) { setUser(payload.user); }
      // Request friend list and groups on connection
      socket.emit("friend:list");
      getMyGroups().then(setMyGroups).catch(console.error);
    });

    socket.on("sync:state", (state) => {
      if (state?.dmUnreadByPeer && typeof state.dmUnreadByPeer === "object") setDmUnread({ ...state.dmUnreadByPeer });
      if (Array.isArray(state?.notifications)) setNotifications(state.notifications);
    });

    socket.on("typing:update", (payload = {}) => {
      const { context, fromUser, typing } = payload;
      if (!fromUser?.id || fromUser.id === myIdRef.current) return;
      if (context === "dm") {
        const peer = activeDmRef.current;
        if (!peer || peer.id !== fromUser.id) {
          if (!typing) setTypingDmUser((cur) => (cur?.id === fromUser.id ? null : cur));
          return;
        }
        setTypingDmUser(typing ? fromUser : null);
      }
    });

    socket.on("users:update", (users) => {
      const newUsers = users ?? [];
      const prevIds = new Set(prevOnlineUsersRef.current.map((u) => u.id));
      const friendsSet = new Set(friends.map((f) => f.id));

      // Check if any friends just came online
      const newOnlineFriends = (newUsers || []).filter(
        (u) => !prevIds.has(u.id) && friendsSet.has(u.id) && u.id !== myIdRef.current
      );
      
      if (newOnlineFriends.length > 0) {
        // Play notification sound for friends coming online (use notification type)
        audioManager.play("notification");
        // Send notification for first friend coming online
        if (newOnlineFriends[0]) {
          notificationService.friendOnline({ username: newOnlineFriends[0].username });
        }
      }
      
      prevOnlineUsersRef.current = newUsers;
      setOnlineUsers(newUsers);
    });

    socket.on("friend:list", (list) => setFriends(list ?? []));
    socket.on("friend:requests", (list) => setFriendRequests(list ?? []));
    socket.on("friend:request:incoming", ({ from }) => {
      if (!from) return;
      setFriendRequests((prev) => prev.some((req) => req.id === from.id) ? prev : [...prev, from]);
      // Notification for incoming friend request
      notificationService.friendRequest({ from: from.username, fromId: from.id });
    });
    socket.on("friend:accepted", () => { socket.emit("friend:list"); });
    socket.on("friend:error", ({ message } = {}) => {
      setFriendNotice(message || "Friend action failed.");
      setTimeout(() => setFriendNotice(""), 4000);
    });
    socket.on("friend:request:sent", ({ to } = {}) => {
      setFriendNotice(to ? `Request sent to ${to}` : "Request sent.");
      setTimeout(() => setFriendNotice(""), 3000);
    });

    socket.on("dm:history", ({ withUserId, messages }) => {
      if (!withUserId) return;
      setDmByUserId((prev) => ({ ...prev, [withUserId]: messages ?? [] }));
      setDmHasMore((messages?.length ?? 0) >= 50);
    });

    socket.on("dm:page", ({ withUserId, messages, hasMore } = {}) => {
      setLoadingOlderDm(false);
      if (!withUserId || !Array.isArray(messages)) return;
      setDmByUserId((prev) => {
        const cur = prev[withUserId] ?? [];
        return { ...prev, [withUserId]: mergeById(cur, messages) };
      });
      setDmHasMore(!!hasMore);
    });

    socket.on("dm:message", (message) => {
      const convWith = message?.convWith;
      if (!convWith) return;
      setDmByUserId((prev) => {
        const cur = prev[convWith] ?? [];
        // Replace any temp/sending message from same sender with same text
        const isSelf = message.from?.id === me?.id;
        const replaced = isSelf
          ? cur.map((m) => (m.sending && m.text === message.text ? message : m))
          : cur;
        const alreadyExists = replaced.some((m) => m.id === message.id);
        if (alreadyExists) return { ...prev, [convWith]: replaced };
        return { ...prev, [convWith]: [...replaced, message] };
      });
      // Only notify for messages from others (not self)
      const currentUserId = me?.id;
      const isFromOther = message.from?.id && message.from.id !== currentUserId;
      if (isFromOther) {
        socket.emit("dm:delivered", { msgId: message.id, fromUserId: message.from.id });
        // Play notification sound for new message (not from active conversation to avoid spam)
        if (activeDmRef.current?.id !== convWith) {
          audioManager.play("message");
          // Send native notification
          notificationService.newMessage({
            from: message.from?.username || 'Birisi',
            text: message.text || '',
            preview: message.text?.substring(0, 100),
            conversationId: convWith
          });
        }
      }
    });

    socket.on("dm:message:update", ({ msgId, convWith, deliveredAt } = {}) => {
      if (!msgId || !convWith) return;
      setDmByUserId((prev) => {
        const cur = prev[convWith];
        if (!cur) return prev;
        return { ...prev, [convWith]: cur.map((m) => m.id === msgId ? { ...m, deliveredAt: deliveredAt ?? m.deliveredAt } : m) };
      });
    });

    socket.on("dm:unread:sync", ({ peerId, count } = {}) => {
      if (!peerId) return;
      setDmUnread((prev) => { const n = { ...prev }; if (count === 0) delete n[peerId]; else n[peerId] = count; return n; });
    });

    socket.on("dm:peer_read", ({ peerId, at } = {}) => {
      if (!peerId) return;
      setDmByUserId((prev) => {
        const cur = prev[peerId];
        if (!cur) return prev;
        const selfId = myIdRef.current;
        return { ...prev, [peerId]: cur.map((m) => m.from?.id === selfId && m.to?.id === peerId ? { ...m, readAt: m.readAt || at } : m) };
      });
    });

    socket.on("notification:new", ({ notification } = {}) => {
      if (!notification) return;
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
    });

    socket.on("notifications:sync", ({ notifications: list } = {}) => {
      if (Array.isArray(list)) setNotifications(list);
    });

    socket.on("chat:error", ({ message } = {}) => {
      setFriendNotice(message || "Chat error.");
      setTimeout(() => setFriendNotice(""), 5000);
    });

    socket.on("server:announcement", ({ text } = {}) => {
      setFriendNotice(`Server: ${text || ""}`);
      setTimeout(() => setFriendNotice(""), 8000);
    });

    socket.on("system:kick", () => { clearToken(); clearUser(); setMe(null); socket.disconnect(); });
    socket.on("system:maintenance", () => { clearToken(); clearUser(); setMe(null); socket.disconnect(); });

    socket.on("screen:share-start", ({ fromUserId } = {}) => {
      if (fromUserId === activeDmRef.current?.id) setPeerScreenSharing(true);
    });
    socket.on("screen:share-stop", ({ fromUserId } = {}) => {
      if (fromUserId === activeDmRef.current?.id) setPeerScreenSharing(false);
    });

    socket.connect();
  };

  const handleLogin = async (payload) => {
    try {
      setAuthLoading(true);
      setAuthError("");
      await verifyBackendEndpoint();
      const data = await login(payload);
      transportFallbackStepRef.current = 0;
      setToken(data.token);
      setUser(data.user);
      setMe(data.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (payload) => {
    try {
      setAuthLoading(true);
      setAuthError("");
      await register(payload);
      await handleLogin(payload);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    call.cleanup();
    socketRef.current?.emit("dm:set_active", { withUserId: null });
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocketApi(null);
    clearToken(); clearUser(); setMe(null);
    setIsConnected(false); setOnlineUsers([]); setFriends([]); setFriendRequests([]);
    setDmByUserId({}); setDmUnread({}); setNotifications([]);
    setActiveDmUser(null); setAuthError(""); setTypingDmUser(null); setDmHasMore(true);
    setMyGroups([]);
  };

  const fetchGroups = useCallback(async () => {
    try {
      const raw = await getMyGroups();
      const groups = normalizeGroups(raw);
      setMyGroups(groups);
    } catch (err) {
      setMyGroups([]);
    }
  }, []);

  useEffect(() => {
    if (me?.id) {
      fetchGroups();
    }
  }, [me?.id, fetchGroups]);

  const handleOpenDm = (friend) => {
    if (!friend || !friend.id) {
      // Close DM (null friend)
      setActiveDmUser(null);
      socketRef.current?.emit("dm:set_active", { withUserId: null });
      return;
    }
    setActiveDmUser(friend);
    setDmUnread((u) => { const n = { ...u }; delete n[friend.id]; return n; });
    socketRef.current?.emit("dm:mark_read", { withUserId: friend.id });
    socketRef.current?.emit("dm:history", { withUserId: friend.id });
    socketRef.current?.emit("dm:set_active", { withUserId: friend.id });
  };

  const handleSendDm = (toUserId, text) => {
    socketRef.current?.emit("dm:send", { toUserId, text });
  };

  const handleSendDmMedia = (toUserId, mediaInfo) => {
    socketRef.current?.emit("dm:send", {
      toUserId,
      text: "",
      mediaUrl: mediaInfo.url,
      mediaType: mediaInfo.mediaType,
      mimeType: mediaInfo.mimeType,
      size: mediaInfo.size,
      originalName: mediaInfo.originalName,
    });
  };

  const handleSendFriendRequest = (toUsername) => {
    socketRef.current?.emit("friend:request", { toUsername });
  };

  const handleAcceptFriend = (fromUserId) => {
    socketRef.current?.emit("friend:accept", { fromUserId });
  };

  const handleDeclineFriend = (fromUserId) => {
    socketRef.current?.emit("friend:decline", { fromUserId });
  };

  const handleRemoveFriend = (friendId) => {
    socketRef.current?.emit("friend:remove", { friendId });
    setActiveDmUser((cur) => (cur?.id === friendId ? null : cur));
    setDmByUserId((prev) => { const n = { ...prev }; delete n[friendId]; return n; });
  };

  const handleStatusChange = (status) => {
    setMyStatus(status);
    socketRef.current?.emit("status:set", { status });
  };

  const emitTypingDmStart = (toUserId) => {
    socketRef.current?.emit("typing:start", { context: "dm", toUserId });
  };
  const emitTypingDmStop = (toUserId) => {
    socketRef.current?.emit("typing:stop", { context: "dm", toUserId });
  };

  const loadOlderDm = () => {
    const s = socketRef.current;
    const peer = activeDmUser;
    if (!s || !peer || loadingOlderDm || !dmHasMore) return;
    const list = dmByUserId[peer.id] ?? [];
    const oldest = list[0]?.timestamp;
    if (!oldest) return;
    setLoadingOlderDm(true);
    s.emit("dm:fetch", { withUserId: peer.id, before: oldest, limit: 50 });
  };

  const handleNotificationRead = (id) => {
    socketRef.current?.emit("notification:read", { id });
  };

  const handleNotificationReadAll = () => {
    socketRef.current?.emit("notification:read_all");
  };

  const connectionLabel = useMemo(() => {
    if (!isConnected) {
      if (reconnectState === "reconnecting") return "Reconnecting…";
      return "Offline";
    }
    return "Online";
  }, [isConnected, reconnectState]);

  if (!sessionChecked) return <div className="session-boot" aria-busy="true" />;

  // Show download page for all non-logged-in users
  if (!me) {
    return (
      <DownloadPage 
        onLogin={handleLogin}
        onRegister={handleRegister}
        authLoading={authLoading}
        authError={authError}
      />
    );
  }

  return (
    <div className="app-container">
        {(me?.is_admin || me?.username === "admin") && adminOpen && (
          <AdminPanel socket={socketApi} onClose={() => setAdminOpen(false)} onAdminChanged={() => setAdminChanged(true)} />
        )}
        
        {/* NEW MODULAR LAYOUT SYSTEM */}
        <AppLayout
          me={me}
          socket={socketApi}
          onLogout={handleLogout}
          activeDmUser={activeDmUser}
          activeGroup={activeGroup}
          groups={myGroups}
          dms={friends}
          friends={friends}
          onlineUsers={onlineUsers}
          onAdminClick={() => setAdminOpen(true)}
          isAdmin={me?.is_admin || me?.username === "admin"}
          onDmSelect={(dm) => {
            setActiveDmUser(dm);
            setActiveGroup(null);
          }}
          onGroupSelect={(group) => {
            setActiveDmUser(null);
            setActiveGroup(group);
          }}
          friendNotice={friendNotice}
          onRefreshGroups={fetchGroups}
          onSendMessage={(msg) => {
            if (activeDmUser) {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              const optimisticMessage = {
                id: tempId,
                from: { id: me?.id, username: me?.username },
                to: { id: activeDmUser.id },
                text: msg,
                timestamp: new Date().toISOString(),
                sending: true,
              };
              setDmByUserId((prev) => ({
                ...prev,
                [activeDmUser.id]: [...(prev[activeDmUser.id] ?? []), optimisticMessage],
              }));
              socketRef.current?.emit("dm:send", { toUserId: activeDmUser.id, text: msg });
            } else if (activeGroup) {
              socketRef.current?.emit("group:message", { groupId: activeGroup.id, content: msg });
            }
          }}
          onVoiceCall={() => {
            if (activeDmUser && call?.startCall) {
              call.startCall(activeDmUser, "voice");
            }
          }}
          onVideoCall={() => {
            if (activeDmUser && call?.startCall) {
              call.startCall(activeDmUser, "video");
            }
          }}
          onGroupVoiceCall={() => {
            if (activeGroup && groupCall?.startGroupCall) {
              groupCall.startGroupCall(activeGroup.id, "voice");
            }
          }}
          onGroupVideoCall={() => {
            if (activeGroup && groupCall?.startGroupCall) {
              groupCall.startGroupCall(activeGroup.id, "video");
            }
          }}
        >
          <MessageList messages={dmMessages} currentUser={me} />
        </AppLayout>
        <CallOverlay call={call} groupCall={groupCall} />
      </div>
  );
}
