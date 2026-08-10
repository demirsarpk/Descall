import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import AuthView from "./components/AuthView";
import AppLayout from "./components/layout/AppLayout";
import GroupInviteLanding from "./components/groups/GroupInviteLanding";
import MarketingApp from "./site/MarketingApp";
import SeoHead from "./site/SeoHead";
import { getMe, login, loginWithGoogle, register, verify2faLogin } from "./api/auth";
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
import { subscribeWebPush } from "./lib/webPushSubscription";
import { requestNativePushPermission } from "./lib/nativePush";
import { useToast } from "./context/ToastContext";
import { useLocale } from "./context/LocaleContext";
import { t as tRuntime } from "./i18n/runtime";
import { appPathForView, directPath, groupPath, isAuthenticatedAppPath, parseAppRoute } from "./lib/appRoutes";
import AdminPanel from "./components/admin/AdminPanel";
import ShopGiftPopup from "./components/shop/ShopGiftPopup";
import DesCoinGiftPopup from "./components/shop/DesCoinGiftPopup";
import TitleBar from "./components/TitleBar";
import MessageList from "./components/chat/MessageList";
import MessageComposer from "./components/chat/MessageComposer";
import CallOverlay from "./components/CallOverlay";
import GroupCallIncomingModal from "./components/GroupCallIncomingModal";
import { requestFeedbackNudge } from "./components/feedback/FeedbackNudgeBanner";
import { parseVoiceMeta, encodeVoiceContent } from "./lib/voiceMessage";

function mergeById(existing, incoming) {
  const ids = new Set(existing.map((m) => m.id));
  const out = [...(incoming || []).filter((m) => m && !ids.has(m.id)), ...existing];
  return sortMessagesChronologically(out);
}

function sortMessagesChronologically(messages) {
  return [...messages].sort((a, b) => {
    const aTime = new Date(a?.timestamp || a?.created_at || 0).getTime();
    const bTime = new Date(b?.timestamp || b?.created_at || 0).getTime();
    return aTime - bTime;
  });
}

function normalizeGroups(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.groups)) return payload.groups;
  return [];
}

function parseInviteCodeFromLocation() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const fromQuery = (params.get("invite") || params.get("i") || "").trim();
    if (fromQuery) return fromQuery;
    const path = window.location.pathname || "";
    const match = path.match(/^\/(?:invite|i)\/([A-Za-z0-9_-]+)\/?$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function clearInvitePath() {
  try {
    const path = window.location.pathname || "";
    const params = new URLSearchParams(window.location.search || "");
    const hasQueryInvite = params.has("invite") || params.has("i");
    const hasPathInvite = /^\/(?:invite|i)\//i.test(path);
    if (!hasQueryInvite && !hasPathInvite) return;
    window.history.replaceState({}, "", "/");
  } catch {
    /* ignore */
  }
}

function writeInvitePath(code) {
  try {
    if (!code) return;
    // Root query form — required because Vite builds with base "./" and
    // deep paths like /invite/:code break relative JS/CSS asset loading.
    const next = `/?invite=${encodeURIComponent(code)}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState({}, "", next);
    }
  } catch {
    /* ignore */
  }
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
  const voice = parseVoiceMeta(m.content, m.media_type);
  return {
    id: m.id,
    from: sender,
    username: sender?.username || "Unknown",
    displayName: sender?.displayName || null,
    avatarUrl: sender?.avatarUrl,
    text: voice.isVoice ? "" : (m.content || ""),
    timestamp: m.created_at || new Date().toISOString(),
    mediaUrl: m.media_url,
    mediaType: voice.isVoice ? "voice" : m.media_type,
    originalName: m.original_name,
    size: m.file_size,
    duration: voice.duration ?? m.duration ?? null,
    reactions: Array.isArray(m.reactions) ? m.reactions : [],
    replyTo: m.replyTo || m.reply_to || null,
  };
}

/** Sidebar preview text for a normalized group message (username: body). */
function formatGroupPreviewFromMsg(msg, t = (k) => k) {
  if (!msg) return null;
  if (msg.type === "call_summary") {
    const who = msg.from?.username || msg.username || null;
    const body = t("📞 Call");
    return (who ? `${who}: ${body}` : body).slice(0, 80);
  }
  const who =
    msg.from?.username ||
    msg.username ||
    msg.sender?.username ||
    null;
  let body = null;
  const text = String(msg.text || "").trim();
  if (text) body = text;
  else if (msg.mediaType === "image") body = t("📷 Photo");
  else if (msg.mediaType === "voice" || msg.mediaType === "audio") body = t("🎤 Voice message");
  else if (msg.mediaUrl) body = t("📎 Attachment");
  if (!body) return null;
  return (who ? `${who}: ${body}` : body).slice(0, 80);
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
  const location = useLocation();
  const navigate = useNavigate();
  const requestedRoute = useMemo(() => parseAppRoute(location.pathname), [location.pathname]);
  const [authLoading, setAuthLoading] = useState(false);
  const { toast } = useToast();
  const { t, setLocale } = useLocale();
  const [authError, setAuthError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [me, setMe] = useState(() => normalizeUser(getUser()));
  const [inviteCode, setInviteCode] = useState(() => parseInviteCodeFromLocation());
  const [inviteAuthOpen, setInviteAuthOpen] = useState(false);
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
  const [activeView, setActiveView] = useState("chat");
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [shopGift, setShopGift] = useState(null);
  const [descoinGift, setDescoinGift] = useState(null);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
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
  const callOccupancyRef = useRef({ dmMode: null, groupActive: false });
  const call = useCall(socketApi, callOccupancyRef);
  const groupCall = useGroupCall(socketApi, me?.id, callOccupancyRef);

  useEffect(() => {
    callOccupancyRef.current = {
      dmMode: call?.mode || null,
      groupActive: Boolean(groupCall?.isInCall || groupCall?.incomingCall),
    };
  }, [call?.mode, groupCall?.isInCall, groupCall?.incomingCall]);
  const wasDmInCallRef = useRef(false);
  const wasGroupInCallRef = useRef(false);
  const lastDmCallDurationRef = useRef(0);
  const lastGroupCallDurationRef = useRef(0);

  // Reflect a live call in the address bar without treating a pasted call URL
  // as permission to start a microphone/camera session. Refreshing the URL
  // safely returns to its DM/group conversation instead.
  useEffect(() => {
    if (!me?.id) return;
    if (call.mode && call.peer?.username) {
      const callPath = `${directPath(call.peer)}/call/${call.callType || "voice"}`;
      if (location.pathname !== callPath) navigate(callPath, { replace: true });
      return;
    }
    if (groupCall.isInCall && groupCall.activeGroupId) {
      const callPath = `${groupPath(groupCall.activeGroupId)}/call`;
      if (location.pathname !== callPath) navigate(callPath, { replace: true });
      return;
    }
    if (requestedRoute.call && call.mode == null) {
      navigate(directPath(requestedRoute.username), { replace: true });
    } else if (requestedRoute.joinCall && !groupCall.isInCall) {
      navigate(groupPath(requestedRoute.groupId), { replace: true });
    }
  }, [
    call.callType,
    call.mode,
    call.peer,
    groupCall.activeGroupId,
    groupCall.isInCall,
    location.pathname,
    me?.id,
    navigate,
    requestedRoute,
  ]);

  useEffect(() => {
    preloadIceServers().catch(() => {});
  }, []);

  // Sync account language when user has no explicit local override
  useEffect(() => {
    if (!me?.language) return;
    try {
      if (!localStorage.getItem("descall_language")) {
        setLocale(me.language);
      }
    } catch {
      /* ignore */
    }
  }, [me?.language, setLocale]);

  // Riot OAuth / link callback (?riot_link=success|error)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const riotLink = params.get("riot_link");
      if (!riotLink) return;
      const reason = params.get("reason") || "";
      params.delete("riot_link");
      params.delete("reason");
      const qs = params.toString();
      window.history.replaceState({}, "", qs ? `/?${qs}` : "/");
      if (riotLink === "success") {
        toast("Valorant account linked", "success");
      } else {
        const msg = reason ? `Valorant link failed: ${reason}` : "Valorant link failed";
        toast(msg, "error");
      }
    } catch {
      /* ignore */
    }
  }, [toast]);

  // Soft feedback nudge after voice/video calls end (≥45s)
  useEffect(() => {
    if (call?.isInCall) {
      wasDmInCallRef.current = true;
      lastDmCallDurationRef.current = Number(call.duration) || 0;
      return;
    }
    if (wasDmInCallRef.current) {
      wasDmInCallRef.current = false;
      const secs = lastDmCallDurationRef.current || 0;
      lastDmCallDurationRef.current = 0;
      requestFeedbackNudge({ trigger: "after_call", callDurationMs: secs * 1000 });
    }
  }, [call?.isInCall, call?.duration]);

  useEffect(() => {
    if (groupCall?.isInCall) {
      wasGroupInCallRef.current = true;
      lastGroupCallDurationRef.current = Number(groupCall.duration) || 0;
      return;
    }
    if (wasGroupInCallRef.current) {
      wasGroupInCallRef.current = false;
      const secs = lastGroupCallDurationRef.current || 0;
      lastGroupCallDurationRef.current = 0;
      requestFeedbackNudge({ trigger: "after_call", callDurationMs: secs * 1000 });
    }
  }, [groupCall?.isInCall, groupCall?.duration]);

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

  // Apply the account's equipped premium theme (or the plain dark/light
  // choice) to the document as soon as we know it. Previously the only
  // place that ever set data-theme from the equipped theme lived inside
  // the Settings/Appearance panel's own effect, so a fresh login or page
  // reload kept showing the default dark theme — looking exactly like
  // nothing was equipped — until the user happened to open Settings,
  // which is what actually corrected it. Themes were never really lost;
  // they just weren't applied until something coincidentally mounted the
  // one component watching for them.
  useEffect(() => {
    if (!me) return; // don't clobber the boot-cached theme before we know who's logged in
    const themeKey = me?.equippedTheme?.theme_key || null;
    try {
      const raw =
        localStorage.getItem("descall_user_settings") ||
        localStorage.getItem("descall_settings") ||
        "{}";
      const settings = JSON.parse(raw);
      // Keep the boot-time pre-paint cache (see main.jsx) in sync so the
      // *next* page load/reload paints the right theme before React (and
      // this effect) even runs, instead of flashing dark first.
      const nextSettings = { ...settings, premiumThemeKey: themeKey };
      const json = JSON.stringify(nextSettings);
      localStorage.setItem("descall_user_settings", json);
      localStorage.setItem("descall_settings", json);
      document.documentElement.setAttribute(
        "data-theme",
        themeKey || (settings.darkMode === false ? "light" : "dark")
      );
    } catch {
      if (themeKey) document.documentElement.setAttribute("data-theme", themeKey);
    }
  }, [me, me?.equippedTheme?.theme_key]);

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
      const activeBannerItem = (banner?.groupId === activeGroup.id)
        ? [{
            ...banner,
            startTime: banner.startTime || Date.now(),
            id: `active-call-${banner.groupId}`,
            type: "active_call",
            timestamp: new Date(banner.startTime || Date.now()).toISOString(),
          }]
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
      if (bootStatus) bootStatus.textContent = tRuntime("Almost ready");
      setSessionChecked(true);
      return;
    }
    if (bootStatus) bootStatus.textContent = tRuntime("Signing in");
    let cancelled = false;
    (async () => {
      try {
        const { user } = await getMe(token);
        if (!cancelled) {
          commitSessionUser(user);
          if (bootStatus) bootStatus.textContent = tRuntime("Welcome back");
        }
      } catch (err) {
        if (!cancelled) {
          clearToken();
          clearUser();
          setMe(null);
          if (bootStatus) bootStatus.textContent = tRuntime("Almost ready");
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
    requestNativePushPermission()
      .then((permission) => {
        if (permission) setNotifPermission(permission);
      })
      .catch((error) => console.warn("[NativePush] Permission request failed:", error?.message || error));
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
    const nativePermission = await requestNativePushPermission();
    if (nativePermission) {
      setNotifPermission(nativePermission);
      return;
    }
    const result = await notificationService.requestPermission();
    if (result === "granted") subscribeWebPush().catch(() => {});
    setNotifPermission(result);
    if (result === "granted") {
      subscribeWebPush().catch((error) => {
        console.warn("[WebPush] Subscription failed:", error.message);
      });
    }
  };

  useEffect(() => {
    if (!me?.id || notifPermission !== "granted") return;
    subscribeWebPush().catch((error) => {
      console.warn("[WebPush] Subscription sync failed:", error.message);
    });
  }, [me?.id, notifPermission]);

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
    const handleProfileUpdated = ({ user }) => {
      if (user) applyProfileUpdate(user);
    };
    socketApi.on("user:profile:updated", handleProfileUpdated);
    return () => {
      socketApi.off("user:updated", handleUserUpdated);
      socketApi.off("user:profile:updated", handleProfileUpdated);
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
      if (msg.toLowerCase().includes("authentication failed") || msg.toLowerCase().includes("authentication required")) {
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
        // Seed list previews from API lastMessage/lastActivity (same idea as friend:list).
        setGroupPreviews((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const g of groups) {
            if (g?.id && g.lastMessage && g.lastMessage !== next[g.id]) {
              next[g.id] = g.lastMessage;
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        setGroupLastActivity((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const g of groups) {
            if (!g?.id || !g.lastActivity) continue;
            const prevTs = next[g.id] ? new Date(next[g.id]).getTime() : 0;
            const nextTs = new Date(g.lastActivity).getTime();
            if (!prevTs || nextTs >= prevTs) {
              if (next[g.id] !== g.lastActivity) {
                next[g.id] = g.lastActivity;
                changed = true;
              }
            }
          }
          return changed ? next : prev;
        });
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
      if (state?.dmUnreadByPeer && typeof state.dmUnreadByPeer === "object") {
        setDmUnread({ ...state.dmUnreadByPeer });
      }
      // Seed DM list previews from server memory (fills "No messages yet" on load).
      // Existing client previews win so live dm:message updates are not overwritten.
      if (state?.dmPreviewsByPeer && typeof state.dmPreviewsByPeer === "object") {
        setDmPreviews((prev) => ({ ...state.dmPreviewsByPeer, ...prev }));
      }
      if (state?.dmLastActivityByPeer && typeof state.dmLastActivityByPeer === "object") {
        setDmLastActivity((prev) => ({ ...state.dmLastActivityByPeer, ...prev }));
      }
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
          const cur = prev[groupId];
          const groupMap = cur instanceof Map ? new Map(cur) : new Map();
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
              const cur = prev[groupId];
              const groupMap = cur instanceof Map ? new Map(cur) : new Map();
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

    socket.on("friend:list", (list) => {
      const normalized = (list ?? []).map((u) => normalizeUser(u));
      setFriends(normalized);
      setFriendsLoaded(true);
      // Server now attaches lastMessage/lastActivity from dmHistory — seed list previews.
      setDmPreviews((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const f of normalized) {
          if (f?.id && f.lastMessage && f.lastMessage !== next[f.id]) {
            next[f.id] = f.lastMessage;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setDmLastActivity((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const f of normalized) {
          if (!f?.id || !f.lastActivity) continue;
          const prevTs = next[f.id] ? new Date(next[f.id]).getTime() : 0;
          const nextTs = new Date(f.lastActivity).getTime();
          if (!prevTs || nextTs >= prevTs) {
            if (next[f.id] !== f.lastActivity) {
              next[f.id] = f.lastActivity;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    });
    socket.on("friend:requests", (list) => setFriendRequests((list ?? []).map((u) => normalizeUser(u))));
    socket.on("friend:request:incoming", ({ from }) => {
      if (!from) return;
      const normalized = normalizeUser(from);
      setFriendRequests((prev) => prev.some((req) => req.id === normalized.id) ? prev : [...prev, normalized]);
      // Notification for incoming friend request
      notificationService.friendRequest({ from: from.username, fromId: from.id });
    });
    socket.on("friend:accepted", () => {
      socket.emit("friend:list");
    });
    socket.on("user:profile:updated", ({ user }) => {
      if (user) applyProfileUpdate(user);
    });
    socket.on("friend:error", ({ message } = {}) => {
      setFriendNotice(message || t("Friend action failed."));
      setTimeout(() => setFriendNotice(""), 4000);
      // Restore pending list / friends after a failed accept/decline
      socket.emit("friend:list");
    });
    socket.on("friend:request:sent", ({ to } = {}) => {
      setFriendNotice(to ? t("Request sent to {to}", { to }) : t("Request sent."));
      setTimeout(() => setFriendNotice(""), 3000);
    });

    socket.on("dm:history", ({ withUserId, messages }) => {
      if (!withUserId) return;
      const normalized = (messages ?? []).map((m) => {
        const voice = parseVoiceMeta(m.text, m.mediaType);
        if (!voice.isVoice) return m;
        return {
          ...m,
          text: "",
          mediaType: "voice",
          duration: m.duration ?? voice.duration ?? 0,
        };
      });
      // History is a recent DB window; never replace already loaded pages or
      // optimistic rows when the periodic refresh arrives.
      setDmByUserId((prev) => {
        const existing = prev[withUserId] ?? [];
        return { ...prev, [withUserId]: mergeById(existing, normalized) };
      });
      setMessagesLoading(false);
      setDmHasMore((normalized?.length ?? 0) >= 50);
      const last = Array.isArray(normalized) && normalized.length > 0 ? normalized[normalized.length - 1] : null;
      if (last) {
        const ts = last.timestamp || last.created_at;
        if (ts) setDmLastActivity((prev) => {
          if (prev[withUserId] && new Date(prev[withUserId]) >= new Date(ts)) return prev;
          return { ...prev, [withUserId]: ts };
        });
        const previewText = last.text
          || (last.mediaType === "image"
            ? "📷 Photo"
            : last.mediaType === "voice" || last.mediaType === "audio"
              ? "🎤 Voice message"
              : last.mediaUrl
                ? "📎 Attachment"
                : "");
        if (previewText) {
          setDmPreviews((p) => {
            if (p[withUserId] === previewText) return p;
            return { ...p, [withUserId]: previewText };
          });
        }
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

    socket.on("dm:error", ({ message, tempId, toUserId } = {}) => {
      if (tempId && toUserId) {
        setDmByUserId((prev) => {
          const cur = prev[toUserId] ?? [];
          if (!cur.some((m) => m.id === tempId)) return prev;
          return {
            ...prev,
            [toUserId]: cur.map((m) =>
              m.id === tempId ? { ...m, sending: false, failed: true } : m
            ),
          };
        });
      }
      if (message) {
        toast(message, "error");
      }
    });

    socket.on("dm:message", (message) => {
      const convWith = message?.convWith;
      if (!convWith) return;
      const voice = parseVoiceMeta(message.text, message.mediaType);
      const normalizedMsg = voice.isVoice
        ? {
            ...message,
            text: "",
            mediaType: "voice",
            duration: message.duration ?? voice.duration ?? 0,
          }
        : message;
      const ts = normalizedMsg.timestamp || new Date().toISOString();
      const previewText = normalizedMsg.text
        || (normalizedMsg.mediaType === "image"
          ? "📷 Photo"
          : normalizedMsg.mediaType === "voice" || normalizedMsg.mediaType === "audio"
            ? "🎤 Voice message"
            : normalizedMsg.mediaUrl
              ? "📎 Attachment"
              : "");
      setDmLastActivity((prev) => ({ ...prev, [convWith]: ts }));
      if (previewText) setDmPreviews((prev) => ({ ...prev, [convWith]: previewText }));

      setDmByUserId((prev) => {
        const cur = prev[convWith] ?? [];
        const isSelf = normalizedMsg.from?.id === myIdRef.current;
        // Replace optimistic (sending) message by tempId echo, or dedupe by real id
        if (isSelf && normalizedMsg.tempId) {
          const hasTemp = cur.some((m) => m.id === normalizedMsg.tempId);
          if (hasTemp) {
            return { ...prev, [convWith]: cur.map((m) => m.id === normalizedMsg.tempId ? { ...normalizedMsg, sending: false } : m) };
          }
        }
        const alreadyExists = cur.some((m) => m.id === normalizedMsg.id);
        if (alreadyExists) return prev;
        return { ...prev, [convWith]: [...cur, normalizedMsg] };
      });
      // Only notify for messages from others (not self)
      const currentUserId = myIdRef.current;
      const isFromOther = normalizedMsg.from?.id && normalizedMsg.from.id !== currentUserId;
      if (isFromOther) {
        socket.emit("dm:delivered", { msgId: normalizedMsg.id, fromUserId: normalizedMsg.from.id });
        // Local unread bump if not viewing this conversation (server also syncs)
        if (activeDmRef.current?.id !== convWith) {
          playUiSound("message");
          // Send native notification
          notificationService.newMessage({
            from: normalizedMsg.from?.username || 'Birisi',
            text: normalizedMsg.text || (normalizedMsg.mediaType === "voice" ? "🎤 Voice message" : ""),
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
          ["/bj", "/blackjack", "/hit", "/stand", "/stay", "/double", "/credits", "/bakiye", "/balance", "/top", "/lider", "/help", "/yardım", "/commands", "/jb", "/daily"].some(
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
      const voice = parseVoiceMeta(message.content, message.media_type);
      const normalized = {
        id: message.id,
        from: sender,
        username: sender?.username || "Unknown",
        displayName: sender?.displayName || null,
        avatarUrl: sender?.avatarUrl,
        text: voice.isVoice ? "" : (message.content || ""),
        timestamp: message.created_at || new Date().toISOString(),
        mediaUrl: message.media_url,
        mediaType: voice.isVoice ? "voice" : message.media_type,
        originalName: message.original_name,
        size: message.file_size,
        duration: voice.duration ?? message.duration ?? null,
        replyTo: message.replyTo || message.reply_to || null,
      };
      setGroupMessagesById((prev) => {
        const cur = prev[groupId] ?? [];
        // Replace optimistic message by tempId, or dedupe by real id
        if (tempId && cur.some((m) => m.id === tempId)) {
          return {
            ...prev,
            [groupId]: sortMessagesChronologically(
              cur.map((m) => m.id === tempId ? { ...normalized, sending: false } : m)
            ),
          };
        }
        if (cur.some((m) => m.id === normalized.id)) return prev;
        return { ...prev, [groupId]: sortMessagesChronologically([...cur, normalized]) };
      });

      setGroupLastActivity((prev) => ({ ...prev, [groupId]: normalized.timestamp }));
      {
        const preview = formatGroupPreviewFromMsg(normalized);
        if (preview) {
          setGroupPreviews((prev) => ({ ...prev, [groupId]: preview }));
        }
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

    socket.on("group:message:error", ({ groupId, tempId, message } = {}) => {
      if (groupId && tempId) {
        setGroupMessagesById((prev) => {
          const cur = prev[groupId] ?? [];
          if (!cur.some((m) => m.id === tempId)) return prev;
          return {
            ...prev,
            [groupId]: cur.map((m) =>
              m.id === tempId ? { ...m, sending: false, failed: true } : m
            ),
          };
        });
      }
      if (message) toast(message, "error");
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
          // Never interrupt a live or finished hand with lobby/help (Again must survive)
          const prevLive = ["playing", "dealer", "dealing", "finished"].includes(
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

    const patchPinState = (messageId, pinnedAt, pinnedBy) => {
      const patchList = (list) => {
        if (!Array.isArray(list)) return list;
        let changed = false;
        const next = list.map((m) => {
          if (m.id !== messageId) return m;
          changed = true;
          return { ...m, pinnedAt: pinnedAt || null, pinnedBy: pinnedBy || null };
        });
        return changed ? next : list;
      };
      return patchList;
    };

    socket.on("dm:message:pinned", ({ messageId, pinnedAt, pinnedBy, toUserId } = {}) => {
      if (!messageId || !toUserId) return;
      const patchList = patchPinState(messageId, pinnedAt, pinnedBy);
      setDmByUserId((prev) => {
        const cur = prev[toUserId];
        if (!cur) return prev;
        const next = patchList(cur);
        return next === cur ? prev : { ...prev, [toUserId]: next };
      });
    });

    socket.on("dm:message:unpinned", ({ messageId, toUserId } = {}) => {
      if (!messageId || !toUserId) return;
      const patchList = patchPinState(messageId, null, null);
      setDmByUserId((prev) => {
        const cur = prev[toUserId];
        if (!cur) return prev;
        const next = patchList(cur);
        return next === cur ? prev : { ...prev, [toUserId]: next };
      });
    });

    socket.on("group:message:pinned", ({ messageId, groupId, pinnedAt, pinnedBy } = {}) => {
      if (!messageId || !groupId) return;
      const patchList = patchPinState(messageId, pinnedAt, pinnedBy);
      setGroupMessagesById((prev) => {
        const cur = prev[groupId];
        if (!cur) return prev;
        const next = patchList(cur);
        return next === cur ? prev : { ...prev, [groupId]: next };
      });
    });

    socket.on("group:message:unpinned", ({ messageId, groupId } = {}) => {
      if (!messageId || !groupId) return;
      const patchList = patchPinState(messageId, null, null);
      setGroupMessagesById((prev) => {
        const cur = prev[groupId];
        if (!cur) return prev;
        const next = patchList(cur);
        return next === cur ? prev : { ...prev, [groupId]: next };
      });
    });

    socket.on("shop:gift:received", (payload = {}) => {
      if (!payload?.item) return;
      setShopGift(payload);
      playUiSound("notification");
    });

    socket.on("descoin:balance", ({ balance } = {}) => {
      if (typeof balance !== "number") return;
      setMe((prev) => (prev ? { ...prev, descoinBalance: balance } : prev));
    });

    socket.on("descoin:gift", (payload = {}) => {
      if (!payload || typeof payload.amount !== "number") return;
      setDescoinGift(payload);
      playUiSound("notification");
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
      // Accounts with 2FA enabled don't get a session token from /auth/login —
      // the server instead emails a one-time code and expects a follow-up
      // call to /auth/2fa/verify-login. Previously nothing surfaced this to
      // the UI: handleLogin just kept going and called setToken(undefined),
      // so the login screen looked like it silently did nothing.
      if (data.requires2fa) {
        return { requires2fa: true, pendingToken: data.pendingToken, emailHint: data.emailHint };
      }
      transportFallbackStepRef.current = 0;
      setToken(data.token);
      commitSessionUser(data.user);
      return null;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerify2fa = async (pendingToken, code) => {
    try {
      setAuthLoading(true);
      setAuthError("");
      const data = await verify2faLogin(pendingToken, code);
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
      setGroupPreviews((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const g of groups) {
          if (g?.id && g.lastMessage && g.lastMessage !== next[g.id]) {
            next[g.id] = g.lastMessage;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
      setGroupLastActivity((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const g of groups) {
          if (!g?.id || !g.lastActivity) continue;
          const prevTs = next[g.id] ? new Date(next[g.id]).getTime() : 0;
          const nextTs = new Date(g.lastActivity).getTime();
          if (!prevTs || nextTs >= prevTs) {
            if (next[g.id] !== g.lastActivity) {
              next[g.id] = g.lastActivity;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
      const ids = groups.map((g) => g.id).filter(Boolean);
      if (ids.length > 0 && socketRef.current?.connected) {
        socketRef.current.emit("groups:rejoin", ids);
      }
    } catch (err) {
      // Keep previous list — a transient API failure should not wipe the sidebar
      console.error("[groups] fetch failed", err);
    } finally {
      setGroupsLoaded(true);
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
          setGroupMessagesById((prev) => {
            const existing = prev[grp.id] || [];
            // Preserve ephemeral socket-only rows (casino boards, pending sends)
            const keep = existing.filter((m) =>
              m?.isGameMessage ||
              m?.sending ||
              m?.failed ||
              (typeof m?.id === "string" && (m.id.startsWith("temp-") || m.id.startsWith("casino-"))) ||
              (typeof m?.type === "string" && m.type.startsWith("game_"))
            );
            const byId = new Map(normalized.map((m) => [m.id, m]));
            for (const m of keep) {
              if (!byId.has(m.id)) byId.set(m.id, m);
            }
            // Keep chronological order: DB messages + any keep-only at end if missing timestamps
            const merged = Array.from(byId.values()).sort((a, b) => {
              const ta = new Date(a.timestamp || a.created_at || 0).getTime();
              const tb = new Date(b.timestamp || b.created_at || 0).getTime();
              return ta - tb;
            });
            return { ...prev, [grp.id]: merged };
          });
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
        setGroupMessagesById((prev) => ({
          ...prev,
          [activeGroup.id]: sortMessagesChronologically(normalized),
        }));
        const last = normalized[normalized.length - 1];
        const preview = formatGroupPreviewFromMsg(last, t);
        if (preview) {
          setGroupPreviews((prev) => ({ ...prev, [activeGroup.id]: preview }));
        }
        if (last?.timestamp) {
          setGroupLastActivity((prev) => ({ ...prev, [activeGroup.id]: last.timestamp }));
        }
      })
      .catch((err) => console.error("[App] fetch group messages error:", err))
      .finally(() => setMessagesLoading(false));
  }, [activeGroup?.id, t]);

  // Sync the "ongoing call" banner for whichever group is currently open.
  // The live push (group:call:banner-update) only reaches clients that were
  // already connected and viewing that group when it fired — this catches
  // everyone else (just opened the group, reconnected, missed the push).
  useEffect(() => {
    groupCall.setViewingGroupId(activeGroup?.id || null);
  }, [activeGroup?.id, groupCall.setViewingGroupId]);

  useEffect(() => {
    if (me?.id) {
      fetchGroups();
    }
  }, [me?.id, fetchGroups]);

  // URL is authoritative for an existing browser entry. Only friends and
  // current group members can resolve a conversation route; invalid targets
  // fall back to their safe list view without ever loading private history.
  useEffect(() => {
    if (!me?.id || !sessionChecked) return;

    if (requestedRoute.unknown) {
      navigate("/direct", { replace: true });
      return;
    }

    setActiveView(requestedRoute.view);
    setUserPanelOpen(Boolean(requestedRoute.settingsTab));

    if (requestedRoute.view === "chat") {
      setActiveGroup(null);
      if (!requestedRoute.username) {
        setActiveDmUser(null);
        return;
      }
      if (!friendsLoaded) return;
      const friend = friends.find(
        (item) => item?.username?.toLowerCase() === requestedRoute.username.toLowerCase()
      );
      if (!friend) {
        setActiveDmUser(null);
        navigate("/direct", { replace: true });
        return;
      }
      if (activeDmRef.current?.id !== friend.id) handleOpenDm(friend);
      return;
    }

    if (requestedRoute.view === "groups") {
      setActiveDmUser(null);
      if (!requestedRoute.groupId) {
        setActiveGroup(null);
        return;
      }
      if (!groupsLoaded) return;
      const group = myGroups.find((item) => item?.id === requestedRoute.groupId);
      if (!group) {
        setActiveGroup(null);
        navigate("/groups", { replace: true });
        return;
      }
      if (activeGroupRef.current?.id !== group.id) {
        setActiveGroup(group);
        socketRef.current?.emit("group:join", group.id);
      }
      return;
    }

    setActiveDmUser(null);
    setActiveGroup(null);
  }, [
    friends,
    friendsLoaded,
    groupsLoaded,
    location.pathname,
    me?.id,
    myGroups,
    navigate,
    requestedRoute,
    sessionChecked,
  ]);

  const handleOpenDm = (friend) => {
    if (!friend || !friend.id) {
      // Close DM (null friend)
      setActiveDmUser(null);
      setUnreadMarker(null);
      setMessagesLoading(false);
      socketRef.current?.emit("dm:set_active", { withUserId: null });
      return;
    }
    const nextPath = directPath(friend);
    if (location.pathname !== nextPath) navigate(nextPath);
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
    const id = String(fromUserId || "").trim();
    if (!id) return;
    const socket = socketRef.current;
    // Optimistic remove — restored via friend:error → friend:list if it fails
    setFriendRequests((prev) => prev.filter((r) => r.id !== id));
    if (socket?.connected) {
      socket.emit("friend:accept", { fromUserId: id });
      return;
    }
    // HTTP fallback when socket is down
    const token = getToken();
    fetch(`${API_BASE_URL}/friends/accept`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ fromUserId: id }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Failed to accept");
        setFriendNotice(t("Friend request accepted"));
        setTimeout(() => setFriendNotice(""), 3000);
        socketRef.current?.emit("friend:list");
      })
      .catch((err) => {
        setFriendNotice(err.message || t("Friend action failed."));
        setTimeout(() => setFriendNotice(""), 4000);
        socketRef.current?.emit("friend:list");
      });
  };

  const handleDeclineFriend = (fromUserId) => {
    const id = String(fromUserId || "").trim();
    if (!id) return;
    const socket = socketRef.current;
    setFriendRequests((prev) => prev.filter((r) => r.id !== id));
    if (socket?.connected) {
      socket.emit("friend:decline", { fromUserId: id });
      return;
    }
    const token = getToken();
    fetch(`${API_BASE_URL}/friends/decline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ fromUserId: id }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Failed to decline");
        socketRef.current?.emit("friend:list");
      })
      .catch((err) => {
        setFriendNotice(err.message || t("Friend action failed."));
        setTimeout(() => setFriendNotice(""), 4000);
        socketRef.current?.emit("friend:list");
      });
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
      if (reconnectState === "reconnecting") return t("Reconnecting…");
      return t("Offline");
    }
    return t("Online");
  }, [isConnected, reconnectState, t]);

  const sortedDms = useMemo(() => {
    const list = (friends || []).map((f) => {
      const cached = dmByUserId?.[f.id];
      const lastCached =
        Array.isArray(cached) && cached.length > 0 ? cached[cached.length - 1] : null;
      const cachedPreview = lastCached
        ? lastCached.text
          || (lastCached.mediaType === "image"
            ? t("📷 Photo")
            : lastCached.mediaType === "voice" || lastCached.mediaType === "audio"
              ? t("🎤 Voice message")
              : lastCached.mediaUrl
                ? t("📎 Attachment")
                : null)
        : null;
      const cachedActivity = lastCached?.timestamp || lastCached?.created_at || null;
      return {
        ...f,
        lastMessage: dmPreviews[f.id] || f.lastMessage || cachedPreview || null,
        lastActivity: dmLastActivity[f.id] || f.lastActivity || cachedActivity || null,
        unreadCount: dmUnread[f.id] || 0,
      };
    });
    return list.sort((a, b) => {
      const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      if (tb !== ta) return tb - ta;
      if ((b.unreadCount || 0) !== (a.unreadCount || 0)) return (b.unreadCount || 0) - (a.unreadCount || 0);
      return (a.username || "").localeCompare(b.username || "");
    });
  }, [friends, dmLastActivity, dmPreviews, dmUnread, dmByUserId, t]);

  const sortedGroups = useMemo(() => {
    const list = (myGroups || []).map((g) => {
      const cached = groupMessagesById[g.id];
      const lastCached =
        Array.isArray(cached) && cached.length > 0 ? cached[cached.length - 1] : null;
      const cachedPreview = formatGroupPreviewFromMsg(lastCached, t);
      const cachedActivity = lastCached?.timestamp || lastCached?.created_at || null;
      return {
        ...g,
        lastMessage: groupPreviews[g.id] || g.lastMessage || cachedPreview || null,
        lastActivity:
          groupLastActivity[g.id] || g.lastActivity || cachedActivity || g.updated_at || g.created_at || null,
        unreadCount: groupUnread[g.id] || 0,
      };
    });
    return list.sort((a, b) => {
      const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      if (tb !== ta) return tb - ta;
      if ((b.unreadCount || 0) !== (a.unreadCount || 0)) return (b.unreadCount || 0) - (a.unreadCount || 0);
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [myGroups, groupLastActivity, groupPreviews, groupUnread, groupMessagesById, t]);

  // HTML boot splash covers first paint; dismiss once session is resolved
  useEffect(() => {
    if (!sessionChecked) return;
    try {
      window.__descallDismissBootSplash?.({ minMs: 1200 });
    } catch {
      /* ignore */
    }
  }, [sessionChecked]);

  // After login, resume a pending Discord-style group invite
  useEffect(() => {
    if (!me?.id) return;
    try {
      const pending = sessionStorage.getItem("descall:pendingInvite");
      if (!pending) return;
      sessionStorage.removeItem("descall:pendingInvite");
      setInviteCode(pending);
      setInviteAuthOpen(false);
      writeInvitePath(pending);
    } catch {
      /* ignore */
    }
  }, [me?.id]);

  const handleInviteJoined = useCallback((group) => {
    if (group?.id) {
      setMyGroups((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((g) => g.id === group.id)) return list;
        return [group, ...list];
      });
      setReplyTo(null);
      setActiveDmUser(null);
      setActiveGroup(group);
      setUnreadMarker(null);
      if (socketRef.current?.connected) {
        socketRef.current.emit("groups:rejoin", [group.id]);
        socketRef.current.emit("dm:set_active", { withUserId: null });
      }
    }
    try {
      sessionStorage.removeItem("descall:pendingInvite");
    } catch {
      /* ignore */
    }
    clearInvitePath();
    setInviteCode(null);
    setInviteAuthOpen(false);
  }, []);

  const dismissInvite = useCallback(() => {
    try {
      sessionStorage.removeItem("descall:pendingInvite");
    } catch {
      /* ignore */
    }
    clearInvitePath();
    setInviteCode(null);
    setInviteAuthOpen(false);
  }, []);

  if (!sessionChecked) {
    return <TitleBar />;
  }

  // Discord-style invite landing (works logged out + logged in)
  if (inviteCode && !(inviteAuthOpen && !me)) {
    return (
      <>
        <SeoHead forceNoindex title="Group invite — Descall" description="Join a Descall group" />
        <TitleBar />
        <GroupInviteLanding
          code={inviteCode}
          me={me}
          onJoined={handleInviteJoined}
          onNeedLogin={() => setInviteAuthOpen(true)}
          onDismiss={dismissInvite}
        />
      </>
    );
  }

  // Public marketing site for logged-out users (real SEO routes)
  if (!me) {
    if (isAuthenticatedAppPath(location.pathname)) {
      return <Navigate to="/" replace />;
    }
    // Native Android/iOS launches are product entry points, not SEO landing
    // pages. Take people straight to sign-in/sign-up so an installed app
    // feels like an app from its first frame.
    if (Capacitor.isNativePlatform()) {
      return (
        <>
          <TitleBar />
          <AuthView
            onLogin={handleLogin}
            onRegister={handleRegister}
            onGoogleLogin={handleGoogleLogin}
            onVerify2fa={handleVerify2fa}
            loading={authLoading}
            error={authError}
          />
        </>
      );
    }
    return (
      <>
        <TitleBar />
        <MarketingApp
          onLogin={handleLogin}
          onRegister={handleRegister}
          onGoogleLogin={handleGoogleLogin}
          onVerify2fa={handleVerify2fa}
          authLoading={authLoading}
          authError={authError}
        />
      </>
    );
  }

  return (
    <>
    {/* Authenticated app shell — never index private UI */}
    <SeoHead forceNoindex title="Descall" description="Descall app" path="/app" />
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

        {shopGift && (
          <ShopGiftPopup
            gift={shopGift}
            onDismiss={() => setShopGift(null)}
            onEquipped={async () => {
              try {
                const token = getToken();
                const { user } = await getMe(token);
                applyProfileUpdate(user);
              } catch { /* best-effort */ }
              setShopGift(null);
            }}
          />
        )}

        {descoinGift && (
          <DesCoinGiftPopup gift={descoinGift} onDismiss={() => setDescoinGift(null)} />
        )}
        
        {/* NEW MODULAR LAYOUT SYSTEM */}
        <AppLayout
          me={me}
          socket={socketApi}
          onLogout={handleLogout}
          onProfileUpdated={applyProfileUpdate}
          activeDmUser={activeDmUser}
          activeGroup={activeGroup}
          activeView={activeView}
          onActiveViewChange={(view) => {
            const nextPath = appPathForView(view);
            setActiveView(view);
            if (location.pathname !== nextPath) navigate(nextPath);
          }}
          userPanelOpen={userPanelOpen}
          settingsTab={requestedRoute.settingsTab}
          onUserPanelOpenChange={(open) => {
            setUserPanelOpen(open);
            const nextPath = open ? "/settings" : appPathForView(activeView);
            if (location.pathname !== nextPath) navigate(nextPath);
          }}
          onSettingsTabChange={(tab) => {
            const nextPath = tab && tab !== "overview" ? `/settings/${encodeURIComponent(tab)}` : "/settings";
            if (location.pathname !== nextPath) navigate(nextPath);
          }}
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
              if (location.pathname.startsWith("/direct/")) navigate("/direct");
              return;
            }
            const nextPath = directPath(dm);
            if (location.pathname !== nextPath) navigate(nextPath);
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
              if (location.pathname.startsWith("/groups/")) navigate("/groups");
              return;
            }
            const nextPath = groupPath(group);
            if (location.pathname !== nextPath) navigate(nextPath);
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
                duration: isMediaObject ? msg.duration : undefined,
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
                  ? (msg.mediaType === "image"
                    ? "📷 Photo"
                    : msg.mediaType === "voice" || msg.mediaType === "audio"
                      ? "🎤 Voice message"
                      : "📎 Attachment")
                  : String(textPayload).slice(0, 80),
              }));
              if (isMediaObject) {
                const isVoice = msg.mediaType === "voice" || msg.mediaType === "audio";
                socketRef.current?.emit("dm:send", {
                  toUserId: activeDmUser.id,
                  tempId,
                  text: isVoice ? encodeVoiceContent(msg.duration || 0) : "",
                  mediaUrl: msg.mediaUrl,
                  mediaType: isVoice ? "voice" : msg.mediaType,
                  mimeType: msg.mimeType,
                  size: msg.size,
                  originalName: msg.originalName,
                  duration: msg.duration,
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
                ["/bj", "/blackjack", "/hit", "/stand", "/stay", "/double", "/credits", "/bakiye", "/balance", "/top", "/lider", "/help", "/yardım", "/commands", "/jb", "/daily"].some(
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
                duration: isMediaObject ? msg.duration : undefined,
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
                [activeGroup.id]: formatGroupPreviewFromMsg(
                  {
                    from: { username: me?.username || t("You") },
                    text: isMediaObject ? "" : textStr,
                    mediaType: isMediaObject ? msg.mediaType : undefined,
                    mediaUrl: isMediaObject ? msg.mediaUrl : undefined,
                  },
                  t
                ) || `${me?.username || t("You")}: ${String(textStr).slice(0, 60)}`,
              }));
              if (isMediaObject) {
                const isVoice = msg.mediaType === "voice" || msg.mediaType === "audio";
                socketRef.current?.emit("group:message", {
                  groupId: activeGroup.id,
                  tempId,
                  content: isVoice ? encodeVoiceContent(msg.duration || 0) : "",
                  mediaUrl: msg.mediaUrl,
                  mediaType: isVoice ? "voice" : msg.mediaType,
                  duration: msg.duration,
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
