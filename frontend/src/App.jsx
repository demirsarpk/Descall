import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthView from "./components/AuthView";
import AppLayout from "./components/layout/AppLayout";
import DownloadPage from "./components/download/DownloadPage";
import { getMe, login, loginWithGoogle, register } from "./api/auth";
import { getMyGroups, getGroupMessages } from "./api/groups";
import {
  getMyGuilds,
  createGuild,
  joinGuildByInvite,
  leaveGuild,
  deleteGuild,
} from "./api/guilds";
import { createSocket } from "./socket";
import { API_BASE_URL } from "./config/api";
import { preloadIceServers } from "./lib/iceConfig";
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
import {
  normalizeUser,
  patchUserInList,
  patchDmMessagesAvatar,
  patchGroupMessagesAvatar,
  resolveDisplayName,
} from "./lib/userProfile";
import audioManager, { initAudioManager } from "./lib/audioManager";
import notificationService from "./lib/notificationService";
import { useToast } from "./context/ToastContext";
import AdminPanel from "./components/admin/AdminPanel";
import TitleBar from "./components/TitleBar";
import MessageList from "./components/chat/MessageList";
import MessageComposer from "./components/chat/MessageComposer";
import CallOverlay from "./components/CallOverlay";
import GroupCallIncomingModal from "./components/GroupCallIncomingModal";

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

function normalizeGroupMessage(m) {
  if (!m) return null;

  // Persisted / API call summaries (message_type or type, content JSON or summary obj)
  const isCallSummary =
    m.message_type === "call_summary" ||
    m.type === "call_summary" ||
    (typeof m.content === "string" && m.content.includes('"call_summary"')) ||
    (typeof m.text === "string" && m.text.includes('"call_summary"'));

  if (isCallSummary) {
    let summary = m.summary;
    if (!summary) {
      const raw = typeof m.content === "string" ? m.content : typeof m.text === "string" ? m.text : null;
      if (raw) {
        try {
          summary = JSON.parse(raw);
        } catch {
          summary = null;
        }
      } else if (m.content && typeof m.content === "object") {
        summary = m.content;
      }
    }
    if (summary && (summary.type === "call_summary" || summary.callType || summary.durationSeconds !== undefined)) {
      return {
        ...summary,
        id: summary.id || m.id,
        timestamp: m.created_at || summary.endedAt || m.timestamp || new Date().toISOString(),
        type: "call_summary",
      };
    }
  }

  if (m.sender_id === "game-bot" || m.message_type?.startsWith?.("game_")) {
    return {
      id: m.id,
      from: { id: "game-bot", username: "🎰 Casino Bot", avatarUrl: null },
      text: m.content || "",
      timestamp: m.created_at || new Date().toISOString(),
      type: m.message_type || "game_message",
      isGameMessage: true,
      gameData: null,
      groupId: m.group_id,
    };
  }
  const sender = normalizeUser(m.sender || {
    id: m.sender?.id || m.sender_id,
    username: m.sender?.username || "Unknown",
    display_name: m.sender?.display_name || m.sender?.displayName,
    avatar_url: m.sender?.avatar_url,
    updated_at: m.sender?.updated_at,
  });
  return {
    id: m.id,
    from: sender,
    username: sender?.username || "Unknown",
    displayName: sender?.displayName || null,
    avatarUrl: sender?.avatarUrl,
    text: m.content || "",
    timestamp: m.created_at || new Date().toISOString(),
    mediaUrl: m.media_url,
    mediaType: m.media_type,
    originalName: m.original_name,
    size: m.file_size,
    reactions: Array.isArray(m.reactions) ? m.reactions : [],
    replyTo: m.replyTo || m.reply_to || null,
  };
}

async function fetchConversationReactions(type, conversationId) {
  if (!type || !conversationId) return {};
  try {
    const token = getToken();
    const res = await fetch(
      `${API_BASE_URL}/api/reactions/conversation/${encodeURIComponent(type)}/${encodeURIComponent(conversationId)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) return {};
    const data = await res.json();
    return data?.reactions && typeof data.reactions === "object" ? data.reactions : {};
  } catch {
    return {};
  }
}

function mergeReactionsIntoMessages(messages, reactionsByMessageId) {
  if (!Array.isArray(messages) || !reactionsByMessageId) return messages;
  return messages.map((m) => {
    const list = reactionsByMessageId[m.id];
    if (!list) return m;
    return { ...m, reactions: list };
  });
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(false);
  const { toast } = useToast();
  const [authError, setAuthError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [me, setMe] = useState(() => normalizeUser(getUser()));
  const [isConnected, setIsConnected] = useState(false);
  const [myStatus, setMyStatus] = useState(() => {
    try {
      const saved = localStorage.getItem("descall:myStatus");
      if (["online", "idle", "dnd", "invisible"].includes(saved)) return saved;
    } catch {}
    return "online";
  });
  const [replyTo, setReplyTo] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [dmByUserId, setDmByUserId] = useState({});
  const [dmUnread, setDmUnread] = useState({});
  const [groupUnread, setGroupUnread] = useState({});
  const [dmLastActivity, setDmLastActivity] = useState({});
  const [groupLastActivity, setGroupLastActivity] = useState({});
  const [dmPreviews, setDmPreviews] = useState({});
  const [groupPreviews, setGroupPreviews] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadMarker, setUnreadMarker] = useState(null); // { key, count }
  const [friendNotice, setFriendNotice] = useState("");
  const [notifPermission, setNotifPermission] = useState(() => notificationService.getPermissionState());
  const [socketApi, setSocketApi] = useState(null);
  const [typingDmUser, setTypingDmUser] = useState(null);
  // groupId -> Map<userId, {id, username}>
  const [typingGroupUsers, setTypingGroupUsers] = useState({});
  const [dmHasMore, setDmHasMore] = useState(true);
  const [loadingOlderDm, setLoadingOlderDm] = useState(false);
  const [reconnectState, setReconnectState] = useState("idle");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminChanged, setAdminChanged] = useState(false);
  const [peerScreenSharing, setPeerScreenSharing] = useState(false);
  const [myGroups, setMyGroups] = useState([]);
  const [groupMessagesById, setGroupMessagesById] = useState({});
  // Electron silent auto-update state: null | 'downloading' | 'installing'
  const [updateState, setUpdateState] = useState(null);
  const [updateVersion, setUpdateVersion] = useState(null);
  // Guild/Server system state
  const [myGuilds, setMyGuilds] = useState([]);
  const [activeGuild, setActiveGuild] = useState(null);
  const [activeGuildChannel, setActiveGuildChannel] = useState(null);

  const socketRef = useRef(null);
  const activeDmRef = useRef(null);
  const activeGroupRef = useRef(null);
  const myIdRef = useRef(null);
  const myGroupsRef = useRef([]);
  const myGuildsRef = useRef([]);
  const friendsRef = useRef([]);
  const myStatusRef = useRef(myStatus);
  const transportFallbackStepRef = useRef(0);
  const prevOnlineUsersRef = useRef([]);
  const activeGuildRef = useRef(null);
  const typingDmTimeoutRef = useRef(null);
  const typingGroupTimeoutsRef = useRef(new Map());
  const call = useCall(socketApi);
  const groupCall = useGroupCall(socketApi, me?.id);

  useEffect(() => {
    preloadIceServers().catch(() => {});
  }, []);

  useEffect(() => {
    myIdRef.current = me?.id ?? null;
  }, [me?.id]);

  useEffect(() => {
    friendsRef.current = Array.isArray(friends) ? friends : [];
  }, [friends]);

  useEffect(() => {
    myStatusRef.current = myStatus;
  }, [myStatus]);

  const isDnd = useCallback(() => myStatusRef.current === "dnd", []);

  const playUiSound = useCallback((name) => {
    // Match notificationService: mute social/message sounds under DND
    if (myStatusRef.current === "dnd" && name !== "incomingCall" && name !== "outgoingCall") {
      return;
    }
    audioManager.play(name);
  }, []);

  useEffect(() => {
    activeDmRef.current = activeDmUser;
  }, [activeDmUser]);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  useEffect(() => {
    myGroupsRef.current = myGroups;
  }, [myGroups]);

  useEffect(() => {
    myGuildsRef.current = myGuilds;
  }, [myGuilds]);

  useEffect(() => {
    activeGuildRef.current = activeGuild;
  }, [activeGuild]);

  const commitSessionUser = useCallback((user) => {
    const normalized = normalizeUser(user);
    setMe(normalized);
    if (normalized) setUser(normalized);
    else clearUser();
    return normalized;
  }, []);

  const applyProfileUpdate = useCallback((user) => {
    const normalized = normalizeUser(user);
    if (!normalized?.id) return;
    const { id } = normalized;
    const stored = getUser();
    const existingSelf = me?.id === id ? me : stored?.id === id ? stored : null;
    // Prefer incoming avatar, but never clear a known photo with an empty patch.
    const avatarUrl =
      normalized.avatarUrl ||
      normalized.avatar_url ||
      existingSelf?.avatarUrl ||
      existingSelf?.avatar_url ||
      null;

    const patch = {
      avatarUrl,
      avatar_url: avatarUrl,
      displayName: normalized.displayName,
      display_name: normalized.displayName,
      bio: normalized.bio,
      customStatus: normalized.customStatus,
      bannerUrl: normalized.bannerUrl,
      avatarVersion: normalized.avatarVersion,
      updated_at: normalized.updated_at,
    };

    if (me?.id === id || stored?.id === id) {
      commitSessionUser({
        ...existingSelf,
        ...normalized,
        avatarUrl,
        avatar_url: avatarUrl,
        displayName: normalized.displayName,
        display_name: normalized.displayName,
      });
    }

    setFriends((prev) => patchUserInList(prev, id, patch));
    setFriendRequests((prev) => patchUserInList(prev, id, patch));
    setOnlineUsers((prev) => patchUserInList(prev, id, patch));
    setActiveDmUser((prev) => {
      if (prev?.id !== id) return prev;
      return normalizeUser({ ...prev, ...patch });
    });
    setNotifications((prev) => prev.map((n) => {
      const fromId = n.meta?.fromUserId || n.meta?.userId || n.fromUserId;
      if (fromId !== id) return n;
      return {
        ...n,
        avatarUrl: avatarUrl || n.avatarUrl,
        avatar_url: avatarUrl || n.avatar_url,
        displayName: normalized.displayName || n.displayName,
      };
    }));
    setDmByUserId((prev) => patchDmMessagesAvatar(prev, id, patch));
    setGroupMessagesById((prev) => patchGroupMessagesAvatar(prev, id, patch));
  }, [commitSessionUser, me]);

  useEffect(() => {
    setTypingDmUser(null);
  }, [activeDmUser?.id]);

  useEffect(() => {
    if (!activeDmUser?.id || !socketRef.current) return;
    const cached = dmByUserId[activeDmUser.id];
    if (!cached) setMessagesLoading(true);
    socketRef.current.emit("dm:history", { withUserId: activeDmUser.id });
  }, [activeDmUser?.id]);

  const dmMessages = useMemo(() => {
    if (activeGroup) {
      const msgs = groupMessagesById[activeGroup.id] ?? [];
      // call_summary items are already persisted to DB and loaded into msgs —
      // do NOT merge in-memory callSummaries to avoid duplicates.
      // Only inject the live active-call banner (not yet in DB).
      const banner = groupCall?.activeCallBanner;
      const activeBannerItem = (banner?.groupId === activeGroup.id && banner?.startTime)
        ? [{ ...banner, id: `active-call-${banner.groupId}`, type: "active_call", timestamp: new Date(banner.startTime).toISOString() }]
        : [];
      const merged = activeBannerItem.length > 0 ? [...msgs, ...activeBannerItem] : [...msgs];
      return merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }
    if (activeDmUser) return dmByUserId[activeDmUser.id] ?? [];
    return [];
  }, [activeDmUser, activeGroup, dmByUserId, groupMessagesById, groupCall?.activeCallBanner]);

  useEffect(() => {
    const token = getToken();
    const bootStatus = document.getElementById("boot-status");
    if (!token) {
      if (bootStatus) bootStatus.textContent = "Almost ready";
      setSessionChecked(true);
      return;
    }
    if (bootStatus) bootStatus.textContent = "Signing in";
    let cancelled = false;
    (async () => {
      try {
        const { user } = await getMe(token);
        if (!cancelled) {
          commitSessionUser(user);
          if (bootStatus) bootStatus.textContent = "Welcome back";
        }
      } catch (err) {
        if (!cancelled) {
          clearToken();
          clearUser();
          setMe(null);
          if (bootStatus) bootStatus.textContent = "Almost ready";
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
    notificationService.init().catch(() => {});
    setNotifPermission(notificationService.getPermissionState());
    return () => { audioManager.destroy(); };
  }, []);

  // Electron silent auto-update banner
  useEffect(() => {
    if (!window.electronAPI?.onUpdateDownloading) return;
    const unsubDownloading = window.electronAPI.onUpdateDownloading(({ version }) => {
      setUpdateVersion(version);
      setUpdateState('downloading');
    });
    const unsubInstalling = window.electronAPI.onUpdateInstalling
      ? window.electronAPI.onUpdateInstalling(({ version }) => {
          setUpdateVersion(version);
          setUpdateState('installing');
        })
      : () => {};
    return () => { unsubDownloading?.(); unsubInstalling?.(); };
  }, []);

  const handleRequestNotifPermission = async () => {
    const result = await notificationService.requestPermission();
    setNotifPermission(result);
  };

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
          commitSessionUser(user);
        } catch {
          // Ignore error
        }
      })();
    };
    
    socketApi.on("user:updated", handleUserUpdated);
    socketApi.on("user:profile:updated", ({ user }) => {
      if (user) applyProfileUpdate(user);
    });
    return () => {
      socketApi.off("user:updated", handleUserUpdated);
      socketApi.off("user:profile:updated");
    };
  }, [socketApi, commitSessionUser, applyProfileUpdate]);

  // Refresh me when admin panel closes with changes
  useEffect(() => {
    if (!adminChanged) return;
    const token = getToken();
    if (!token) return;
    (async () => {
      try {
        const { user } = await getMe(token);
        commitSessionUser(user);
      } catch {
        // Ignore error
      } finally {
        setAdminChanged(false);
      }
    })();
  }, [adminChanged, commitSessionUser]);

  // Refresh user data from backend
  const refreshMe = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const { user } = await getMe(token);
      commitSessionUser(user);
      return user;
    } catch (err) {
    }
  }, []);

  const verifyBackendEndpoint = async () => {
    try {
      // Any HTTP response means the URL resolves — Render may return 503 during cold start.
      // Only a network-level failure (fetch throws) means the URL is wrong.
      await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      return true;
    } catch {
      throw new Error(`Cannot reach backend (${API_BASE_URL}). Check your network or VITE_API_BASE_URL setting.`);
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

    const rejoinGroups = () => {
      const ids = myGroupsRef.current.map((g) => g.id).filter(Boolean);
      if (ids.length > 0) socket.emit("groups:rejoin", ids);
    };

    socket.on("connect", () => {
      setIsConnected(true);
      setReconnectState("connected");
      transportFallbackStepRef.current = 0;
      setAuthError("");
      emitDmActive(socket, activeDmRef.current?.id ?? null);
      rejoinGroups();
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
      rejoinGroups();
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
      if (payload?.user) {
        // Merge — never let a thin socket payload wipe displayName / bio / banner.
        commitSessionUser({ ...(getUser() || me || {}), ...payload.user });
      }
      getMyGroups().then((raw) => {
        const groups = normalizeGroups(raw);
        setMyGroups(groups);
        // Rejoin after groups load — connect-time rejoin often runs with empty list.
        const ids = groups.map((g) => g.id).filter(Boolean);
        if (ids.length > 0 && socket.connected) {
          socket.emit("groups:rejoin", ids);
        }
      }).catch(console.error);
      getMyGuilds().then((data) => {
        setMyGuilds(data?.guilds || []);
        const guildIds = (data?.guilds || []).map((g) => g.id);
        if (guildIds.length > 0) {
          socket.emit("guilds:subscribe", guildIds);
        }
      }).catch(console.error);
    });

    socket.on("status:current", ({ status } = {}) => {
      if (!["online", "idle", "dnd", "invisible"].includes(status)) return;
      setMyStatus(status);
      try { localStorage.setItem("descall:myStatus", status); } catch {}
    });

    socket.on("sync:state", (state) => {
      if (state?.dmUnreadByPeer && typeof state.dmUnreadByPeer === "object") setDmUnread({ ...state.dmUnreadByPeer });
      if (Array.isArray(state?.notifications)) setNotifications(state.notifications);
    });

    socket.on("typing:update", (payload = {}) => {
      const { context, fromUser, typing, groupId } = payload;
      if (!fromUser?.id || fromUser.id === myIdRef.current) return;
      if (context === "dm") {
        const peer = activeDmRef.current;
        if (!peer || peer.id !== fromUser.id) {
          if (!typing) setTypingDmUser((cur) => (cur?.id === fromUser.id ? null : cur));
          return;
        }
        setTypingDmUser(typing ? fromUser : null);
        // Auto-clear stuck typing if peer disconnects without typing:stop
        if (typingDmTimeoutRef.current) clearTimeout(typingDmTimeoutRef.current);
        if (typing) {
          typingDmTimeoutRef.current = setTimeout(() => {
            setTypingDmUser((cur) => (cur?.id === fromUser.id ? null : cur));
          }, 3500);
        }
      } else if (context === "group" && groupId) {
        setTypingGroupUsers((prev) => {
          const groupMap = new Map(prev[groupId] ?? []);
          if (typing) {
            groupMap.set(fromUser.id, fromUser);
          } else {
            groupMap.delete(fromUser.id);
          }
          return { ...prev, [groupId]: groupMap };
        });
        const key = `${groupId}:${fromUser.id}`;
        if (typingGroupTimeoutsRef.current.has(key)) {
          clearTimeout(typingGroupTimeoutsRef.current.get(key));
          typingGroupTimeoutsRef.current.delete(key);
        }
        if (typing) {
          const t = setTimeout(() => {
            setTypingGroupUsers((prev) => {
              const groupMap = new Map(prev[groupId] ?? []);
              groupMap.delete(fromUser.id);
              return { ...prev, [groupId]: groupMap };
            });
            typingGroupTimeoutsRef.current.delete(key);
          }, 3500);
          typingGroupTimeoutsRef.current.set(key, t);
        }
      }
    });

    socket.on("users:update", (users) => {
      const newUsers = (users ?? []).map((u) => normalizeUser(u));
      const prevIds = new Set(prevOnlineUsersRef.current.map((u) => u.id));
      const friendsSet = new Set((friendsRef.current || []).map((f) => f.id));

      // Check if any friends just came online (invisible never counts as online)
      const newOnlineFriends = (newUsers || []).filter((u) => {
        if (!u?.id || prevIds.has(u.id) || !friendsSet.has(u.id) || u.id === myIdRef.current) return false;
        const st = u.status || "online";
        return st === "online" || st === "idle" || st === "dnd";
      });

      if (newOnlineFriends.length > 0) {
        playUiSound("notification");
        if (newOnlineFriends[0]) {
          notificationService.friendOnline({ username: resolveDisplayName(newOnlineFriends[0]) });
        }
      }

      prevOnlineUsersRef.current = newUsers;
      setOnlineUsers(newUsers);
    });

    socket.on("friend:list", (list) => setFriends((list ?? []).map((u) => normalizeUser(u))));
    socket.on("friend:requests", (list) => setFriendRequests((list ?? []).map((u) => normalizeUser(u))));
    socket.on("friend:request:incoming", ({ from }) => {
      if (!from) return;
      const normalized = normalizeUser(from);
      setFriendRequests((prev) => prev.some((req) => req.id === normalized.id) ? prev : [...prev, normalized]);
      // Notification for incoming friend request
      notificationService.friendRequest({ from: from.username, fromId: from.id });
    });
    socket.on("friend:accepted", () => { socket.emit("friend:list"); });
    socket.on("user:profile:updated", ({ user }) => {
      if (user) applyProfileUpdate(user);
    });
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
      setMessagesLoading(false);
      setDmHasMore((messages?.length ?? 0) >= 50);
      const last = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null;
      if (last) {
        const ts = last.timestamp || last.created_at;
        if (ts) setDmLastActivity((prev) => {
          if (prev[withUserId] && new Date(prev[withUserId]) >= new Date(ts)) return prev;
          return { ...prev, [withUserId]: ts };
        });
        const previewText = last.text
          || (last.mediaType === "image" ? "📷 Photo" : last.mediaUrl ? "📎 Attachment" : "");
        if (previewText) setDmPreviews((p) => (p[withUserId] ? p : { ...p, [withUserId]: previewText }));
      }
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
      const ts = message.timestamp || new Date().toISOString();
      const previewText = message.text
        || (message.mediaType === "image" ? "📷 Photo" : message.mediaUrl ? "📎 Attachment" : "");
      setDmLastActivity((prev) => ({ ...prev, [convWith]: ts }));
      if (previewText) setDmPreviews((prev) => ({ ...prev, [convWith]: previewText }));

      setDmByUserId((prev) => {
        const cur = prev[convWith] ?? [];
        const isSelf = message.from?.id === myIdRef.current;
        // Replace optimistic (sending) message by tempId echo, or dedupe by real id
        if (isSelf && message.tempId) {
          const hasTemp = cur.some((m) => m.id === message.tempId);
          if (hasTemp) {
            return { ...prev, [convWith]: cur.map((m) => m.id === message.tempId ? { ...message, sending: false } : m) };
          }
        }
        const alreadyExists = cur.some((m) => m.id === message.id);
        if (alreadyExists) return prev;
        return { ...prev, [convWith]: [...cur, message] };
      });
      // Only notify for messages from others (not self)
      const currentUserId = myIdRef.current;
      const isFromOther = message.from?.id && message.from.id !== currentUserId;
      if (isFromOther) {
        socket.emit("dm:delivered", { msgId: message.id, fromUserId: message.from.id });
        // Local unread bump if not viewing this conversation (server also syncs)
        if (activeDmRef.current?.id !== convWith) {
          playUiSound("message");
          // Send native notification
          notificationService.newMessage({
            from: message.from?.username || 'Birisi',
            text: message.text || '',
            preview: message.text?.substring(0, 100),
            conversationId: convWith
          });
        } else {
          setDmUnread((prev) => {
            if (!prev[convWith]) return prev;
            const n = { ...prev };
            delete n[convWith];
            return n;
          });
          socket.emit("dm:mark_read", { withUserId: convWith });
        }
      }
    });

    // Add new group to list when invited or when you create one via socket broadcast
    socket.on("group:invited", ({ group } = {}) => {
      if (!group?.id) return;
      setMyGroups((prev) => prev.some((g) => g.id === group.id) ? prev : [...prev, group]);
    });

    // Group messages listener
    socket.on("group:message", ({ groupId, message, tempId }) => {
      if (!groupId || !message) return;

      const trimmedContent = (message.content || "").trim();
      const isGameCommand =
        Boolean(message.isGameCommand) ||
        (trimmedContent.startsWith("/") &&
          ["/bj", "/blackjack", "/hit", "/stand", "/stay", "/double", "/credits", "/bakiye", "/balance", "/top", "/lider", "/help", "/yardım", "/commands", "/jb"].some(
            (cmd) => trimmedContent.toLowerCase().startsWith(cmd)
          ));

      // Never insert /bj etc. as chat rows — casino UI uses game:* events
      if (isGameCommand) {
        if (tempId || message.id) {
          setGroupMessagesById((prev) => {
            const cur = prev[groupId] ?? [];
            return {
              ...prev,
              [groupId]: cur.filter(
                (m) =>
                  m.isGameMessage ||
                  (m.id !== tempId && m.id !== message.id)
              ),
            };
          });
        }
        return;
      }

      const sender = normalizeUser(message.sender || {
        id: message.sender_id,
        username: message.sender?.username || "Unknown",
        display_name: message.sender?.display_name || message.sender?.displayName,
        avatar_url: message.sender?.avatar_url,
        updated_at: message.sender?.updated_at,
      });
      const normalized = {
        id: message.id,
        from: sender,
        username: sender?.username || "Unknown",
        displayName: sender?.displayName || null,
        avatarUrl: sender?.avatarUrl,
        text: message.content || "",
        timestamp: message.created_at || new Date().toISOString(),
        mediaUrl: message.media_url,
        mediaType: message.media_type,
        originalName: message.original_name,
        size: message.file_size,
        replyTo: message.replyTo || message.reply_to || null,
      };
      setGroupMessagesById((prev) => {
        const cur = prev[groupId] ?? [];
        // Replace optimistic message by tempId, or dedupe by real id
        if (tempId && cur.some((m) => m.id === tempId)) {
          return { ...prev, [groupId]: cur.map((m) => m.id === tempId ? { ...normalized, sending: false } : m) };
        }
        if (cur.some((m) => m.id === normalized.id)) return prev;
        return { ...prev, [groupId]: [...cur, normalized] };
      });

      setGroupLastActivity((prev) => ({ ...prev, [groupId]: normalized.timestamp }));
      if (normalized.text) {
        const preview = `${normalized.from.username}: ${normalized.text}`;
        setGroupPreviews((prev) => ({ ...prev, [groupId]: preview.slice(0, 80) }));
      }

      // Notify for messages from others in non-active group
      const isFromMe = normalized.from.id === myIdRef.current;
      const isActiveGroup = activeGroupRef.current?.id === groupId;
      if (!isFromMe && !isActiveGroup) {
        setGroupUnread((prev) => ({ ...prev, [groupId]: (prev[groupId] || 0) + 1 }));
        playUiSound("message");
        const grp = myGroupsRef.current.find((g) => g.id === groupId);
        notificationService.groupMessage({
          groupName: grp?.name || "Grup",
          from: normalized.from.username,
          text: normalized.text,
          groupId,
        });
      }
    });

    // Clear optimistic "/bj …" without inserting a chat row
    socket.on("group:message:ack", ({ groupId, tempId, suppress } = {}) => {
      if (!groupId || !tempId || !suppress) return;
      setGroupMessagesById((prev) => {
        const cur = prev[groupId] ?? [];
        return { ...prev, [groupId]: cur.filter((m) => m.id !== tempId) };
      });
    });

    socket.on("mention:received", ({ groupId, dmConversationId, from, text, groupName }) => {
      notificationService.mention({ groupId, dmConversationId, from, text, groupName });
    });

    // Casino: one bubble per player (session id). Board never downgrades to lobby on stray clicks.
    const isCasinoBoard = (msg) => {
      const s = msg?.gameData?.status;
      return s === "playing" || s === "dealer" || s === "dealing" || s === "finished";
    };
    const isCasinoBoardIncoming = (message) =>
      isCasinoBoard(message) ||
      ["game_start", "game_update", "game_end"].includes(message?.type);

    const upsertGameMessage = (groupId, message) => {
      if (!groupId || !message) return;
      const handId = message.gameData?.id;
      const ownerId =
        message.sessionOwnerId ||
        message.gameData?.sessionOwnerId ||
        message.gameData?.userId ||
        null;
      const stableId = ownerId
        ? `casino-session-${ownerId}`
        : handId
          ? `casino-hand-${handId}`
          : message.id;
      const gameMessage = {
        id: stableId,
        from: message.sender || { id: "game-bot", username: "Casino" },
        text: message.content || "",
        type: message.type || "game_message",
        gameData: message.gameData ?? null,
        sessionOwnerId: ownerId,
        timestamp: message.timestamp || new Date().toISOString(),
        isGameMessage: true,
        groupId,
      };

      setGroupMessagesById((prev) => {
        const cur = prev[groupId] ?? [];
        const idx = cur.findIndex((m) => {
          if (m.id === stableId || m.id === message.id) return true;
          if (handId && m.gameData?.id === handId) return true;
          if (
            ownerId &&
            m.isGameMessage &&
            (m.sessionOwnerId === ownerId ||
              m.gameData?.userId === ownerId ||
              m.gameData?.sessionOwnerId === ownerId ||
              m.id === `casino-session-${ownerId}` ||
              (handId && m.id === `casino-hand-${handId}`))
          ) {
            return true;
          }
          return false;
        });
        if (idx >= 0) {
          const prevMsg = cur[idx];
          // Never interrupt a live hand with lobby/help (fixes board vanishing on click)
          const prevLive = ["playing", "dealer", "dealing"].includes(
            prevMsg?.gameData?.status
          );
          if (prevLive && !isCasinoBoardIncoming(message)) {
            return prev;
          }
          const next = cur.slice();
          next[idx] = {
            ...prevMsg,
            ...gameMessage,
            // Keep a single stable session id so Deal / Again never stacks menus
            id: ownerId ? `casino-session-${ownerId}` : prevMsg.id || stableId,
            gameData: message.gameData != null ? message.gameData : prevMsg.gameData,
            sessionOwnerId: ownerId || prevMsg.sessionOwnerId,
            isGameMessage: true,
          };
          return { ...prev, [groupId]: next };
        }
        return { ...prev, [groupId]: [...cur, gameMessage] };
      });
    };

    socket.on("game:message", ({ groupId, message }) => {
      upsertGameMessage(groupId, message);
    });

    socket.on("game:update", ({ groupId, message }) => {
      upsertGameMessage(groupId, message);
    });

    socket.on("game:notice", ({ text } = {}) => {
      if (!text) return;
      toast(text, "info");
    });

    socket.on("dm:message:update", ({ msgId, convWith, deliveredAt } = {}) => {
      if (!msgId || !convWith) return;
      setDmByUserId((prev) => {
        const cur = prev[convWith];
        if (!cur) return prev;
        return { ...prev, [convWith]: cur.map((m) => m.id === msgId ? { ...m, deliveredAt: deliveredAt ?? m.deliveredAt } : m) };
      });
    });

    socket.on("reaction:update", ({ messageId, emoji, userId, username, conversationType, conversationId, removed } = {}) => {
      if (!messageId || !emoji || !userId) return;

      const patchList = (list) => {
        if (!Array.isArray(list)) return list;
        let changed = false;
        const next = list.map((m) => {
          if (m.id !== messageId) return m;
          changed = true;
          const reactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
          if (removed) {
            return {
              ...m,
              reactions: reactions.filter((r) => !(r.emoji === emoji && r.userId === userId)),
            };
          }
          if (reactions.some((r) => r.emoji === emoji && r.userId === userId)) return m;
          return {
            ...m,
            reactions: [...reactions, { emoji, userId, username, messageId }],
          };
        });
        return changed ? next : list;
      };

      if (conversationType === "group" && conversationId) {
        setGroupMessagesById((prev) => {
          const cur = prev[conversationId];
          if (!cur) return prev;
          const next = patchList(cur);
          return next === cur ? prev : { ...prev, [conversationId]: next };
        });
        return;
      }

      // DM: conversationId is "a::b" — update the peer bucket
      const selfId = myIdRef.current;
      let peerId = null;
      if (typeof conversationId === "string" && conversationId.includes("::")) {
        peerId = conversationId.split("::").find((id) => id && id !== selfId) || null;
      } else if (conversationId && conversationId !== selfId) {
        peerId = conversationId;
      }

      setDmByUserId((prev) => {
        if (peerId && prev[peerId]) {
          const next = patchList(prev[peerId]);
          return next === prev[peerId] ? prev : { ...prev, [peerId]: next };
        }
        // Fallback: scan all DM threads for the message
        let any = false;
        const out = {};
        for (const [id, list] of Object.entries(prev)) {
          const next = patchList(list);
          out[id] = next;
          if (next !== list) any = true;
        }
        return any ? out : prev;
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

    socket.on("group:call:summary", ({ groupId, summary } = {}) => {
      if (!groupId || !summary) return;
      const item = {
        ...summary,
        id: summary.id || `call-summary-${Date.now()}`,
        timestamp: summary.endedAt ?? new Date().toISOString(),
        type: "call_summary",
      };
      setGroupMessagesById((prev) => {
        const cur = prev[groupId] ?? [];
        if (cur.some((m) => m.id === item.id)) return prev;
        return { ...prev, [groupId]: [...cur, item] };
      });
    });

    socket.on("screen:share-start", ({ fromUserId } = {}) => {
      if (fromUserId === activeDmRef.current?.id) setPeerScreenSharing(true);
    });
    socket.on("screen:share-stop", ({ fromUserId } = {}) => {
      if (fromUserId === activeDmRef.current?.id) setPeerScreenSharing(false);
    });

    // Guild socket events
    socket.on("guild:created", ({ guild } = {}) => {
      if (!guild?.id) return;
      setMyGuilds((prev) => prev.some((g) => g.id === guild.id) ? prev : [...prev, guild]);
      setActiveGuild(guild);
      setActiveGuildChannel(guild.channels?.[0] || null);
    });

    socket.on("guild:joined", ({ guild } = {}) => {
      if (!guild?.id) return;
      setMyGuilds((prev) => prev.some((g) => g.id === guild.id) ? prev : [...prev, guild]);
      setActiveGuild(guild);
      setActiveGuildChannel(guild.channels?.[0] || null);
    });

    socket.on("guild:deleted", ({ guildId } = {}) => {
      if (!guildId) return;
      setMyGuilds((prev) => prev.filter((g) => g.id !== guildId));
      if (activeGuildRef.current?.id === guildId) {
        setActiveGuild(null);
        setActiveGuildChannel(null);
      }
    });

    socket.on("guild:left", ({ guildId } = {}) => {
      if (!guildId) return;
      setMyGuilds((prev) => prev.filter((g) => g.id !== guildId));
      setActiveGuild((prev) => (prev?.id === guildId ? null : prev));
    });

    socket.on("guild:member:joined", ({ guildId, userId } = {}) => {
      if (!guildId || !userId) return;
      setMyGuilds((prev) =>
        prev.map((g) =>
          g.id === guildId
            ? { ...g, memberCount: (g.memberCount || 0) + 1 }
            : g
        )
      );
    });

    socket.on("guild:member:left", ({ guildId, userId } = {}) => {
      if (!guildId || !userId) return;
      setMyGuilds((prev) =>
        prev.map((g) =>
          g.id === guildId
            ? { ...g, memberCount: Math.max(0, (g.memberCount || 1) - 1) }
            : g
        )
      );
    });

    socket.on("guild:channel:created", ({ guildId, channel } = {}) => {
      if (!guildId || !channel) return;
      setMyGuilds((prev) =>
        prev.map((g) =>
          g.id === guildId
            ? { ...g, channels: [...(g.channels || []), channel] }
            : g
        )
      );
    });

    socket.on("guild:channel:deleted", ({ guildId, channelId } = {}) => {
      if (!guildId || !channelId) return;
      setMyGuilds((prev) =>
        prev.map((g) =>
          g.id === guildId
            ? { ...g, channels: (g.channels || []).filter((c) => c.id !== channelId) }
            : g
        )
      );
      setActiveGuildChannel((prev) => (prev?.id === channelId ? null : prev));
    });

    socket.on("guild:error", ({ message } = {}) => {
      setFriendNotice(message || "Guild error.");
      setTimeout(() => setFriendNotice(""), 5000);
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
      commitSessionUser(data.user);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async (credential) => {
    try {
      setAuthLoading(true);
      setAuthError("");
      await verifyBackendEndpoint();
      const data = await loginWithGoogle(credential);
      transportFallbackStepRef.current = 0;
      setToken(data.token);
      commitSessionUser(data.user);
    } catch (error) {
      setAuthError(error.message);
      throw error;
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
      throw error;
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
    setDmByUserId({}); setDmUnread({}); setGroupUnread({}); setDmLastActivity({}); setGroupLastActivity({}); setDmPreviews({}); setGroupPreviews({}); setNotifications([]);
    setActiveDmUser(null); setAuthError(""); setTypingDmUser(null); setDmHasMore(true);
    setMyGroups([]);
  };

  const fetchGroups = useCallback(async () => {
    try {
      const raw = await getMyGroups();
      const groups = normalizeGroups(raw);
      setMyGroups(groups);
      const ids = groups.map((g) => g.id).filter(Boolean);
      if (ids.length > 0 && socketRef.current?.connected) {
        socketRef.current.emit("groups:rejoin", ids);
      }
    } catch (err) {
      // Keep previous list — a transient API failure should not wipe the sidebar
      console.error("[groups] fetch failed", err);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected) return;

    // 1. Groups
    fetchGroups();

    // 2. Friends & global state
    s.emit("friend:list");
    s.emit("sync:state");

    // 3. Active DM
    const dmPeer = activeDmRef.current;
    if (dmPeer) {
      s.emit("dm:history", { withUserId: dmPeer.id });
      s.emit("dm:unread:sync");
    }

    // 4. Active group messages
    const grp = activeGroupRef.current;
    if (grp?.id) {
      s.emit("group:join", grp.id);
      getGroupMessages(grp.id)
        .then(async (res) => {
          const msgs = Array.isArray(res?.messages) ? res.messages : Array.isArray(res) ? res : [];
          let normalized = msgs.map(normalizeGroupMessage).filter(Boolean);
          const rx = await fetchConversationReactions("group", grp.id);
          normalized = mergeReactionsIntoMessages(normalized, rx);
          setGroupMessagesById((prev) => ({ ...prev, [grp.id]: normalized }));
        })
        .catch(console.error);
    }
  }, [fetchGroups]);

  // Periodic background refresh every 30s when tab is visible
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") handleRefresh();
    }, 30000);
    return () => clearInterval(id);
  }, [handleRefresh]);

  // Fetch group messages when activeGroup changes
  useEffect(() => {
    if (!activeGroup?.id) return;
    if (groupMessagesById[activeGroup.id]) {
      setMessagesLoading(false);
      return;
    }
    setMessagesLoading(true);
    getGroupMessages(activeGroup.id)
      .then(async (res) => {
        const msgs = Array.isArray(res?.messages) ? res.messages : Array.isArray(res) ? res : [];
        let normalized = msgs.map(normalizeGroupMessage).filter(Boolean);
        const rx = await fetchConversationReactions("group", activeGroup.id);
        normalized = mergeReactionsIntoMessages(normalized, rx);
        setGroupMessagesById((prev) => ({ ...prev, [activeGroup.id]: normalized }));
      })
      .catch((err) => console.error("[App] fetch group messages error:", err))
      .finally(() => setMessagesLoading(false));
  }, [activeGroup?.id]);

  useEffect(() => {
    if (me?.id) {
      fetchGroups();
    }
  }, [me?.id, fetchGroups]);

  const handleOpenDm = (friend) => {
    if (!friend || !friend.id) {
      // Close DM (null friend)
      setActiveDmUser(null);
      setUnreadMarker(null);
      setMessagesLoading(false);
      socketRef.current?.emit("dm:set_active", { withUserId: null });
      return;
    }
    const unread = dmUnread[friend.id] || 0;
    setUnreadMarker(unread > 0 ? { key: `dm:${friend.id}`, count: unread } : null);
    setActiveGroup(null);
    setActiveDmUser(friend);
    if (!dmByUserId[friend.id]) setMessagesLoading(true);
    setDmUnread((u) => { const n = { ...u }; delete n[friend.id]; return n; });
    socketRef.current?.emit("dm:mark_read", { withUserId: friend.id });
    socketRef.current?.emit("dm:history", { withUserId: friend.id });
    socketRef.current?.emit("dm:set_active", { withUserId: friend.id });
  };

  // Desktop/web notification click → open the related DM or group
  useEffect(() => {
    const onNotifClick = (event) => {
      const detail = event?.detail;
      // Electron sends { title, body, tag, data }; web Notification sends data directly
      const data = detail?.data && typeof detail.data === "object" ? detail.data : detail;
      if (!data || typeof data !== "object") return;
      const type = data.type;

      if (type === "dm" || type === "missed-call") {
        const peerId = data.conversationId || data.fromId;
        if (!peerId) return;
        const friend =
          friendsRef.current.find((f) => f.id === peerId) ||
          { id: peerId, username: data.from || "User" };
        handleOpenDm(friend);
        return;
      }

      if (type === "group" || type === "group-call" || (type === "mention" && data.groupId)) {
        const groupId = data.groupId;
        if (!groupId) return;
        const group =
          myGroupsRef.current.find((g) => g.id === groupId) ||
          { id: groupId, name: data.groupName || "Grup" };
        setReplyTo(null);
        setActiveDmUser(null);
        setActiveGroup(group);
        socketRef.current?.emit("dm:set_active", { withUserId: null });
        setGroupUnread((u) => {
          if (!u[groupId]) return u;
          const n = { ...u };
          delete n[groupId];
          return n;
        });
        socketRef.current?.emit("group:join", groupId);
        return;
      }

      if (type === "mention" && data.dmConversationId) {
        const peerId = data.dmConversationId;
        const friend =
          friendsRef.current.find((f) => f.id === peerId) ||
          { id: peerId, username: data.from || "User" };
        handleOpenDm(friend);
        return;
      }

      if (type === "friend-request") {
        // Open friends list focus is enough — status is already in sidebar
        return;
      }
    };

    window.addEventListener("descall:notification-click", onNotifClick);
    return () => window.removeEventListener("descall:notification-click", onNotifClick);
    // handleOpenDm closes over dmUnread/dmByUserId — rebind when those change
  }, [dmUnread, dmByUserId]);

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
    setFriendRequests((prev) => prev.filter((r) => r.id !== fromUserId));
  };

  const handleDeclineFriend = (fromUserId) => {
    socketRef.current?.emit("friend:decline", { fromUserId });
    setFriendRequests((prev) => prev.filter((r) => r.id !== fromUserId));
  };

  const handleRemoveFriend = (friendId) => {
    socketRef.current?.emit("friend:remove", { friendId });
    setActiveDmUser((cur) => (cur?.id === friendId ? null : cur));
    setDmByUserId((prev) => { const n = { ...prev }; delete n[friendId]; return n; });
  };

  const handleStatusChange = (status) => {
    if (!["online", "idle", "dnd", "invisible"].includes(status)) return;
    setMyStatus(status);
    try { localStorage.setItem("descall:myStatus", status); } catch {}
    socketRef.current?.emit("status:set", { status });
  };

  const emitTypingDmStart = (toUserId) => {
    socketRef.current?.emit("typing:start", { context: "dm", toUserId });
  };
  const emitTypingDmStop = (toUserId) => {
    socketRef.current?.emit("typing:stop", { context: "dm", toUserId });
  };
  const emitTypingGroupStart = (groupId) => {
    socketRef.current?.emit("typing:start", { context: "group", groupId });
  };
  const emitTypingGroupStop = (groupId) => {
    socketRef.current?.emit("typing:stop", { context: "group", groupId });
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

  // ─── Guild Handlers ───
  const handleCreateGuild = async ({ name, iconUrl }) => {
    try {
      const { guild } = await createGuild({ name, iconUrl });
      if (guild) {
        setMyGuilds((prev) => [...prev, guild]);
        setActiveGuild(guild);
        setActiveGuildChannel(guild.channels?.[0] || null);
        socketRef.current?.emit("guilds:subscribe", [guild.id]);
      }
    } catch (err) {
      setFriendNotice(err.message || "Failed to create server");
      setTimeout(() => setFriendNotice(""), 5000);
      throw err;
    }
  };

  const handleJoinGuild = async (code) => {
    try {
      const { guild } = await joinGuildByInvite(code);
      if (guild) {
        setMyGuilds((prev) => prev.some((g) => g.id === guild.id) ? prev : [...prev, guild]);
        setActiveGuild(guild);
        setActiveGuildChannel(guild.channels?.[0] || null);
        socketRef.current?.emit("guilds:subscribe", [guild.id]);
      }
    } catch (err) {
      setFriendNotice(err.message || "Failed to join server");
      setTimeout(() => setFriendNotice(""), 5000);
      throw err;
    }
  };

  const handleLeaveGuild = async (guildId) => {
    try {
      await leaveGuild(guildId);
      setMyGuilds((prev) => prev.filter((g) => g.id !== guildId));
      if (activeGuild?.id === guildId) {
        setActiveGuild(null);
        setActiveGuildChannel(null);
      }
    } catch (err) {
      setFriendNotice(err.message || "Failed to leave server");
      setTimeout(() => setFriendNotice(""), 5000);
    }
  };

  const handleDeleteGuild = async (guildId) => {
    try {
      await deleteGuild(guildId);
      setMyGuilds((prev) => prev.filter((g) => g.id !== guildId));
      if (activeGuild?.id === guildId) {
        setActiveGuild(null);
        setActiveGuildChannel(null);
      }
    } catch (err) {
      setFriendNotice(err.message || "Failed to delete server");
      setTimeout(() => setFriendNotice(""), 5000);
    }
  };

  const handleRefreshGuilds = async () => {
    try {
      const data = await getMyGuilds();
      setMyGuilds(data?.guilds || []);
    } catch (err) {
      console.error("[App] refresh guilds error:", err);
    }
  };

  const handleGuildSelect = (guild) => {
    setActiveGuild(guild);
    setActiveGuildChannel(guild?.channels?.[0] || null);
    setActiveDmUser(null);
    setActiveGroup(null);
  };

  const handleGuildChannelSelect = (channel) => {
    setActiveGuildChannel(channel);
  };

  const connectionLabel = useMemo(() => {
    if (!isConnected) {
      if (reconnectState === "reconnecting") return "Reconnecting…";
      return "Offline";
    }
    return "Online";
  }, [isConnected, reconnectState]);

  const sortedDms = useMemo(() => {
    const list = (friends || []).map((f) => ({
      ...f,
      lastMessage: dmPreviews[f.id] || f.lastMessage || null,
      lastActivity: dmLastActivity[f.id] || f.lastActivity || null,
      unreadCount: dmUnread[f.id] || 0,
    }));
    return list.sort((a, b) => {
      const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      if (tb !== ta) return tb - ta;
      if ((b.unreadCount || 0) !== (a.unreadCount || 0)) return (b.unreadCount || 0) - (a.unreadCount || 0);
      return (a.username || "").localeCompare(b.username || "");
    });
  }, [friends, dmLastActivity, dmPreviews, dmUnread]);

  const sortedGroups = useMemo(() => {
    const list = (myGroups || []).map((g) => ({
      ...g,
      lastMessage: groupPreviews[g.id] || g.lastMessage || null,
      lastActivity: groupLastActivity[g.id] || g.lastActivity || g.updated_at || g.created_at || null,
      unreadCount: groupUnread[g.id] || 0,
    }));
    return list.sort((a, b) => {
      const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      if (tb !== ta) return tb - ta;
      if ((b.unreadCount || 0) !== (a.unreadCount || 0)) return (b.unreadCount || 0) - (a.unreadCount || 0);
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [myGroups, groupLastActivity, groupPreviews, groupUnread]);

  // HTML boot splash covers first paint; dismiss once session is resolved
  useEffect(() => {
    if (!sessionChecked) return;
    try {
      window.__descallDismissBootSplash?.({ minMs: 1200 });
    } catch {
      /* ignore */
    }
  }, [sessionChecked]);

  if (!sessionChecked) {
    return <TitleBar />;
  }

  // Show download page for all non-logged-in users
  if (!me) {
    return (
      <>
        <TitleBar />
        <DownloadPage
          onLogin={handleLogin}
          onRegister={handleRegister}
          onGoogleLogin={handleGoogleLogin}
          authLoading={authLoading}
          authError={authError}
        />
      </>
    );
  }

  return (
    <>
    <TitleBar />
    <div className="app-container">
        {updateState && (
          <div
            className="electron-update-banner"
            style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
            background: updateState === 'installing' ? '#23a55a' : '#5865f2',
            color: '#fff', fontSize: '13px', fontWeight: 600,
            textAlign: 'center', padding: '6px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {updateState === 'installing'
              ? `⚡ Descall ${updateVersion} yükleniyor, yeniden başlatılıyor…`
              : `⬇️ Descall ${updateVersion} güncelleniyor, arka planda indiriliyor…`}
          </div>
        )}
        {(me?.is_admin || me?.username === "admin") && adminOpen && (
          <AdminPanel socket={socketApi} onClose={() => setAdminOpen(false)} onAdminChanged={() => setAdminChanged(true)} />
        )}
        
        {/* NEW MODULAR LAYOUT SYSTEM */}
        <AppLayout
          me={me}
          socket={socketApi}
          onLogout={handleLogout}
          onProfileUpdated={applyProfileUpdate}
          activeDmUser={activeDmUser}
          activeGroup={activeGroup}
          groups={sortedGroups}
          dms={sortedDms}
          friends={friends}
          onlineUsers={onlineUsers}
          myStatus={myStatus}
          onStatusChange={handleStatusChange}
          onAdminClick={() => setAdminOpen(true)}
          isAdmin={me?.is_admin || me?.username === "admin"}
          onDmSelect={(dm) => {
            setReplyTo(null);
            if (!dm) {
              setActiveDmUser(null);
              setUnreadMarker(null);
              setMessagesLoading(false);
              socketRef.current?.emit("dm:set_active", { withUserId: null });
              return;
            }
            const unread = dmUnread[dm.id] || 0;
            setUnreadMarker(unread > 0 ? { key: `dm:${dm.id}`, count: unread } : null);
            setActiveGroup(null);
            setActiveDmUser(dm);
            if (dmByUserId[dm.id] === undefined) setMessagesLoading(true);
            setDmUnread((u) => { const n = { ...u }; delete n[dm.id]; return n; });
            socketRef.current?.emit("dm:mark_read", { withUserId: dm.id });
            socketRef.current?.emit("dm:history", { withUserId: dm.id });
            socketRef.current?.emit("dm:set_active", { withUserId: dm.id });
          }}
          onGroupSelect={(group) => {
            setReplyTo(null);
            setActiveDmUser(null);
            if (!group?.id) {
              setActiveGroup(null);
              setUnreadMarker(null);
              setMessagesLoading(false);
              socketRef.current?.emit("dm:set_active", { withUserId: null });
              return;
            }
            const unread = groupUnread[group.id] || 0;
            setUnreadMarker(unread > 0 ? { key: `group:${group.id}`, count: unread } : null);
            setActiveGroup(group);
            if (groupMessagesById[group.id] === undefined) setMessagesLoading(true);
            socketRef.current?.emit("dm:set_active", { withUserId: null });
            setGroupUnread((u) => { const n = { ...u }; delete n[group.id]; return n; });
            socketRef.current?.emit("group:join", group.id);
          }}
          dmUnread={dmUnread}
          groupUnread={groupUnread}
          friendNotice={friendNotice}
          onRefreshGroups={fetchGroups}
          onRefresh={handleRefresh}
          onGroupCreated={(group) => {
            setMyGroups((prev) => prev.some((g) => g.id === group.id) ? prev : [...prev, group]);
          }}
          onGroupLeft={(groupId) => {
            setMyGroups((prev) => prev.filter((g) => g.id !== groupId));
            setActiveGroup((cur) => (cur?.id === groupId ? null : cur));
          }}
          onGroupRenamed={(groupId, newName) => {
            setMyGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, name: newName } : g));
            setActiveGroup((cur) => (cur?.id === groupId ? { ...cur, name: newName } : cur));
          }}
          friendRequests={friendRequests}
          onAcceptFriend={handleAcceptFriend}
          onDeclineFriend={handleDeclineFriend}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onSendMessage={(msg) => {
            const isObj = msg && typeof msg === "object";
            const isMediaObject = isObj && (msg.type === "gif" || msg.type === "media");
            const textPayload = isObj && msg.type === "text" ? msg.text : (!isObj ? msg : "");
            const replyMeta = isObj ? msg.replyTo : null;

            if (activeDmUser) {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              const optimisticMessage = {
                id: tempId,
                from: normalizeUser({
                  id: me?.id,
                  username: me?.username,
                  displayName: me?.displayName || me?.display_name,
                  avatarUrl: me?.avatarUrl || me?.avatar_url,
                  updated_at: me?.updated_at || me?.avatarVersion,
                }),
                to: { id: activeDmUser.id },
                text: isMediaObject ? "" : textPayload,
                mediaUrl: isMediaObject ? msg.mediaUrl : undefined,
                mediaType: isMediaObject ? msg.mediaType : undefined,
                originalName: isMediaObject ? msg.originalName : undefined,
                size: isMediaObject ? msg.size : undefined,
                replyTo: replyMeta || undefined,
                timestamp: new Date().toISOString(),
                sending: true,
              };
              setDmByUserId((prev) => ({
                ...prev,
                [activeDmUser.id]: [...(prev[activeDmUser.id] ?? []), optimisticMessage],
              }));
              setDmLastActivity((prev) => ({ ...prev, [activeDmUser.id]: optimisticMessage.timestamp }));
              setDmPreviews((prev) => ({
                ...prev,
                [activeDmUser.id]: isMediaObject
                  ? (msg.mediaType === "image" ? "📷 Photo" : "📎 Attachment")
                  : String(textPayload).slice(0, 80),
              }));
              if (isMediaObject) {
                socketRef.current?.emit("dm:send", {
                  toUserId: activeDmUser.id,
                  tempId,
                  text: "",
                  mediaUrl: msg.mediaUrl,
                  mediaType: msg.mediaType,
                  mimeType: msg.mimeType,
                  size: msg.size,
                  originalName: msg.originalName,
                  replyTo: replyMeta || undefined,
                });
              } else {
                socketRef.current?.emit("dm:send", {
                  toUserId: activeDmUser.id,
                  tempId,
                  text: textPayload,
                  replyTo: replyMeta || undefined,
                });
              }
              setReplyTo(null);
            } else if (activeGroup) {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              const textStr = isMediaObject ? "" : String(textPayload || "");
              const isCasinoCmd =
                textStr.trim().startsWith("/") &&
                ["/bj", "/blackjack", "/hit", "/stand", "/stay", "/double", "/credits", "/bakiye", "/balance", "/top", "/lider", "/help", "/yardım", "/commands", "/jb"].some(
                  (cmd) => textStr.trim().toLowerCase().startsWith(cmd)
                );
              const optimistic = {
                id: tempId,
                from: normalizeUser({
                  id: me?.id,
                  username: me?.username,
                  displayName: me?.displayName || me?.display_name,
                  avatarUrl: me?.avatarUrl || me?.avatar_url,
                  updated_at: me?.updated_at || me?.avatarVersion,
                }),
                text: isMediaObject ? "" : textStr,
                mediaUrl: isMediaObject ? msg.mediaUrl : undefined,
                mediaType: isMediaObject ? msg.mediaType : undefined,
                originalName: isMediaObject ? msg.originalName : undefined,
                size: isMediaObject ? msg.size : undefined,
                replyTo: replyMeta || undefined,
                timestamp: new Date().toISOString(),
                sending: true,
              };
              // Don't flash "/bj 100" as a chat row — casino board arrives via game:*
              if (!isCasinoCmd) {
                setGroupMessagesById((prev) => ({
                  ...prev,
                  [activeGroup.id]: [...(prev[activeGroup.id] ?? []), optimistic],
                }));
                setGroupLastActivity((prev) => ({ ...prev, [activeGroup.id]: optimistic.timestamp }));
              } else {
                setGroupLastActivity((prev) => ({ ...prev, [activeGroup.id]: optimistic.timestamp }));
              }
              setGroupPreviews((prev) => ({
                ...prev,
                [activeGroup.id]: isMediaObject
                  ? `${me?.username || "You"}: 📎 Attachment`
                  : `${me?.username || "You"}: ${String(textStr).slice(0, 60)}`,
              }));
              if (isMediaObject) {
                socketRef.current?.emit("group:message", {
                  groupId: activeGroup.id,
                  tempId,
                  content: "",
                  mediaUrl: msg.mediaUrl,
                  mediaType: msg.mediaType,
                  replyTo: replyMeta || undefined,
                });
              } else {
                socketRef.current?.emit("group:message", {
                  groupId: activeGroup.id,
                  tempId,
                  content: textStr,
                  replyTo: replyMeta || undefined,
                });
              }
              setReplyTo(null);
            }
          }}
          onVoiceCall={() => {
            if (groupCall?.isInCall) return;
            // Only hijack when the banner is for the currently open group chat.
            if (
              activeGroup &&
              groupCall?.activeCallBanner?.groupId === activeGroup.id
            ) {
              groupCall.joinActiveCall(groupCall.activeCallBanner);
              return;
            }
            if (activeDmUser && call?.startCall) call.startCall(activeDmUser, "voice");
          }}
          onVideoCall={() => {
            if (groupCall?.isInCall) return;
            if (
              activeGroup &&
              groupCall?.activeCallBanner?.groupId === activeGroup.id
            ) {
              groupCall.joinActiveCall(groupCall.activeCallBanner);
              return;
            }
            if (activeDmUser && call?.startCall) call.startCall(activeDmUser, "video");
          }}
          onStartCall={(user, type = "voice") => {
            if (groupCall?.isInCall) return;
            if (user && call?.startCall) call.startCall(user, type);
          }}
          onStartGroupCallFromCalls={(group, type = "voice") => {
            if (!group?.id || !groupCall) return;
            if (groupCall.isInCall) return;
            const banner = groupCall.activeCallBanner;
            if (banner?.groupId === group.id) {
              groupCall.joinActiveCall(banner);
              return;
            }
            const full = sortedGroups.find((g) => g.id === group.id) || group;
            const memberIds = full.memberIds || full.members?.map((m) => m.id) || [];
            groupCall.startGroupCall(full.id, type, memberIds);
          }}
          onGroupVoiceCall={() => {
            if (!activeGroup || !groupCall) return;
            if (groupCall.isInCall && groupCall.activeGroupId === activeGroup.id) return;
            const banner = groupCall.activeCallBanner;
            if (banner?.groupId === activeGroup.id) {
              groupCall.joinActiveCall(banner);
            } else {
              const memberIds = activeGroup.memberIds || activeGroup.members?.map((m) => m.id) || [];
              groupCall.startGroupCall(activeGroup.id, "voice", memberIds);
            }
          }}
          onGroupVideoCall={() => {
            if (!activeGroup || !groupCall) return;
            if (groupCall.isInCall && groupCall.activeGroupId === activeGroup.id) return;
            const banner = groupCall.activeCallBanner;
            if (banner?.groupId === activeGroup.id) {
              groupCall.joinActiveCall(banner);
            } else {
              const memberIds = activeGroup.memberIds || activeGroup.members?.map((m) => m.id) || [];
              groupCall.startGroupCall(activeGroup.id, "video", memberIds);
            }
          }}
          activeCallBanner={groupCall?.activeCallBanner}
          onJoinActiveCall={() => {
            if (!activeGroup || !groupCall?.activeCallBanner) return;
            groupCall.joinActiveCall(groupCall.activeCallBanner);
          }}
          onDismissActiveBanner={groupCall?.dismissActiveBanner}
          notifPermission={notifPermission}
          onRequestNotifPermission={handleRequestNotifPermission}
          typingDmUser={typingDmUser}
          typingGroupUsers={typingGroupUsers}
          onTypingDmStart={emitTypingDmStart}
          onTypingDmStop={emitTypingDmStop}
          onTypingGroupStart={emitTypingGroupStart}
          onTypingGroupStop={emitTypingGroupStop}
          guilds={myGuilds}
          activeGuild={activeGuild}
          activeGuildChannel={activeGuildChannel}
          onGuildSelect={handleGuildSelect}
          onGuildChannelSelect={handleGuildChannelSelect}
          onCreateGuild={handleCreateGuild}
          onJoinGuild={handleJoinGuild}
          onLeaveGuild={handleLeaveGuild}
          onDeleteGuild={handleDeleteGuild}
          onRefreshGuilds={handleRefreshGuilds}
        >
          <MessageList
            messages={dmMessages}
            currentUser={me}
            me={me}
            friends={friends}
            onlineUsers={onlineUsers}
            onStartDm={(user) => setActiveDmUser(user)}
            onReply={setReplyTo}
            onJoinActiveCall={() => {
              if (!activeGroup || !groupCall?.activeCallBanner) return;
              groupCall.joinActiveCall(groupCall.activeCallBanner);
            }}
            onDismissActiveBanner={groupCall?.dismissActiveBanner}
            socket={socketRef.current}
            activeGroup={activeGroup}
            activeDmUser={activeDmUser}
            loading={Boolean(
              messagesLoading &&
                ((activeDmUser && dmByUserId[activeDmUser.id] === undefined) ||
                  (activeGroup && groupMessagesById[activeGroup.id] === undefined))
            )}
            unreadCount={
              unreadMarker &&
              ((activeDmUser && unreadMarker.key === `dm:${activeDmUser.id}`) ||
                (activeGroup && unreadMarker.key === `group:${activeGroup.id}`))
                ? unreadMarker.count
                : 0
            }
          />
        </AppLayout>
        <CallOverlay call={call} groupCall={groupCall} me={me} />
        <GroupCallIncomingModal
          incomingCall={groupCall?.incomingCall}
          onAccept={(groupId, callType, fromUser) => groupCall?.acceptGroupCall(groupId, callType, fromUser)}
          onDecline={(groupId, fromUserId, fromUser, callType) => groupCall?.declineCall(groupId, fromUserId, fromUser, callType)}
        />
      </div>
    </>
  );
}
