import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../context/ToastContext";
import { useMobile } from "../hooks/useMobile";
import { useProfileCustomization } from "../hooks/useProfileCustomization";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useGroupCall } from "../hooks/useGroupCall";
import VoiceMessagePlayer from "./chat/VoiceMessagePlayer";
import TypingIndicator from "./chat/TypingIndicator";
import MessageReactions from "./chat/MessageReactions";
import MessageEditUI from "./chat/MessageEditUI";
import GiphyPicker from "./chat/GiphyPicker";
import SettingsPanel from "./settings/SettingsPanel";
import ProfileCustomizationPanel from "./profile/ProfileCustomizationPanel";
import VideoConference from "./VideoConference";
import UserHoverCard from "./social/UserHoverCard";
import UserProfilePopover from "./social/UserProfilePopover";
import RippleButton from "./ui/RippleButton";
import UserFeedbackButton from "./feedback/UserFeedbackButton";
import { Avatar } from "./ui/Avatar";
import Modal from "./ui/Modal";
import { uploadFile } from "../api/media";
import { getMediaUrl } from "../api/media";
import { API_BASE_URL } from "../config/api";
// Modern Group API
import { getMyGroups, createGroup, sendGroupMessage, getGroupMessages, leaveGroup, renameGroup, inviteToGroup, getGroupMembers } from "../api/groups";
import {
  MessageSquare, Users, UserPlus, Bell, Circle,
  PanelLeftClose, Settings, Send, Paperclip,
  Phone, Video, X, Plus, Clock, Check, CheckCheck, Play,
  Mic, MicOff, Camera, CameraOff, Monitor, PhoneOff,
  Search, LogOut, Volume2, VolumeX, Maximize2, Minimize2, Grid, Minus, Square,
  ChevronLeft, ChevronRight, MoreVertical, Trash2,
  Menu, Palette, Sparkles, User, Megaphone,
  Download
} from "lucide-react";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function StatusBadge({ status = "offline" }) {
  return <span className={`status-dot ${status}`} title={status} />;
}

function formatTime(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  } catch { return ""; }
}

// Sound paths for web/electron
const isElectronEnv = typeof window !== 'undefined' && window.electronAPI?.isElectron;
const clickSoundPath = isElectronEnv ? 'sounds/click.mp3' : '/sounds/click.mp3';
const notificationSoundPath = isElectronEnv ? 'sounds/notification.mp3' : '/sounds/notification.mp3';

const clickSound = typeof Audio !== 'undefined' ? new Audio(clickSoundPath) : null;
const notificationSound = typeof Audio !== 'undefined' ? new Audio(notificationSoundPath) : null;

function playClickSound() {
  if (clickSound) {
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {}); // Ignore autoplay errors
  }
}

function playNotificationSound() {
  if (notificationSound) {
    notificationSound.currentTime = 0;
    notificationSound.volume = 0.7;
    notificationSound.play().catch(() => {}); // Ignore autoplay errors
  }
}

function groupDmRows(messages) {
  if (!messages || !Array.isArray(messages)) return [];
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    let compact = false;
    if (prev && prev.from?.id === msg.from?.id) {
      const gap = new Date(msg.timestamp) - new Date(prev.timestamp);
      if (gap < 7 * 60 * 1000) compact = true;
    }
    return { msg, compact };
  });
}

function MediaMessage({ media, onOpenLightbox, isOwn = false }) {
  const url = getMediaUrl(media.url);
  if (media.mediaType === "image") {
    return (
      <div className="dm-media-wrap">
        <img
          src={url}
          alt={media.originalName || "image"}
          className="dm-media-img"
          loading="lazy"
          onClick={() => onOpenLightbox(url)}
        />
      </div>
    );
  }
  if (media.mediaType === "video") {
    return (
      <div className="dm-media-wrap">
        <video
          src={url}
          className="dm-media-video"
          controls
          preload="metadata"
        />
      </div>
    );
  }
  if (media.mediaType === "audio") {
    return (
      <div className="dm-message-voice">
        <VoiceMessagePlayer audioUrl={url} duration={media.duration || 0} isOwn={isOwn} />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="dm-media-file">
      📎 {media.originalName || "file"}
    </a>
  );
}

function Lightbox({ url, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      className="lightbox-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <img src={url} alt="" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="lightbox-close" onClick={onClose}>✕</button>
    </motion.div>
  );
}

function CallBar({ call, peerScreenSharing, onMinimize }) {
  const [minimized, setMinimized] = useState(false);

  if (!call || call.mode === null) return null;

  if (call.mode === "incoming" && call.peer) {
    return (
      <div className="voice-modal-overlay">
        <motion.div className="voice-modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="voice-avatar">
            <Avatar name={call.peer.username} size={64} imageUrl={call.peer.avatarUrl || call.peer.avatar_url} />
          </div>
          <h3>{call.peer.username}</h3>
          <p>Incoming {call.callType === "video" ? "video" : "voice"} call</p>
          <div className="voice-modal-actions">
            <RippleButton type="button" className="btn-decline" onClick={call.declineIncoming}>Decline</RippleButton>
            <RippleButton type="button" className="btn-accept" onClick={call.acceptIncoming}>Accept</RippleButton>
          </div>
        </motion.div>
      </div>
    );
  }

  if ((call.mode === "active" || call.mode === "outgoing") && call.peer) {
    if (minimized) {
      // Minimized floating button
      return (
        <motion.div 
          className="call-minimized-btn" 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMinimized(false)}
        >
          <div className="minimized-avatar">
            <Avatar name={call.peer.username} size={40} imageUrl={call.peer.avatarUrl} />
            <span className="minimized-pulse" />
          </div>
          <span className="minimized-duration">{call.formatDuration(call.duration)}</span>
          <span className="minimized-expand">↗</span>
        </motion.div>
      );
    }

    // Fullscreen call modal
    return (
      <div className="call-fullscreen-overlay">
        <motion.div 
          className="call-fullscreen"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          {/* Header */}
          <div className="call-fullscreen-header">
            <div className="call-header-info">
              <Avatar name={call.peer.username} size={48} imageUrl={call.peer.avatarUrl} />
              <div>
                <h3>{call.peer.username}</h3>
                <span className="call-status">
                  {call.mode === "active"
                    ? call.formatDuration(call.duration)
                    : "Ringing…"}
                </span>
                {peerScreenSharing && <span className="screen-indicator">🖥 Sharing screen</span>}
                {call.connectionQuality === "poor" && <span className="quality-warn">⚠ Weak connection</span>}
              </div>
            </div>
            <button 
              className="call-minimize-btn" 
              onClick={() => setMinimized(true)}
              title="Minimize call"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '36px',
                minHeight: '36px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 1000,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            >
              <Minimize2 size={20} />
            </button>
          </div>

          {/* Video area */}
          {call.callType === "video" && (
            <div className="call-fullscreen-video">
              <video 
                ref={call.remoteVideoRef} 
                autoPlay 
                playsInline 
                className="call-remote-video"
              />
              {call.cameraOn && (
                <div className="call-pip-video">
                  <video 
                    ref={call.localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="call-local-video"
                  />
                </div>
              )}
              {peerScreenSharing && (
                <div className="call-screen-share">
                  <video 
                    ref={call.screenVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="call-screen-video"
                  />
                </div>
              )}
            </div>
          )}

          {/* Voice-only visualization */}
          {call.callType === "voice" && (
            <div className="call-fullscreen-voice">
              <div className="voice-visualizer">
                <div className="voice-avatar-large">
                  <Avatar name={call.peer.username} size={120} imageUrl={call.peer.avatarUrl} />
                </div>
                <div className="voice-waves">
                  <span className="wave" />
                  <span className="wave" />
                  <span className="wave" />
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="call-fullscreen-controls">
            <RippleButton 
              type="button" 
              className={`call-control-btn ${call.muted ? "muted" : ""}`} 
              onClick={call.toggleMute}
            >
              {call.muted ? <MicOff size={24} /> : <Mic size={24} />}
              <span>{call.muted ? "Unmute" : "Mute"}</span>
            </RippleButton>
            
            {call.callType === "video" && (
              <RippleButton 
                type="button" 
                className={`call-control-btn ${call.cameraOn ? "active" : ""}`} 
                onClick={call.toggleCamera}
              >
                {call.cameraOn ? <CameraOff size={24} /> : <Camera size={24} />}
                <span>{call.cameraOn ? "Camera off" : "Camera on"}</span>
              </RippleButton>
            )}
            
            <RippleButton 
              type="button" 
              className={`call-control-btn ${call.screenSharing ? "active" : ""}`} 
              onClick={call.screenSharing ? call.stopScreenShare : call.startScreenShare}
            >
              <Monitor size={24} />
              <span>{call.screenSharing ? "Stop sharing" : "Share screen"}</span>
            </RippleButton>
            
            <RippleButton 
              type="button" 
              className="call-control-btn hangup" 
              onClick={() => call.endCall(call.peer.id)}
            >
              <PhoneOff size={24} />
              <span>End call</span>
            </RippleButton>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}

// Add subtle animations
function AnimatedSidebar({ children, isOpen }) {
  return (
    <motion.aside
      className={`sidebar glass ${!isOpen ? "collapsed" : ""}`}
      initial={{ width: isOpen ? 240 : 60 }}
      animate={{ width: isOpen ? 240 : 60 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.aside>
  );
}

function AnimatedMessage({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

export default function ChatLayout({
  me,
  refreshMe,
  connectionLabel,
  reconnectState,
  authError,
  myStatus,
  onlineUsers,
  friends,
  friendRequests,
  notifications = [],
  activeDmUser,
  dmMessages,
  dmUnread = {},
  dmByUserId = {},
  typingDmUser,
  onOpenDm,
  onSendDm,
  socket,
  onSendDmMedia,
  onSendFriendRequest,
  onAcceptFriend,
  onDeclineFriend,
  onRemoveFriend,
  onLogout,
  onStatusChange,
  friendNotice,
  call,
  onTypingDmStart,
  onTypingDmStop,
  loadOlderDm,
  dmHasMore,
  loadingOlderDm,
  onNotificationRead,
  onNotificationReadAll,
  peerScreenSharing,
  groupCall,
  onClearDm,
  myGroups,
  setMyGroups,
}) {
  const { toast } = useToast();
  const [composer, setComposer] = useState("");
  const [friendUsername, setFriendUsername] = useState("");
  const [sidebarView, setSidebarView] = useState("dms");
  const [friendFilter, setFriendFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState(new Set());
  const [profileUser, setProfileUser] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);
  const [compactBlur, setCompactBlur] = useState(() => {
    try { return Number(localStorage.getItem("descall_blur")) || 14; } catch { return 14; }
  });
  const [reduceMotion, setReduceMotion] = useState(() => {
    try { return localStorage.getItem("descall_reduce_motion") === "true"; } catch { return false; }
  });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("descall_theme") || "dark"; } catch { return "dark"; }
  });
  const [fontSize, setFontSize] = useState(() => {
    try { return localStorage.getItem("descall_font_size") || "medium"; } catch { return "medium"; }
  });
  const [borderRadius, setBorderRadius] = useState(() => {
    try { return localStorage.getItem("descall_border_radius") || "medium"; } catch { return "medium"; }
  });
  const [accentColor, setAccentColor] = useState(() => {
    try { return localStorage.getItem("descall_accent_color") || "#6678ff"; } catch { return "#6678ff"; }
  });
  const [uiDensity, setUiDensity] = useState(() => {
    try { return localStorage.getItem("descall_ui_density") || "comfortable"; } catch { return "comfortable"; }
  });
  const [messageBubbleStyle, setMessageBubbleStyle] = useState(() => {
    try { return localStorage.getItem("descall_bubble_style") || "modern"; } catch { return "modern"; }
  });
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  // ========== MODERN GROUP SYSTEM ==========
  const [groups, setGroups] = useState({
    list: [],
    active: null,
    messages: [], // current active group messages (for backward compatibility)
    messagesCache: {}, // { [groupId]: messages[] } - prefetched messages for all groups
    membersCache: {}, // { [groupId]: members[] } - prefetched members for all groups
    members: [], // current active group members
    isLoading: false, // global loading state
    ui: {
      createOpen: false,
      newGroupName: "",
      selectedMembers: [],
      renameOpen: false,
      renameValue: "",
      inviteOpen: false,
      inviteUsername: "",
      groupComposer: "",
    },
    call: { minimized: false },
  });
  // Voice recorder state refs to avoid circular dependency
  const audioBlobRef = useRef(null);
  const recordingDurationRef = useRef(0);

  // Send voice message - defined early to avoid circular dependency
  const sendVoiceMessage = useCallback(async () => {
    const blob = audioBlobRef.current;
    const duration = recordingDurationRef.current;
    if (!blob || !activeDmUser) return;
    
    try {
      setUploading(true);
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const result = await uploadFile(file);
      
      onSendDmMedia(activeDmUser.id, {
        url: result.url,
        mediaType: 'audio',
        mimeType: 'audio/webm',
        duration: duration,
      });
      
      audioBlobRef.current = null;
      recordingDurationRef.current = 0;
    } catch (error) {
      console.error('Failed to send voice message:', error);
      toast('Ses mesajı gönderilemedi', 'error');
    } finally {
      setUploading(false);
    }
  }, [activeDmUser, onSendDmMedia, toast]);

  // Send group voice message - defined early to avoid circular dependency
  const sendGroupVoiceMessage = useCallback(async () => {
    const blob = audioBlobRef.current;
    const duration = recordingDurationRef.current;
    if (!blob || !groups.active) return;
    
    try {
      setUploading(true);
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const result = await uploadFile(file);
      
      socket?.emit("group:message", {
        groupId: groups.active.id,
        content: "",
        mediaUrl: result.url,
        mediaType: 'audio',
        duration: duration,
      });
      
      audioBlobRef.current = null;
      recordingDurationRef.current = 0;
    } catch (error) {
      console.error('Failed to send group voice message:', error);
      toast('Ses mesajı gönderilemedi', 'error');
    } finally {
      setUploading(false);
    }
  }, [groups.active, socket, toast]);

  // ========== VOICE RECORDER ==========
  // Handle voice recording completion
  const handleVoiceRecordingComplete = useCallback((blob, duration) => {
    console.log("Voice recording completed:", blob, duration);
    audioBlobRef.current = blob;
    recordingDurationRef.current = duration || 0;
    
    // Auto-send voice message if DM is active
    if (blob && activeDmUser) {
      sendVoiceMessage();
    } else if (blob && groups.active) {
      sendGroupVoiceMessage();
    }
  }, [activeDmUser, groups.active, sendVoiceMessage, sendGroupVoiceMessage]);

  const voiceRecorder = useVoiceRecorder({
    onRecordingComplete: handleVoiceRecordingComplete,
  });
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
    formattedDuration,
  } = voiceRecorder;

  // Group call hook for video conference
  const localGroupCall = useGroupCall(socket);
  
  // Use local hook if available, otherwise fall back to prop
  const activeGroupCall = localGroupCall?.isInCall ? localGroupCall : groupCall;

  // ========== MOBILE & CUSTOMIZATION ==========
  const { isMobile, isPortrait, touchSupported, vibrate } = useMobile();
  const profileCustomization = useProfileCustomization();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState("dms"); // "dms", "groups", "calls", "profile"
  const [customizationOpen, setCustomizationOpen] = useState(false);
  const [messageReactions, setMessageReactions] = useState({}); // { messageId: [{emoji, userId, username}] }
  const [editingMessage, setEditingMessage] = useState(null); // { id, text, type: 'dm'|'group' }
  const [giphyPickerOpen, setGiphyPickerOpen] = useState(false);
  const [giphyPickerForGroup, setGiphyPickerForGroup] = useState(false);
  const fileInputRef = useRef(null);
  const groupsList = asArray(groups.list);
  const groupsMessages = asArray(groups.messages);

  const messagesRef = useRef(null);
  const typingTimerRef = useRef(null);
  const wasTypingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  // Message edit functions
  const startEditingMessage = useCallback((msg, type) => {
    setEditingMessage({ id: msg.id, text: msg.text || msg.content, type });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const saveEditedMessage = useCallback((newText) => {
    if (!editingMessage || !newText.trim()) return;
    
    const { id, type } = editingMessage;
    
    if (type === 'dm' && activeDmUser) {
      socket?.emit("dm:message:edit", {
        messageId: id,
        newText: newText.trim(),
        toUserId: activeDmUser.id
      });
    } else if (type === 'group' && groups.active) {
      socket?.emit("group:message:edit", {
        messageId: id,
        newText: newText.trim(),
        groupId: groups.active.id
      });
    }
    
    setEditingMessage(null);
  }, [editingMessage, activeDmUser, groups.active, socket]);

  useEffect(() => { document.documentElement.toggleAttribute("data-reduce-motion", reduceMotion); }, [reduceMotion]);
  useEffect(() => { 
    document.documentElement.style.setProperty("--glass-blur", `${compactBlur}px`); 
    try { localStorage.setItem("descall_blur", String(compactBlur)); } catch {}
  }, [compactBlur]);
  useEffect(() => {
    try { localStorage.setItem("descall_theme", theme); } catch {}
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    try { localStorage.setItem("descall_reduce_motion", String(reduceMotion)); } catch {}
  }, [reduceMotion]);
  useEffect(() => {
    try { localStorage.setItem("descall_font_size", fontSize); } catch {}
    document.documentElement.setAttribute("data-font-size", fontSize);
  }, [fontSize]);
  useEffect(() => {
    try { localStorage.setItem("descall_border_radius", borderRadius); } catch {}
    document.documentElement.setAttribute("data-border-radius", borderRadius);
  }, [borderRadius]);
  useEffect(() => {
    try { localStorage.setItem("descall_accent_color", accentColor); } catch {}
    document.documentElement.style.setProperty("--accent", accentColor);
    document.documentElement.style.setProperty("--accent-2", accentColor + "80"); // 50% opacity version
  }, [accentColor]);
  useEffect(() => {
    try { localStorage.setItem("descall_ui_density", uiDensity); } catch {}
    document.documentElement.setAttribute("data-ui-density", uiDensity);
  }, [uiDensity]);
  useEffect(() => {
    try { localStorage.setItem("descall_bubble_style", messageBubbleStyle); } catch {}
    document.documentElement.setAttribute("data-bubble-style", messageBubbleStyle);
  }, [messageBubbleStyle]);

  useEffect(() => { scrollToBottom(); }, [activeDmUser, scrollToBottom]);

  // ========== MODERN GROUP SYSTEM ==========
  
  // Fetch groups on mount + PREFETCH all group data
  useEffect(() => {
    if (!me) return;
    
    const loadAllData = async () => {
      try {
        const data = await getMyGroups();
        const normalized =
          Array.isArray(data) ? data :
          Array.isArray(data?.groups) ? data.groups :
          [];
        
        setGroups((g) => ({ ...g, list: normalized, isLoading: true }));
        
        // PREFETCH: Load messages and members for all groups in background
        if (normalized.length > 0) {
          console.log("[Prefetch] Starting to load data for", normalized.length, "groups");
          
          const prefetchPromises = normalized.map(async (group) => {
            if (!group?.id) return;
            
            try {
              const [messagesRes, membersRes] = await Promise.all([
                getGroupMessages(group.id),
                getGroupMembers(group.id)
              ]);
              
              const messages = messagesRes?.messages || [];
              const members = asArray(membersRes?.members);
              
              // Update cache for this group
              setGroups(g => ({
                ...g,
                messagesCache: { ...g.messagesCache, [group.id]: messages },
                membersCache: { ...g.membersCache, [group.id]: members }
              }));
              
              console.log("[Prefetch] Loaded group:", group.name, "-", messages.length, "messages");
            } catch (err) {
              console.error("[Prefetch] Failed to load group:", group.name, err);
            }
          });
          
          // Wait for all prefetch to complete
          await Promise.allSettled(prefetchPromises);
          console.log("[Prefetch] All group data loaded");
        }
        
        setGroups((g) => ({ ...g, isLoading: false }));
      } catch (err) {
        console.error("[Prefetch] Failed to load groups:", err);
        setGroups(g => ({ ...g, list: [], isLoading: false }));
      }
      
      // ========== PREFETCH: DM Conversations ==========
      try {
        const token = localStorage.getItem("descall_token");
        const res = await fetch(`${API_BASE_URL}/api/friends/list`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        
        if (res.ok) {
          const data = await res.json();
          const friends = data.friends || [];
          
          // Get all DM conversations (both accepted friends and pending conversations)
          const dmPromises = friends.map(async (friend) => {
            try {
              const convRes = await fetch(
                `${API_BASE_URL}/api/messages/history?userId=${friend.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              if (convRes.ok) {
                const convData = await convRes.json();
                return {
                  userId: friend.id,
                  messages: convData.messages || []
                };
              }
            } catch (e) {
              console.error("[Prefetch] Failed to load DM for:", friend.id);
            }
            return null;
          });
          
          const dmResults = await Promise.allSettled(dmPromises);
          const dmCache = {};
          
          dmResults.forEach((result) => {
            if (result.status === "fulfilled" && result.value) {
              dmCache[result.value.userId] = result.value.messages;
            }
          });
          
          console.log("[Prefetch] Loaded DM conversations:", Object.keys(dmCache).length);
          
          // Store in localStorage for quick access
          try {
            localStorage.setItem("descall_dm_cache", JSON.stringify({
              data: dmCache,
              timestamp: Date.now()
            }));
          } catch (e) {
            console.error("[Prefetch] Failed to cache DMs");
          }
        }
      } catch (err) {
        console.error("[Prefetch] Failed to load DMs:", err);
      }
      
      // ========== PREFETCH: Announcements ==========
      try {
        const token = localStorage.getItem("descall_token");
        const [announcementsRes, unreadRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/announcements`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/announcements/unread/count`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        if (announcementsRes.ok) {
          const data = await announcementsRes.json();
          setAnnouncements(data.announcements || []);
          console.log("[Prefetch] Loaded announcements:", data.announcements?.length || 0);
        }
        
        if (unreadRes.ok) {
          const data = await unreadRes.json();
          setUnreadAnnouncements(data.count || 0);
        }
      } catch (err) {
        console.error("[Prefetch] Failed to load announcements:", err);
      }
      
      // ========== PREFETCH: Notifications ==========
      try {
        // Notifications are passed as prop, but we can refresh them
        if (onNotificationReadAll) {
          console.log("[Prefetch] Notifications ready from props");
        }
      } catch (err) {
        console.error("[Prefetch] Notifications check failed:", err);
      }
      
      // ========== PREFETCH: Admin Data (if admin) ==========
      if (me?.role === "admin" || me?.isAdmin) {
        try {
          const token = localStorage.getItem("descall_token");
          const [usersRes, statsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_BASE_URL}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } })
          ]);
          
          if (usersRes.ok) {
            const data = await usersRes.json();
            console.log("[Prefetch] Loaded admin users:", data.users?.length || 0);
          }
          
          if (statsRes.ok) {
            const data = await statsRes.json();
            console.log("[Prefetch] Loaded admin stats");
          }
        } catch (err) {
          console.error("[Prefetch] Failed to load admin data:", err);
        }
      }
      
      console.log("[Prefetch] === ALL DATA LOADED ===");
    };
    
    loadAllData();
  }, [me]);

  // Fetch announcements on mount (backup - will be skipped if prefetch succeeded)
  useEffect(() => {
    if (!me) return;
    const token = localStorage.getItem("descall_token");
    
    // Only fetch if not already loaded by prefetch
    if (announcements.length === 0) {
      fetch(`${API_BASE_URL}/api/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setAnnouncements(data.announcements || []))
        .catch(() => setAnnouncements([]));
    }
    
    if (unreadAnnouncements === 0) {
      fetch(`${API_BASE_URL}/api/announcements/unread/count`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setUnreadAnnouncements(data.count || 0))
        .catch(() => setUnreadAnnouncements(0));
    }
  }, [me]);

  // Mark announcements as read when viewing announcements tab
  useEffect(() => {
    if (!me || sidebarView !== "announcements" || announcements.length === 0) return;
    
    const token = localStorage.getItem("descall_token");
    const unreadAnnouncements = announcements.filter((a) => !readAnnouncementIds.has(a.id));
    
    if (unreadAnnouncements.length > 0) {
      // Mark all unread announcements as read
      Promise.all(
        unreadAnnouncements.map((a) =>
          fetch(`${API_BASE_URL}/api/announcements/${a.id}/read`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      ).then(() => {
        setReadAnnouncementIds((prev) => {
          const newSet = new Set(prev);
          unreadAnnouncements.forEach((a) => newSet.add(a.id));
          return newSet;
        });
        setUnreadAnnouncements(0);
      }).catch((err) => {
        console.error("Failed to mark announcements as read:", err);
      });
    }
  }, [sidebarView, announcements, me, readAnnouncementIds]);

  // Socket event listeners for announcements
  useEffect(() => {
    if (!socket) return;

    const onNewAnnouncement = (announcement) => {
      setAnnouncements((prev) => [announcement, ...prev]);
      // Only increment unread if not currently viewing announcements
      if (sidebarView !== "announcements") {
        setUnreadAnnouncements((prev) => prev + 1);
      } else {
        // Mark as read immediately if viewing announcements
        const token = localStorage.getItem("descall_token");
        fetch(`${API_BASE_URL}/api/announcements/${announcement.id}/read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).then(() => {
          setReadAnnouncementIds((prev) => new Set(prev).add(announcement.id));
        }).catch(() => {});
      }
    };

    const onDeletedAnnouncement = ({ id }) => {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    };

    // Announcement with notification sound
    const onNewAnnouncementWithSound = (data) => {
      playNotificationSound();
      onNewAnnouncement(data);
    };
    socket.on("announcement:new", onNewAnnouncementWithSound);
    socket.on("announcement:deleted", onDeletedAnnouncement);

    return () => {
      socket.off("announcement:new", onNewAnnouncementWithSound);
      socket.off("announcement:deleted", onDeletedAnnouncement);
    };
  }, [socket, sidebarView]);

  // Socket event listeners for groups
  useEffect(() => {
    if (!socket) return;

    // Real-time group messages - with duplicate prevention
    const onGroupMessage = ({ groupId, message }) => {
      if (groupId === groups.active?.id) {
        setGroups(g => {
          const currentMessages = g.messages || [];
          
          // Check for duplicates by ID
          const existsById = currentMessages.some(m => m.id === message.id);
          if (existsById) {
            console.log("[ChatLayout] Duplicate group message prevented (by ID):", message.id);
            return g;
          }
          
          // Check for duplicates by content + timestamp (for messages without ID)
          const existsByContent = currentMessages.some(m => 
            m.content === message.content && 
            m.sender_id === message.sender_id && 
            m.created_at === message.created_at
          );
          if (existsByContent) {
            console.log("[ChatLayout] Duplicate group message prevented (by content)");
            return g;
          }
          
          // Check for recent duplicate (within 2 seconds, same sender and content)
          const now = new Date();
          const isRecentDuplicate = currentMessages.some(m => {
            const msgTime = new Date(m.created_at || m.timestamp);
            const timeDiff = now - msgTime;
            return timeDiff < 2000 && 
                   m.sender_id === message.sender_id && 
                   m.content === message.content;
          });
          if (isRecentDuplicate) {
            console.log("[ChatLayout] Duplicate group message prevented (recent)");
            return g;
          }
          
          return {
            ...g,
            messages: [...currentMessages, message]
          };
        });
      }
    };

    // Call ended
    const onCallEnded = () => {
      setGroups((g) => ({ ...g, call: { ...g.call, minimized: false } }));
    };

    // Group message with notification sound
    const onGroupMessageWithSound = (data) => {
      // Play sound if message is from someone else
      if (data.sender?.id !== me?.id) {
        playNotificationSound();
      }
      // Call original handler
      onGroupMessage(data);
    };
    socket.on("group:message", onGroupMessageWithSound);
    socket.on("group:call:left", onCallEnded);
    socket.on("group:call:ended", onCallEnded);

    // Real-time reactions listener
    console.log("[ChatLayout] Setting up reaction listener, socket connected:", socket?.connected);
    const onReactionUpdate = (data) => {
      console.log("[ChatLayout] Reaction update received:", data);
      setMessageReactions(prev => {
        const current = prev[data.messageId] || [];
        if (data.removed) {
          return {
            ...prev,
            [data.messageId]: current.filter(r => !(r.emoji === data.emoji && r.userId === data.userId))
          };
        } else {
          const exists = current.find(r => r.emoji === data.emoji && r.userId === data.userId);
          if (exists) return prev;
          return {
            ...prev,
            [data.messageId]: [...current, { emoji: data.emoji, userId: data.userId, username: data.username }]
          };
        }
      });
    };
    socket.on("reaction:update", onReactionUpdate);

    // Message edit listeners
    const onGroupMessageEdited = (data) => {
      setGroups(g => ({
        ...g,
        messages: (g.messages || []).map(m => 
          m.id === data.messageId 
            ? { ...m, content: data.newText, editedAt: data.editedAt, isEdited: true }
            : m
        )
      }));
    };
    socket.on("group:message:edited", onGroupMessageEdited);

    const onDmMessageEdited = (data) => {
      console.log("[ChatLayout] DM message edited:", data);
    };
    socket.on("dm:message:edited", onDmMessageEdited);

    // Real-time DM messages - with duplicate prevention
    const onDmMessage = (data) => {
      console.log("[ChatLayout] DM message received:", data);
      const { from, text, mediaUrl, mediaType, timestamp, messageId } = data;
      
      // Play notification sound if message is from someone else (not me)
      const isFromMe = from === me?.id;
      if (!isFromMe) {
        playNotificationSound();
      }
      
      // Check if this is for currently active DM conversation
      if (activeDmUser && (from === activeDmUser.id || isFromMe)) {
        setActiveDmMessages(prev => {
          // Prevent duplicates by checking messageId or timestamp+text combination
          const exists = prev.some(m => 
            m.id === messageId || 
            (m.timestamp === timestamp && m.text === text && m.from === from)
          );
          if (exists) {
            console.log("[ChatLayout] Duplicate DM message prevented");
            return prev;
          }
          return [...prev, {
            id: messageId || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            from,
            text,
            mediaUrl,
            mediaType,
            timestamp,
            isMe: isFromMe
          }];
        });
      }
    };
    socket.on("dm:message", onDmMessage);

    return () => {
      socket.off("group:message", onGroupMessageWithSound);
      socket.off("group:call:left", onCallEnded);
      socket.off("group:call:ended", onCallEnded);
      socket.off("reaction:update", onReactionUpdate);
      socket.off("group:message:edited", onGroupMessageEdited);
      socket.off("dm:message:edited", onDmMessageEdited);
      socket.off("dm:message", onDmMessage);
    };
  }, [socket, groups.active?.id, groupsList, activeDmUser, me?.id]);

  useEffect(() => {
    if (groupCall?.isInCall) return;
    setGroups((g) => ({ ...g, call: { ...g.call, minimized: false } }));
  }, [groupCall?.isInCall]);

  // Keep socket subscribed to all my group rooms for live messages/calls.
  useEffect(() => {
    if (!socket) return;
    const ids = groupsList.map((g) => g?.id).filter(Boolean);
    ids.forEach((id) => socket.emit("group:join", id));
    return () => {
      ids.forEach((id) => socket.emit("group:leave", id));
    };
  }, [socket, groupsList]);

  // Group actions
  const groupActions = {
    // Open group - INSTANT from cache, then background refresh
    open: async (group) => {
      console.log("[ChatLayout] Opening group:", group);
      onClearDm?.();
      
      // INSTANT: Show cached data immediately
      const cachedMessages = groups.messagesCache[group.id];
      const cachedMembers = groups.membersCache[group.id];
      
      setGroups(g => ({ 
        ...g, 
        active: group,
        messages: cachedMessages || [], // Instant from cache
        members: cachedMembers || [] // Instant from cache
      }));
      
      // Save to localStorage
      try {
        localStorage.setItem("descall_active_group", JSON.stringify({ id: group.id, name: group.name }));
      } catch {}
      
      // BACKGROUND: Fetch fresh data
      setTimeout(async () => {
        try {
          const [messagesRes, membersRes] = await Promise.all([
            getGroupMessages(group.id),
            getGroupMembers(group.id)
          ]);
          
          const messages = messagesRes?.messages || [];
          const members = asArray(membersRes?.members);
          
          // Update cache
          setGroups(g => ({
            ...g,
            messagesCache: { ...g.messagesCache, [group.id]: messages },
            membersCache: { ...g.membersCache, [group.id]: members },
            // Only update current view if this group is still active
            messages: g.active?.id === group.id ? messages : g.messages,
            members: g.active?.id === group.id ? members : g.members
          }));
          
          console.log("[ChatLayout] Background refresh complete for group:", group.id);
        } catch (err) {
          console.error("[ChatLayout] Background refresh failed:", err);
        }
        
        // Fetch reactions
        try {
          const token = localStorage.getItem("descall_token");
          const res = await fetch(`${API_BASE_URL}/reactions/conversation/group/${group.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setMessageReactions(data.reactions || {});
          }
        } catch (err) {
          console.error("[ChatLayout] Reactions fetch failed:", err);
        }
      }, 0);
    },

    // Send message
    sendMessage: async (text) => {
      if (!text?.trim() || !groups.active) return;
      try {
        const result = await sendGroupMessage(groups.active.id, { content: text });
        if (result?.message) {
          setGroups(g => ({ ...g, messages: [...g.messages, result.message] }));
        }
      } catch (err) {
        toast?.error?.("Failed to send message");
      }
    },

    // Create group
    create: async (e) => {
      e?.preventDefault();
      const { newGroupName, selectedMembers } = groups.ui;
      const members = asArray(selectedMembers);
      if (!newGroupName?.trim() || members.length === 0) {
        toast?.error?.("Please enter a group name and select at least one member");
        return;
      }
      try {
        const result = await createGroup({
          name: newGroupName.trim(),
          memberIds: members,
        });
        setGroups(g => ({
          ...g,
          list: [result.group, ...g.list],
          ui: { ...g.ui, createOpen: false, newGroupName: "", selectedMembers: [] }
        }));
        toast?.success?.("Group created!");
      } catch (err) {
        toast?.error?.(err.message || "Failed to create group");
      }
    },

    // Leave group
    leave: async (groupId) => {
      console.log("[Leave] Function called with groupId:", groupId);
      if (!confirm("Leave this group?")) {
        console.log("[Leave] User cancelled");
        return;
      }
      try {
        console.log("[Leave] Calling API...");
        await leaveGroup(groupId);
        console.log("[Leave] API success, updating state");
        setGroups(g => ({
          ...g,
          list: (g.list || []).filter(grp => grp.id !== groupId),
          active: g.active?.id === groupId ? null : g.active,
          messages: g.active?.id === groupId ? [] : g.messages,
        }));
        toast?.success?.("Left group");
        console.log("[Leave] Success toast shown");
      } catch (err) {
        console.error("[Leave] Error:", err);
        toast?.error?.(err.message || "Failed to leave group");
      }
    },

    // Rename group
    rename: async (e) => {
      e?.preventDefault();
      const { renameValue } = groups.ui;
      if (!renameValue?.trim() || !groups.active) return;
      try {
        await renameGroup(groups.active.id, renameValue.trim());
        setGroups(g => ({
          ...g,
          list: g.list.map(grp =>
            grp.id === groups.active.id ? { ...grp, name: renameValue.trim() } : grp
          ),
          active: g.active ? { ...g.active, name: renameValue.trim() } : null,
          ui: { ...g.ui, renameOpen: false, renameValue: "" }
        }));
        toast?.success?.("Group renamed!");
      } catch (err) {
        toast?.error?.(err.message || "Failed to rename group");
      }
    },

    // Invite to group
    invite: async (e) => {
      e?.preventDefault();
      const { inviteUsername } = groups.ui;
      if (!inviteUsername?.trim() || !groups.active) return;
      try {
        await inviteToGroup(groups.active.id, inviteUsername.trim());
        setGroups(g => ({ ...g, ui: { ...g.ui, inviteOpen: false, inviteUsername: "" } }));
        toast?.success?.("Friend invited!");
      } catch (err) {
        toast?.error?.(err.message || "Failed to invite");
      }
    },

    // Update UI state
    setUI: (updates) => setGroups(g => ({ ...g, ui: { ...g.ui, ...updates } })),
    
    // Toggle call minimized
    toggleMinimized: () => setGroups(g => ({ ...g, call: { ...g.call, minimized: !g.call.minimized } })),
  };


  const sortedFriends = useMemo(() => [...friends].sort((a, b) => a.username.localeCompare(b.username)), [friends]);
  const filteredFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    if (!q) return sortedFriends;
    return (sortedFriends || []).filter((f) => f.username.toLowerCase().includes(q));
  }, [sortedFriends, friendFilter]);

  const dmList = useMemo(() => {
    return friends
      .map((f) => {
        const list = dmByUserId[f.id] || [];
        const last = list.length ? list[list.length - 1] : null;
        return {
          friend: f,
          unread: dmUnread[f.id] || 0,
          preview: last?.text ?? (last?.media ? `📎 ${last.media.originalName || "media"}` : ""),
          timeLabel: last ? formatRelativeTime(last.timestamp) : "",
          sortKey: last ? new Date(last.timestamp).getTime() : 0,
        };
      })
      .sort((a, b) => {
        if (b.unread !== a.unread) return b.unread - a.unread;
        return b.sortKey - a.sortKey;
      });
  }, [friends, dmUnread, dmByUserId]);

  const dmGrouped = useMemo(() => groupDmRows(dmMessages), [dmMessages]);

  const notificationUnread = useMemo(() => (notifications || []).filter((n) => !n.read).length, [notifications]);
  const totalDmUnread = useMemo(() => Object.values(dmUnread).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0), [dmUnread]);
  const globalUnread = totalDmUnread + notificationUnread;

  const flushTyping = useCallback(() => {
    if (wasTypingRef.current) {
      if (activeDmUser) onTypingDmStop?.(activeDmUser.id);
      wasTypingRef.current = false;
    }
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
  }, [activeDmUser, onTypingDmStop]);

  useEffect(() => () => flushTyping(), [flushTyping]);

  // Load reactions when DM user changes - with cancellation
  useEffect(() => {
    const controller = new AbortController();
    
    const loadReactions = async () => {
      if (!activeDmUser || !me) return;
      
      const convId = [me.id, activeDmUser.id].sort().join("::");
      const token = localStorage.getItem("descall_token");
      const currentUserId = activeDmUser.id; // Capture for guard check
      
      console.log("[ChatLayout] Fetching DM reactions for:", convId);
      
      try {
        const response = await fetch(
          `${API_BASE_URL}/reactions/conversation/dm/${convId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );
        
        console.log("[ChatLayout] DM reactions response:", response.status, response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("[ChatLayout] Failed to load DM reactions:", response.status, errorText);
          return;
        }
        
        const data = await response.json();
        console.log("[ChatLayout] DM reactions loaded:", data);
        
        // GUARD: Only update if still on same user and not aborted
        if (!controller.signal.aborted && activeDmRef.current?.id === currentUserId) {
          if (data?.reactions) {
            setMessageReactions(data.reactions);
            console.log("[ChatLayout] Set DM messageReactions:", data.reactions);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("[ChatLayout] Error loading DM reactions:", err);
        }
      }
    };
    
    loadReactions();
    
    return () => {
      controller.abort();
    };
  }, [activeDmUser, me]);

  const handleMessagesScroll = (e) => {
    const el = e.target;
    if (el.scrollTop < 100 && activeDmUser && !loadingOlderDm && dmHasMore) loadOlderDm?.();
  };

  const handleComposerChange = (e) => {
    const v = e.target.value;
    setComposer(v);
    if (!wasTypingRef.current && activeDmUser) {
      wasTypingRef.current = true;
      onTypingDmStart?.(activeDmUser.id);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => flushTyping(), 1800);
  };

  const submitMessage = (event) => {
    event.preventDefault();
    const text = composer.trim();
    if (!text || !activeDmUser) return;
    flushTyping();
    onSendDm(activeDmUser.id, text);
    setComposer("");
    requestAnimationFrame(() => scrollToBottom());
  };

  const submitFriendRequest = (event) => {
    event.preventDefault();
    const target = friendUsername.trim();
    if (!target) return;
    onSendFriendRequest(target);
    setFriendUsername("");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeDmUser) return;
    try {
      setUploading(true);
      const result = await uploadFile(file);
      onSendDmMedia(activeDmUser.id, {
        url: result.url,
        mediaType: result.mediaType,
        mimeType: result.mimeType,
        size: result.size,
        originalName: result.originalName,
      });
      requestAnimationFrame(() => scrollToBottom());
    } catch (err) {
      toast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Send GIF from Giphy
  const handleSendGif = useCallback(async (gif) => {
    console.log("[handleSendGif] Called with gif:", gif, "forGroup:", giphyPickerForGroup, "group:", groups.active?.id, "dmUser:", activeDmUser?.id);
    
    try {
      if (giphyPickerForGroup && groups.active) {
        console.log("[handleSendGif] Sending GIF to group via API:", groups.active.id);
        // Send to group via API
        const result = await sendGroupMessage(groups.active.id, { 
          content: "", 
          mediaUrl: gif.url, 
          mediaType: "gif" 
        });
        if (result?.message) {
          setGroups(g => ({ ...g, messages: [...g.messages, result.message] }));
        }
      } else if (activeDmUser && socket?.connected) {
        console.log("[handleSendGif] Sending GIF to DM via socket:", activeDmUser.id);
        // Send to DM via socket (dm:send exists)
        socket.emit("dm:send", {
          toUserId: activeDmUser.id,
          text: "",
          mediaUrl: gif.url,
          mediaType: "gif",
          mimeType: "image/gif",
          originalName: gif.title || "GIF"
        });
      } else {
        console.error("[handleSendGif] No valid target! Neither group nor DM user found.");
      }
    } catch (err) {
      console.error("[handleSendGif] Error sending GIF:", err);
      toast(err.message || "Failed to send GIF", "error");
    }
    
    requestAnimationFrame(() => scrollToBottom());
    setGiphyPickerOpen(false);
  }, [giphyPickerForGroup, groups.active, activeDmUser, socket, scrollToBottom, setGroups, toast]);

  const inCall = call?.mode === "active" || call?.mode === "outgoing";
  const isOnline = connectionLabel === "Online";
  const typingNamesDm = typingDmUser ? [typingDmUser.username] : [];

  return (
    <div 
      className={`app-root app-root-enhanced ${isMobile ? "mobile-view" : ""} ${!sidebarOpen ? "sidebar-collapsed" : ""}`}
    >
      {/* Desktop Sidebar - Hidden on Mobile */}
      {!isMobile && (
        <>
          <nav className="nav-rail" aria-label="Main">
            <motion.button type="button" className={`rail-btn ${sidebarView === "dms" ? "active" : ""}`} title="Direct messages" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setSidebarView("dms"); }}>
              <MessageSquare size={22} />
            </motion.button>
            <motion.button type="button" className={`rail-btn ${sidebarView === "groups" ? "active" : ""}`} title="Groups" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setSidebarView("groups"); }}>
              <Users size={22} />
            </motion.button>
            <motion.button type="button" className={`rail-btn ${sidebarView === "friends" ? "active" : ""}`} title="Friends" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setSidebarView("friends"); }}>
              <UserPlus size={22} />
            </motion.button>
            <motion.button type="button" className={`rail-btn ${sidebarView === "announcements" ? "active" : ""}`} title="Announcements" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setSidebarView("announcements"); }}>
              <Megaphone size={22} />
              {unreadAnnouncements > 0 && <span className="rail-badge">{unreadAnnouncements > 99 ? "99+" : unreadAnnouncements}</span>}
            </motion.button>
            <motion.button type="button" className={`rail-btn ${notificationsOpen ? "active" : ""}`} title="Notifications" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setNotificationsOpen((o) => !o); }}>
              <Bell size={22} />
              {globalUnread > 0 && <span className="rail-badge">{globalUnread > 99 ? "99+" : globalUnread}</span>}
            </motion.button>
            <motion.button type="button" className={`rail-btn ${sidebarView === "online" ? "active" : ""}`} title="Online" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setSidebarView("online"); }}>
              <Circle size={10} fill="currentColor" />
            </motion.button>
            <div className="rail-divider" />
            <motion.button 
              type="button" 
              className="rail-btn download-btn" 
              title="Download App"
              whileHover={{ scale: 1.04 }} 
              whileTap={{ scale: 0.96 }} 
              onClick={() => { 
                playClickSound(); 
                window.open('https://descall-1.onrender.com/', '_blank'); 
              }}
            >
              <Download size={22} />
            </motion.button>
            <div className="rail-spacer" />
            <motion.button 
              type="button" 
              className={`rail-btn subtle ${!sidebarOpen ? "sidebar-collapsed-btn" : ""}`} 
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} 
              whileHover={{ scale: 1.08, rotate: sidebarOpen ? 0 : 180 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => { playClickSound(); setSidebarOpen((o) => !o); }}
              animate={{ 
                backgroundColor: sidebarOpen ? "rgba(255, 255, 255, 0.05)" : "rgba(103, 120, 255, 0.2)",
                boxShadow: !sidebarOpen ? "0 0 12px rgba(103, 120, 255, 0.4)" : "none"
              }}
            >
              <motion.div
                animate={{ rotate: sidebarOpen ? 0 : 180 }}
                transition={{ duration: 0.3 }}
              >
                <PanelLeftClose size={20} />
              </motion.div>
            </motion.button>
            <motion.button type="button" className={`rail-btn subtle ${customizationOpen ? "active" : ""}`} title="Customize" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setCustomizationOpen(true); }}>
              <Palette size={20} />
            </motion.button>
            <motion.button type="button" className="rail-btn subtle" title="Settings" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => { playClickSound(); setSettingsOpen(true); }}>
              <Settings size={20} />
            </motion.button>
          </nav>

          <aside
            className="sidebar-secondary"
            style={{ overflow: "hidden", width: sidebarOpen ? '300px' : '0px', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
        <motion.div 
          className="sidebar-inner"
          initial={false}
          animate={{ 
            opacity: sidebarOpen ? 1 : 0,
            x: sidebarOpen ? 0 : -20
          }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          <div className="sidebar-brand">
            <span className="brand-mark">Descall</span>
            <span className={`conn-pill ${isOnline ? "on" : "off"}`}>{connectionLabel}</span>
          </div>
          {authError && reconnectState !== "connected" && <div className="sidebar-error">{authError}</div>}

          {sidebarView === "dms" && (
            <div className="sidebar-section grow">
              <h4>Direct messages</h4>
              <div className="scroll-list custom-scroll">
                {(dmList || []).map(({ friend, unread, preview, timeLabel }) => (
                  <motion.button
                    key={friend.id}
                    type="button"
                    className={`dm-item ${activeDmUser?.id === friend.id ? "active" : ""}`}
                    onClick={() => { playClickSound(); setGroups(g => ({ ...g, active: null })); try { localStorage.removeItem("descall_active_group"); } catch {}; onOpenDm(friend); }}
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Avatar name={friend.username} size={34} imageUrl={friend.avatarUrl} />
                    <div className="dm-item-body">
                      <div className="dm-item-top">
                        <span className="dm-name">{friend.username}</span>
                        {timeLabel && <span className="dm-time">{timeLabel}</span>}
                      </div>
                      <div className="dm-preview">
                        {preview || (unread > 0 ? "New messages" : "No messages yet")}
                      </div>
                    </div>
                    {unread > 0 && <span className="dm-badge">{unread > 9 ? "9+" : unread}</span>}
                  </motion.button>
                ))}
                {dmList.length === 0 && <p className="muted small">Add a friend to start a conversation.</p>}
              </div>
            </div>
          )}

          {sidebarView === "friends" && (
            <div className="sidebar-section grow">
              <h4>Add friend</h4>
              <form className="mini-form" onSubmit={submitFriendRequest}>
                <input placeholder="Username" value={friendUsername} onChange={(e) => setFriendUsername(e.target.value)} />
                <RippleButton type="submit" title="Send request"><Plus size={18} /></RippleButton>
              </form>
              <input className="filter-input" placeholder="Search friends..." value={friendFilter} onChange={(e) => setFriendFilter(e.target.value)} />
              <h4>Friends ({filteredFriends.length})</h4>
              <div className="scroll-list custom-scroll">
                {(filteredFriends || []).map((friend) => (
                  <div
                    key={friend.id}
                    className="friend-row"
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setHoverCard({ user: friend, x: Math.min(r.right + 8, window.innerWidth - 280), y: r.top });
                    }}
                    onMouseLeave={() => setHoverCard(null)}
                  >
                    <button type="button" className="list-item" onClick={() => { playClickSound(); onOpenDm(friend); }}>
                      <StatusBadge status={friend.status} />
                      <span className="friend-name">{friend.username}</span>
                    </button>
                    <div className="friend-actions">
                      <button type="button" className="icon-btn" title="Voice call" disabled={inCall} onClick={() => { playClickSound(); call?.startCall(friend, "voice"); }}><Phone size={16} /></button>
                      <button type="button" className="icon-btn" title="Video call" disabled={inCall} onClick={() => { playClickSound(); call?.startCall(friend, "video"); }}><Video size={16} /></button>
                      <button type="button" className="icon-btn" title="DM" onClick={() => { playClickSound(); onOpenDm(friend); }}><MessageSquare size={16} /></button>
                      <button type="button" className="icon-btn danger" title="Remove" onClick={() => { playClickSound(); onRemoveFriend(friend.id); }}><X size={16} /></button>
                    </div>
                  </div>
                ))}
                {filteredFriends.length === 0 && <p className="muted small">No friends match your search.</p>}
              </div>
            </div>
          )}

          {sidebarView === "groups" && (
            <div className="sidebar-section grow">
              <div className="sidebar-section-header">
                <h4>Groups ({groupsList.length})</h4>
                <button 
                  className="btn-icon"
                  onClick={() => { playClickSound(); groupActions.setUI({ createOpen: true }); }}
                  title="Create group"
                >
                  <Plus size={20} />
                </button>
              </div>
              <div className="scroll-list custom-scroll">
                {groupsList.length === 0 ? (
                  <div className="empty-state">
                    <p className="muted">No groups yet</p>
                    <button className="btn-secondary" onClick={() => { playClickSound(); groupActions.setUI({ createOpen: true }); }}>
                      Create your first group
                    </button>
                  </div>
                ) : (
                  groupsList.map((group) => (
                    <motion.button
                      key={group.id}
                      type="button"
                      className={`dm-item ${groups.active?.id === group.id ? "active" : ""}`}
                      onClick={() => { playClickSound(); groupActions.open(group); }}
                      whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <div className="dm-avatar">
                        {group.avatar_url ? (
                          <img src={group.avatar_url} alt={group.name} />
                        ) : (
                          <div className="avatar-fallback">{group.name.charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="dm-meta">
                        <div className="dm-name-row">
                          <span className="dm-name">{group.name}</span>
                          {group.unread > 0 && <span className="dm-badge">{group.unread}</span>}
                        </div>
                        <div className="dm-preview">
                          {group.last_message?.content || "No messages yet"}
                        </div>
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </div>
          )}

          {sidebarView === "online" && (
            <div className="sidebar-section grow">
              <h4>Online ({onlineUsers.length})</h4>
              <div className="scroll-list custom-scroll">
                {(onlineUsers || []).map((user) => (
                  <div key={user.id ?? user.username} className="list-item static online-row">
                    <StatusBadge status={user.status} />
                    <span>{user.username}</span>
                    {user.username === me?.username && <em className="you-tag">you</em>}
                  </div>
                ))}
                {onlineUsers.length === 0 && <p className="muted small">No one is online.</p>}
              </div>
            </div>
          )}

          {sidebarView === "announcements" && (
            <div className="sidebar-section grow">
              <h4>Announcements {unreadAnnouncements > 0 && <span className="badge">{unreadAnnouncements}</span>}</h4>
              <div className="scroll-list custom-scroll">
                {announcements.length === 0 && <p className="muted small">No announcements yet.</p>}
                {announcements.map((a) => {
                  const isUnread = !readAnnouncementIds.has(a.id);
                  return (
                    <motion.div
                      key={a.id}
                      className={`announcement-card ${isUnread ? "unread" : ""}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ borderLeft: `4px solid ${a.color}` }}
                    >
                      <div className="announcement-header">
                        <h5>{a.title} {isUnread && <span className="unread-dot" />}</h5>
                        <span className={`priority-badge ${a.priority}`}>{a.priority}</span>
                      </div>
                      <p className="announcement-content">{a.content}</p>
                      <span className="announcement-date">{new Date(a.created_at).toLocaleString()}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="sidebar-section compact">
            <h4>Incoming requests</h4>
            {friendRequests.length === 0 && <p className="muted small">None</p>}
            {(friendRequests || []).map((req) => (
              <div key={req.id} className="request-row compact-req">
                <span>{req.username}</span>
                <div>
                  <RippleButton type="button" className="btn-mini ok" onClick={() => { playClickSound(); onAcceptFriend(req.id); }}>Accept</RippleButton>
                  <RippleButton type="button" className="btn-mini no" onClick={() => { playClickSound(); onDeclineFriend(req.id); }}>Decline</RippleButton>
                </div>
              </div>
            ))}
          </div>

          {friendNotice && <div className="notice-banner">{friendNotice}</div>}

          <div className="user-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="user-avatar-wrap" onClick={() => setProfileUser({ username: me.username, userId: me.id, avatarUrl: me.avatar_url })}>
              <Avatar name={me.username} size={36} imageUrl={me.avatar_url} />
            </button>
            <div className="user-meta">
              <div className="user-name">{me.username}</div>
              <select value={myStatus} onChange={(e) => onStatusChange(e.target.value)} className="status-mini">
                <option value="online">Online</option>
                <option value="idle">Idle</option>
                <option value="dnd">Do not disturb</option>
                <option value="invisible">Invisible</option>
              </select>
            </div>
            <RippleButton type="button" className="logout-mini" onClick={onLogout}><LogOut size={16} /></RippleButton>
          </div>
        </motion.div>
      </aside>
        </>
      )}

      <section className="panel main-panel">
        <header className="panel-header glass-header">
          <div className="panel-title-wrap">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDmUser ? `dm-${activeDmUser.id}` : groups.active ? `group-${groups.active.id}` : "empty"}
                className="panel-title-block"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
              >
                <strong className="panel-title">
                  {activeDmUser ? `@${activeDmUser.username}` : groups.active ? groups.active.name : "Descall"}
                </strong>
                <span className="panel-sub">
                  {activeDmUser ? "Direct message" : groups.active ? "Group chat" : "Select a conversation"}
                </span>
                {groups.active && (
                  <div className="group-members-info">
                    <Users size={14} />
                    <span className="member-count">{groups.members?.length || 0} members</span>
                    <div className="member-avatars">
                      {(groups.members || []).slice(0, 5).map((member) => (
                        <Avatar 
                          key={member.id} 
                          name={member.username} 
                          size={24} 
                          imageUrl={member.avatar_url} 
                          className="member-avatar-sm"
                        />
                      ))}
                      {(groups.members?.length || 0) > 5 && (
                        <span className="member-more">+{groups.members.length - 5}</span>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
            {activeDmUser && (
              <div className="header-call-btns">
                <RippleButton type="button" className="header-call" disabled={inCall} onClick={() => call?.startCall(activeDmUser, "voice")} title="Voice call">
                  <Phone size={18} />
                </RippleButton>
                <RippleButton type="button" className="header-call" disabled={inCall} onClick={() => call?.startCall(activeDmUser, "video")} title="Video call">
                  <Video size={18} />
                </RippleButton>
              </div>
            )}
            {groups.active && (
              <>
                {/* Call Buttons */}
                <div className="header-call-btns">
                  <RippleButton 
                    type="button" 
                    className="header-call-btn voice" 
                    disabled={inCall || !groupCall} 
                    onClick={() => groupCall?.startGroupCall?.(groups.active.id, "voice", (groups.active?.memberIds || []).filter((id) => id !== me?.id))} 
                    title="Group voice call"
                  >
                    <div className="call-btn-icon">
                      <Phone size={18} />
                    </div>
                    <span className="call-btn-label">Voice</span>
                  </RippleButton>
                  <RippleButton 
                    type="button" 
                    className="header-call-btn video" 
                    disabled={inCall || !groupCall} 
                    onClick={() => groupCall?.startGroupCall?.(groups.active.id, "video", (groups.active?.memberIds || []).filter((id) => id !== me?.id))} 
                    title="Group video call"
                  >
                    <div className="call-btn-icon">
                      <Video size={18} />
                    </div>
                    <span className="call-btn-label">Video</span>
                  </RippleButton>
                </div>

                {/* Group Management Actions */}
                <div className="header-group-actions">
                  <div className="group-actions-menu">
                    <RippleButton 
                      type="button" 
                      className="group-action-btn primary" 
                      onClick={() => { playClickSound(); console.log("[Invite] Opening invite modal"); groupActions.setUI({ inviteOpen: true }); }} 
                      title="Invite friend"
                    >
                      <div className="action-btn-content">
                        <div className="action-icon-wrapper invite">
                          <UserPlus size={16} />
                        </div>
                        <span className="action-label">Invite</span>
                      </div>
                    </RippleButton>
                    
                    <RippleButton 
                      type="button" 
                      className="group-action-btn secondary" 
                      onClick={() => { groupActions.setUI({ renameValue: groups.active.name, renameOpen: true }); }} 
                      title="Rename group"
                    >
                      <div className="action-btn-content">
                        <div className="action-icon-wrapper rename">
                          <Settings size={16} />
                        </div>
                        <span className="action-label">Rename</span>
                      </div>
                    </RippleButton>
                    
                    <RippleButton 
                      type="button" 
                      className="group-action-btn danger" 
                      onClick={() => { playClickSound(); console.log("[Leave] Leaving group:", groups.active?.id); groupActions.leave(groups.active.id); }} 
                      title="Leave group"
                    >
                      <div className="action-btn-content">
                        <div className="action-icon-wrapper leave">
                          <LogOut size={16} />
                        </div>
                        <span className="action-label">Leave</span>
                      </div>
                    </RippleButton>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="panel-header-right">
            <span className={`connection-chip ${isOnline ? "online" : "reconnect"}`}>{connectionLabel}</span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={isMobile ? `mobile-${activeMobileView}` : activeDmUser ? `dm-${activeDmUser.id}` : groups.active ? `group-${groups.active.id}` : "empty"}
            className="messages-wrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {/* Feedback Button - Top Right of Chat Area */}
            {me && (
              <div className="messages-feedback-btn">
                <UserFeedbackButton socket={socket} user={me} />
              </div>
            )}
            
            <div className="messages custom-scroll" ref={messagesRef} onScroll={handleMessagesScroll}>
              {loadingOlderDm && activeDmUser && <div className="load-older-banner">Loading older messages…</div>}

              {/* Mobile View Switcher */}
              {isMobile && activeMobileView === "dms" && !activeDmUser && !groups.active && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <h4>Direct Messages</h4>
                    {(dmList || []).length === 0 ? (
                      <div className="empty-state glass">
                        <h4>No conversations yet</h4>
                        <p>Go to Friends to start chatting</p>
                      </div>
                    ) : (
                      <div className="mobile-list">
                        {(dmList || []).map(({ friend, unread, preview, timeLabel }) => (
                          <motion.button
                            key={friend.id}
                            className="mobile-list-item"
                            onClick={() => {
                              setGroups(g => ({ ...g, active: null }));
                              try { localStorage.removeItem("descall_active_group"); } catch {}
                              onOpenDm(friend);
                            }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Avatar name={friend.username} size={48} imageUrl={friend.avatarUrl} />
                            <div className="mobile-list-body">
                              <div className="mobile-list-top">
                                <span className="mobile-list-name">{friend.username}</span>
                                {timeLabel && <span className="mobile-list-time">{timeLabel}</span>}
                              </div>
                              <div className="mobile-list-preview">{preview || "No messages"}</div>
                            </div>
                            {unread > 0 && <span className="mobile-badge">{unread > 9 ? "9+" : unread}</span>}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {isMobile && activeMobileView === "groups" && !groups.active && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <div className="mobile-section-header">
                      <h4>Groups</h4>
                      <button className="mobile-fab" onClick={() => groupActions.setUI({ createOpen: true })}>
                        <Plus size={20} />
                      </button>
                    </div>
                    {(groupsList || []).length === 0 ? (
                      <div className="empty-state glass">
                        <h4>No groups yet</h4>
                        <p>Create a group to start chatting with multiple friends</p>
                      </div>
                    ) : (
                      <div className="mobile-list">
                        {(groupsList || []).map((group) => (
                          <motion.button
                            key={group.id}
                            className="mobile-list-item"
                            onClick={() => groupActions.open(group)}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="mobile-group-avatar">{group.name?.charAt(0).toUpperCase()}</div>
                            <div className="mobile-list-body">
                              <div className="mobile-list-top">
                                <span className="mobile-list-name">{group.name}</span>
                                <span className="mobile-list-time">{group.memberCount} members</span>
                              </div>
                              <div className="mobile-list-preview">Click to open group chat</div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {isMobile && activeMobileView === "calls" && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <h4>Recent Calls</h4>
                    <div className="empty-state glass">
                      <Phone size={48} className="mobile-icon-muted" />
                      <h4>No recent calls</h4>
                      <p>Start a call from a DM or Group chat</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {isMobile && activeMobileView === "friends" && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <div className="mobile-section-header">
                      <h4>Friends</h4>
                    </div>
                    <form className="mobile-search-form" onSubmit={submitFriendRequest}>
                      <input 
                        className="mobile-search-input" 
                        placeholder="Add friend by username..." 
                        value={friendUsername} 
                        onChange={(e) => setFriendUsername(e.target.value)} 
                      />
                      <button type="submit" className="mobile-fab">
                        <Plus size={20} />
                      </button>
                    </form>
                    {(filteredFriends || []).length === 0 ? (
                      <div className="empty-state glass">
                        <UserPlus size={48} className="mobile-icon-muted" />
                        <h4>No friends yet</h4>
                        <p>Add friends to start chatting</p>
                      </div>
                    ) : (
                      <div className="mobile-list">
                        {(filteredFriends || []).map((friend) => (
                          <motion.div
                            key={friend.id}
                            className="mobile-friend-item"
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="mobile-friend-info" onClick={() => onOpenDm(friend)}>
                              <StatusBadge status={friend.status} />
                              <span className="mobile-friend-name">{friend.username}</span>
                            </div>
                            <div className="mobile-friend-actions">
                              <button className="mobile-icon-btn" onClick={() => call?.startCall(friend, "voice")}>
                                <Phone size={16} />
                              </button>
                              <button className="mobile-icon-btn" onClick={() => call?.startCall(friend, "video")}>
                                <Video size={16} />
                              </button>
                              <button className="mobile-icon-btn danger" onClick={() => onRemoveFriend(friend.id)}>
                                <X size={16} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {isMobile && activeMobileView === "profile" && (
                <motion.div className="mobile-view-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="mobile-section">
                    <div className="empty-state glass">
                      <User size={48} className="mobile-icon-muted" />
                      <h4>Profile</h4>
                      <p>Profile customization coming soon</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {!isMobile && !activeDmUser && !groups.active && (
                <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <h4>Welcome to Descall</h4>
                  <p>Select a friend or start a new conversation to begin messaging.</p>
                </motion.div>
              )}

              {activeDmUser && dmMessages.length === 0 && (
                <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <h4>Conversation with {activeDmUser.username}</h4>
                  <p>No messages yet. Say hello or share a file.</p>
                </motion.div>
              )}

              {activeDmUser && (dmGrouped || []).map(({ msg, compact }) => {
                const fromSelf = msg.from?.id === me.id;
                return (
                  <motion.article
                    key={msg.id}
                    className={`dm-msg ${fromSelf ? "own" : ""} ${compact ? "dm-compact" : ""}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {!compact ? (
                      <button type="button" className="dm-msg-avatar" onClick={() => setProfileUser({ username: msg.from?.username ?? "?", userId: msg.from?.id, avatarUrl: msg.from?.avatar_url })}>
                        <Avatar name={msg.from?.username ?? "?"} size={36} imageUrl={msg.from?.avatar_url} />
                      </button>
                    ) : (
                      <div className="msg-avatar-spacer sm" aria-hidden />
                    )}
                    <div>
                      {!compact && (
                        <div className="msg-meta-line">
                          <strong>{msg.from?.username ?? "?"}</strong>
                          <span className="msg-time-wrap" data-tooltip={new Date(msg.timestamp).toLocaleString()}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                      )}
                      {compact && (
                        <span className="msg-time-inline msg-time-wrap" data-tooltip={new Date(msg.timestamp).toLocaleString()}>
                          {formatTime(msg.timestamp)}
                        </span>
                      )}
                      {msg.media && <MediaMessage media={msg.media} onOpenLightbox={setLightboxUrl} isOwn={fromSelf} />}
                      
                      {/* Voice message from mediaUrl */}
                      {(msg.mediaUrl || msg.media_url) && (msg.mediaType === 'audio' || msg.media_type === 'audio') && (
                        <div className="dm-message-voice">
                          <VoiceMessagePlayer 
                            audioUrl={msg.mediaUrl || msg.media_url} 
                            duration={msg.duration || 0}
                            isOwn={fromSelf}
                          />
                        </div>
                      )}
                      
                      {/* Message text or edit UI */}
                      {editingMessage?.id === msg.id ? (
                        <MessageEditUI 
                          defaultValue={editingMessage.text}
                          onSave={saveEditedMessage}
                          onCancel={cancelEditing}
                        />
                      ) : (
                        <>
                          {msg.text && (
                            <p className="dm-msg-text">
                              {msg.text}
                              {msg.editedAt && <span className="edited-indicator"> (edited)</span>}
                            </p>
                          )}
                        </>
                      )}
                      
                      {/* Edit button for own messages */}
                      {fromSelf && !editingMessage && (
                        <button 
                          className="msg-edit-btn" 
                          onClick={() => { playClickSound(); startEditingMessage(msg, 'dm'); }}
                          title="Edit message"
                        >
                          Edit
                        </button>
                      )}
                      
                      {fromSelf && (
                        <div className="dm-ack" aria-label="Delivery status">
                          {msg.readAt ? <span className="ack-read">Read</span> : msg.deliveredAt ? <span className="ack-delivered">Delivered</span> : <span className="ack-sent">Sent</span>}
                        </div>
                      )}
                      <MessageReactions
                        messageId={msg.id}
                        conversationType="dm"
                        conversationId={[me.id, activeDmUser.id].sort().join("::")}
                        reactions={messageReactions[msg.id] || []}
                        currentUserId={me.id}
                        socket={socket}
                      />
                    </div>
                  </motion.article>
                );
              })}

              <AnimatePresence>
                {activeDmUser && typingNamesDm.length > 0 && <TypingIndicator key="td" names={typingNamesDm} />}
              </AnimatePresence>

              {/* Group Messages */}
              {groups.active && groupsMessages.length === 0 && (
                <motion.div className="empty-state" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <h4>Group: {groups.active.name}</h4>
                  <p>No messages yet. Start the conversation!</p>
                </motion.div>
              )}

              {groups.active && groupsMessages.map((msg) => {
                const fromSelf = msg.sender?.id === me?.id;
                return (
                  <motion.article
                    key={msg.id}
                    className={`dm-msg ${fromSelf ? "own" : ""}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <button type="button" className="dm-msg-avatar" onClick={() => setProfileUser({ username: msg.sender?.username ?? "?", userId: msg.sender?.id, avatarUrl: msg.sender?.avatar_url })}>
                      <Avatar name={msg.sender?.username ?? "?"} size={36} imageUrl={msg.sender?.avatar_url} />
                    </button>
                    <div>
                      <div className="msg-meta-line">
                        <span className="msg-author">{msg.sender?.username}</span>
                        <span className="msg-time msg-time-wrap" data-tooltip={new Date(msg.created_at).toLocaleString()}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      
                      {/* Media (GIFs, images, audio) */}
                      {(msg.mediaUrl || msg.media_url || msg.media) && (
                        <>
                          {(msg.mediaType === 'audio' || msg.media_type === 'audio' || msg.media?.type === 'audio') ? (
                            <div className="dm-message-voice">
                              {(() => {
                                const url = msg.mediaUrl || msg.media_url || msg.media?.url;
                                const dur = msg.duration || msg.media?.duration || 0;
                                console.log('[VoiceMessage] Rendering for URL:', url, 'duration:', dur, 'mediaType:', msg.mediaType || msg.media_type || msg.media?.type);
                                return <VoiceMessagePlayer audioUrl={url} duration={dur} isOwn={fromSelf} />;
                              })()}
                            </div>
                          ) : (
                            <div className="gif-message">
                              <img 
                                src={msg.mediaUrl || msg.media_url || msg.media?.url} 
                                alt={msg.mediaType || msg.media_type || msg.media?.type || "Media"}
                                onClick={() => setLightboxUrl(msg.mediaUrl || msg.media_url || msg.media?.url)}
                                style={{ cursor: "pointer" }}
                              />
                            </div>
                          )}
                        </>
                      )}
                      
                      {/* Message text or edit UI */}
                      {editingMessage?.id === msg.id ? (
                        <MessageEditUI 
                          defaultValue={editingMessage.text}
                          onSave={saveEditedMessage}
                          onCancel={cancelEditing}
                        />
                      ) : (
                        msg.content && (
                          <p className="dm-msg-text">
                            {msg.content}
                            {msg.isEdited && <span className="edited-indicator"> (edited)</span>}
                          </p>
                        )
                      )}
                      
                      {/* Edit button for own messages */}
                      {fromSelf && !editingMessage && (
                        <button 
                          className="msg-edit-btn" 
                          onClick={() => { playClickSound(); startEditingMessage({ id: msg.id, text: msg.content }, 'group'); }}
                          title="Edit message"
                        >
                          Edit
                        </button>
                      )}
                      
                      <MessageReactions
                        messageId={msg.id}
                        conversationType="group"
                        conversationId={groups.active.id}
                        reactions={messageReactions[msg.id] || []}
                        currentUserId={me.id}
                        socket={socket}
                      />
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* DM Composer */}
        {activeDmUser && (
          <form
            className={`composer glass-composer ${inCall ? "composer-dimmed" : ""}`}
            onSubmit={submitMessage}
            onBlur={() => flushTyping()}
          >
            <input
              placeholder={`Message @${activeDmUser.username}`}
              value={composer}
              onChange={handleComposerChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden-file-input"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            {/* Voice Recording UI */}
            {isRecording ? (
              <div className="voice-recording-ui">
                <span className="recording-indicator">
                  <span className="recording-dot"></span>
                  {formattedDuration}
                </span>
                <button type="button" className="voice-cancel-btn" onClick={cancelRecording} title="İptal">
                  <X size={18} />
                </button>
                <button type="button" className="voice-send-btn" onClick={stopRecording} title="Gönder">
                  <Send size={18} />
                </button>
              </div>
            ) : audioBlobRef.current ? (
              <div className="voice-preview-ui">
                <div className="voice-inline-preview">
                  <Play size={16} />
                  <span className="voice-duration-text">{recordingDuration}s</span>
                </div>
                <button type="button" className="voice-cancel-btn" onClick={resetRecording} title="Cancel">
                  <X size={18} />
                </button>
                <button type="button" className="voice-send-btn" onClick={sendVoiceMessage} disabled={uploading} title="Send">
                  {uploading ? <Clock size={18} /> : <Send size={18} />}
                </button>
              </div>
            ) : (
              <>
                <RippleButton type="button" className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file">
                  {uploading ? <Clock size={18} /> : <Paperclip size={18} />}
                </RippleButton>
                <button 
                  type="button" 
                  className="voice-btn"
                  onClick={startRecording}
                  title="Sesli mesaj"
                >
                  <Mic size={18} />
                </button>
                <button 
                  type="button" 
                  className="gif-btn"
                  onClick={() => { playClickSound(); setGiphyPickerForGroup(false); setGiphyPickerOpen(true); }}
                  title="Send GIF"
                >
                  GIF
                </button>
                <RippleButton type="submit"><Send size={18} /></RippleButton>
              </>
            )}
          </form>
        )}

        {/* Group Composer */}
        {groups.active && (
          <form
            className={`composer glass-composer ${inCall ? "composer-dimmed" : ""}`}
            onSubmit={(e) => { 
              e.preventDefault(); 
              console.log("[Group Submit] Sending message:", groups.ui.groupComposer, "to group:", groups.active?.id, "socket connected:", socket?.connected);
              if (!socket?.connected) {
                console.error("[Group Submit] Socket not connected!");
                return;
              }
              if (!groups.ui.groupComposer?.trim()) {
                console.log("[Group Submit] Empty message, not sending");
                return;
              }
              groupActions.sendMessage(groups.ui.groupComposer);
              groupActions.setUI({ groupComposer: "" });
            }}
          >
            <input
              placeholder={`Message #${groups.active.name}`}
              value={groups.ui.groupComposer || ""}
              onChange={(e) => groupActions.setUI({ groupComposer: e.target.value })}
            />
            {/* Voice Recording UI for Group */}
            {isRecording ? (
              <div className="voice-recording-ui">
                <span className="recording-indicator">
                  <span className="recording-dot"></span>
                  {formattedDuration}
                </span>
                <button type="button" className="voice-cancel-btn" onClick={cancelRecording} title="İptal">
                  <X size={18} />
                </button>
                <button type="button" className="voice-send-btn" onClick={stopRecording} title="Gönder">
                  <Send size={18} />
                </button>
              </div>
            ) : audioBlobRef.current ? (
              <div className="voice-preview-ui">
                <div className="voice-inline-preview">
                  <Play size={16} />
                  <span className="voice-duration-text">{recordingDuration}s</span>
                </div>
                <button type="button" className="voice-cancel-btn" onClick={resetRecording} title="Cancel">
                  <X size={18} />
                </button>
                <button type="button" className="voice-send-btn" onClick={sendGroupVoiceMessage} disabled={uploading} title="Send">
                  {uploading ? <Clock size={18} /> : <Send size={18} />}
                </button>
              </div>
            ) : (
              <>
                <button 
                  type="button" 
                  className="voice-btn"
                  onClick={startRecording}
                  title="Sesli mesaj"
                >
                  <Mic size={18} />
                </button>
                <button 
                  type="button" 
                  className="gif-btn"
                  onClick={() => { playClickSound(); setGiphyPickerForGroup(true); setGiphyPickerOpen(true); }}
                  title="Send GIF"
                >
                  GIF
                </button>
                <RippleButton type="submit">Send</RippleButton>
              </>
            )}
          </form>
        )}

        {/* Giphy Picker */}
        <GiphyPicker 
          isOpen={giphyPickerOpen}
          onClose={() => setGiphyPickerOpen(false)}
          onSelectGif={handleSendGif}
        />

        {/* User Feedback Button */}

      <AnimatePresence>
        {notificationsOpen && (
          <motion.aside
            className="notification-drawer glass"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <header className="notif-head">
              <h3>Notifications</h3>
              <button type="button" className="icon-btn" onClick={() => setNotificationsOpen(false)}>×</button>
            </header>
            {notificationUnread > 0 && (
              <div className="notif-actions">
                <button type="button" className="link-btn" onClick={() => onNotificationReadAll?.()}>Mark all read</button>
              </div>
            )}
            <div className="notif-list custom-scroll">
              {notifications.length === 0 && <p className="muted small pad">No notifications.</p>}
              {(notifications || []).map((n) => (
                <motion.button
                  key={n.id}
                  type="button"
                  className={`notif-item ${n.read ? "read" : ""}`}
                  onClick={() => { if (!n.read) onNotificationRead?.(n.id); }}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-body">{n.body}</span>
                  <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
                </motion.button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <audio ref={call?.remoteAudioRef} autoPlay playsInline className="hidden-audio" />

      {/* Call UI - Only show when there's an active call */}
      {(call?.isInCall || call?.isCalling || call?.isReceiving) && (
        <CallBar call={call} peerScreenSharing={peerScreenSharing} />
      )}

      <AnimatePresence>
        {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      </AnimatePresence>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} wide>
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          compactBlur={compactBlur}
          setCompactBlur={setCompactBlur}
          reduceMotion={reduceMotion}
          setReduceMotion={setReduceMotion}
          theme={theme}
          setTheme={setTheme}
          fontSize={fontSize}
          setFontSize={setFontSize}
          borderRadius={borderRadius}
          setBorderRadius={setBorderRadius}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          uiDensity={uiDensity}
          setUiDensity={setUiDensity}
          messageBubbleStyle={messageBubbleStyle}
          setMessageBubbleStyle={setMessageBubbleStyle}
          me={me}
          onLogout={() => { setSettingsOpen(false); onLogout(); }}
        />
      </Modal>

      {/* Create Group Modal */}
      <Modal open={groups.ui.createOpen} onClose={() => groupActions.setUI({ createOpen: false })}>
        <div className="create-group-modal modern-modal">
          <div className="modal-header">
            <h3>Create Group</h3>
            <button type="button" className="modal-close" onClick={() => groupActions.setUI({ createOpen: false })}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={groupActions.create}>
            <label className="modern-field">
              <span>Group Name</span>
              <input
                type="text"
                value={groups.ui.newGroupName}
                onChange={(e) => groupActions.setUI({ newGroupName: e.target.value })}
                placeholder="Enter group name"
                maxLength={50}
                required
                className="modern-input"
              />
              <small className="char-count">{groups.ui.newGroupName.length}/50</small>
            </label>

            <div className="cg-members modern-members">
              <div className="members-header">
                <span>Select Members (max 15)</span>
                <small className="member-count">{groups.ui.selectedMembers.length}/14 friends selected</small>
              </div>
              <div className="cg-friends-list modern-friends-list">
                {(friends || []).map((friend) => (
                  <label key={friend.id} className="cg-friend-item modern-friend-item">
                    <input
                      type="checkbox"
                      checked={groups.ui.selectedMembers.includes(friend.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (groups.ui.selectedMembers.length < 14) {
                            groupActions.setUI({ selectedMembers: [...groups.ui.selectedMembers, friend.id] });
                          }
                        } else {
                          groupActions.setUI({ selectedMembers: (groups.ui.selectedMembers || []).filter((id) => id !== friend.id) });
                        }
                      }}
                      disabled={!groups.ui.selectedMembers.includes(friend.id) && groups.ui.selectedMembers.length >= 14}
                    />
                    <Avatar src={friend.avatar_url} alt={friend.username} size={32} />
                    <span>{friend.username}</span>
                  </label>
                ))}
                {friends.length === 0 && (
                  <p className="muted small empty-hint">Add friends first to create a group</p>
                )}
              </div>
            </div>

            <div className="cg-actions modern-actions">
              <RippleButton type="button" className="btn-secondary modern-btn" onClick={() => groupActions.setUI({ createOpen: false })}>
                Cancel
              </RippleButton>
              <RippleButton
                type="submit"
                className="btn-primary modern-btn"
                disabled={!groups.ui.newGroupName.trim() || groups.ui.selectedMembers.length === 0}
              >
                Create Group
              </RippleButton>
            </div>
          </form>
        </div>
      </Modal>

      {/* Rename Group Modal */}
      <Modal open={groups.ui.renameOpen} onClose={() => groupActions.setUI({ renameOpen: false })}>
        <div className="create-group-modal modern-modal">
          <div className="modal-header">
            <h3>Rename Group</h3>
            <button type="button" className="modal-close" onClick={() => groupActions.setUI({ renameOpen: false })}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={groupActions.rename}>
            <label className="modern-field">
              <span>New Group Name</span>
              <input
                type="text"
                value={groups.ui.renameValue}
                onChange={(e) => groupActions.setUI({ renameValue: e.target.value })}
                placeholder="Enter new group name"
                maxLength={50}
                required
                className="modern-input"
              />
              <small className="char-count">{groups.ui.renameValue.length}/50</small>
            </label>

            <div className="cg-actions modern-actions">
              <RippleButton type="button" className="btn-secondary modern-btn" onClick={() => groupActions.setUI({ renameOpen: false })}>
                Cancel
              </RippleButton>
              <RippleButton
                type="submit"
                className="btn-primary modern-btn"
                disabled={!groups.ui.renameValue.trim() || groups.ui.renameValue === groups.active?.name}
              >
                Rename
              </RippleButton>
            </div>
          </form>
        </div>
      </Modal>

      {/* Invite to Group Modal */}
      <Modal open={groups.ui.inviteOpen} onClose={() => groupActions.setUI({ inviteOpen: false })}>
        <div className="create-group-modal modern-modal">
          <div className="modal-header">
            <h3>Invite Friend to Group</h3>
            <button type="button" className="modal-close" onClick={() => groupActions.setUI({ inviteOpen: false })}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={groupActions.invite}>
            <label className="modern-field">
              <span>Friend Username</span>
              <input
                type="text"
                value={groups.ui.inviteUsername}
                onChange={(e) => groupActions.setUI({ inviteUsername: e.target.value })}
                placeholder="Enter friend's username"
                maxLength={50}
                required
                className="modern-input"
              />
            </label>

            <div className="cg-actions modern-actions">
              <RippleButton type="button" className="btn-secondary modern-btn" onClick={() => groupActions.setUI({ inviteOpen: false })}>
                Cancel
              </RippleButton>
              <RippleButton
                type="submit"
                className="btn-primary modern-btn"
                disabled={!groups.ui.inviteUsername.trim()}
              >
                Invite
              </RippleButton>
            </div>
          </form>
        </div>
      </Modal>

      <UserProfilePopover
        open={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={profileUser}
        onlineUsers={onlineUsers}
      />

      <AnimatePresence>
        {hoverCard && (
          <motion.div
            className="hover-card-portal"
            style={{ position: "fixed", left: hoverCard.x, top: hoverCard.y, zIndex: 50 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <UserHoverCard user={hoverCard.user} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Group Call Modal - DM Style */}
      {groupCall?.incomingCall && !groupCall?.isInCall && (
        <div className="voice-modal-overlay group-call-overlay">
          <motion.div
            className="voice-modal group-call-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="group-call-avatar">
              {groupCall.incomingCall.fromUser.username?.charAt(0).toUpperCase()}
            </div>
            <h3>{groupCall.incomingCall.fromUser.username}</h3>
            <p className="group-name">in {groupsList.find((g) => g.id === groupCall.incomingCall.groupId)?.name || "Group"}</p>
            <p className="call-type">Incoming {groupCall.incomingCall.callType} call</p>

            <div className="voice-modal-actions">
              <RippleButton
                type="button"
                className="btn-decline"
                onClick={() => {
                  groupCall?.declineCall?.(groupCall.incomingCall.groupId, groupCall.incomingCall.fromUser.id);
                }}
              >
                Decline
              </RippleButton>
              <RippleButton
                type="button"
                className="btn-accept"
                onClick={() => {
                  groupCall?.acceptGroupCall?.(
                    groupCall.incomingCall.groupId,
                    groupCall.incomingCall.callType,
                    groupCall.incomingCall.fromUser
                  );
                  // Open the group
                  const group = groupsList.find((g) => g.id === groupCall.incomingCall.groupId);
                  if (group) groupActions.open(group);
                }}
              >
                Accept
              </RippleButton>
            </div>
          </motion.div>
        </div>
      )}

      {/* Group Video Conference Overlay - only render when in call */}
      {(call?.isInCall || call?.isCalling || call?.isReceiving || activeGroupCall?.isInCall) && (
        <VideoConference
          key={`${activeGroupCall?.activeGroupId || "none"}-${groups.call.minimized ? "mini" : "full"}`}
          isOpen={call?.isInCall || call?.isCalling || call?.isReceiving || activeGroupCall?.isInCall || false}
          onClose={activeGroupCall?.leaveCall || (() => {})}
          leaveCall={activeGroupCall?.leaveCall || (() => {})}
          minimized={groups.call.minimized}
          onMinimize={() => setGroups(g => ({ ...g, call: { ...g.call, minimized: !g.call.minimized } }))}
          call={activeGroupCall}
          participants={activeGroupCall?.participants || []}
          toggleMute={activeGroupCall?.toggleMute}
          toggleCamera={activeGroupCall?.toggleCamera}
          startScreenShare={activeGroupCall?.startScreenShare}
          stopScreenShare={activeGroupCall?.stopScreenShare}
          onAudioInputChange={activeGroupCall?.setAudioInput}
          onAudioOutputChange={activeGroupCall?.setAudioOutput}
          audioInputDevices={activeGroupCall?.audioInputDevices}
          audioOutputDevices={activeGroupCall?.audioOutputDevices}
          selectedAudioInput={activeGroupCall?.selectedAudioInput}
          selectedAudioOutput={activeGroupCall?.selectedAudioOutput}
          isMuted={activeGroupCall?.isMuted}
          isCameraOn={activeGroupCall?.isCameraOn}
          isScreenSharing={activeGroupCall?.isScreenSharing}
          localStream={activeGroupCall?.localStream}
          remoteStreams={activeGroupCall?.remoteStreams}
          screenStream={activeGroupCall?.screenStream}
        />
      )}

      {/* Profile Customization Modal */}
      <Modal open={customizationOpen} onClose={() => setCustomizationOpen(false)} wide>
        <ProfileCustomizationPanel
          {...profileCustomization}
          onClose={() => setCustomizationOpen(false)}
          me={me}
          refreshMe={refreshMe}
        />
      </Modal>

      {/* Mobile UI Components */}
      {isMobile && (
        <>
          {/* Mobile Header */}
          <div className="mobile-header">
            <div className="mobile-header-title">Descall</div>
            <div className="mobile-header-actions">
              <button
                className="mobile-header-btn touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setNotificationsOpen(true);
                }}
              >
                <Bell size={20} />
                {notificationUnread > 0 && (
                  <span className="badge">{notificationUnread}</span>
                )}
              </button>
              <button
                className="mobile-header-btn touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setMobileSidebarOpen(true);
                }}
              >
                <Menu size={20} />
              </button>
            </div>
          </div>

          {/* Mobile Sidebar Overlay */}
          <div
            className={`mobile-sidebar-overlay ${mobileSidebarOpen ? "open" : ""}`}
            onClick={() => setMobileSidebarOpen(false)}
          />

          {/* Mobile Sidebar Drawer */}
          <motion.div
            className={`mobile-sidebar ${mobileSidebarOpen ? "open" : ""}`}
            initial={{ x: "-100%" }}
            animate={{ x: mobileSidebarOpen ? "0%" : "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="mobile-sidebar-header">
              <div className="mobile-sidebar-avatar">
                {me?.username?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="mobile-sidebar-user">
                <div className="mobile-sidebar-username">@{me?.username}</div>
                <div className="mobile-sidebar-status">
                  {profileCustomization.customization.profile.statusEmoji} {profileCustomization.customization.profile.customStatus || myStatus}
                </div>
              </div>
            </div>

            <nav className="mobile-sidebar-menu">
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setActiveMobileView("dms");
                  setMobileSidebarOpen(false);
                }}
              >
                <MessageSquare size={20} />
                <span>Messages</span>
                {totalDmUnread > 0 && <span className="badge">{totalDmUnread}</span>}
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setActiveMobileView("groups");
                  setMobileSidebarOpen(false);
                }}
              >
                <Users size={20} />
                <span>Groups</span>
                <span className="badge">{groupsList.length}</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setActiveMobileView("profile");
                  setMobileSidebarOpen(false);
                }}
              >
                <User size={20} />
                <span>Profile</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setCustomizationOpen(true);
                  setMobileSidebarOpen(false);
                }}
              >
                <Palette size={20} />
                <span>Customize</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(20);
                  setSettingsOpen(true);
                  setMobileSidebarOpen(false);
                }}
              >
                <Settings size={20} />
                <span>Settings</span>
              </button>
              <button
                className="mobile-sidebar-item touch-feedback"
                onClick={() => {
                  vibrate(50);
                  onLogout();
                }}
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </nav>
          </motion.div>

          {/* Mobile Bottom Navigation */}
          <nav className="mobile-bottom-nav">
            <button
              className={`mobile-nav-item ${activeMobileView === "dms" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("dms");
              }}
            >
              <MessageSquare className="mobile-nav-icon" size={24} />
              <span>Chats</span>
              {totalDmUnread > 0 && (
                <span className="mobile-nav-badge">{totalDmUnread}</span>
              )}
            </button>
            <button
              className={`mobile-nav-item ${activeMobileView === "groups" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("groups");
              }}
            >
              <Users className="mobile-nav-icon" size={24} />
              <span>Groups</span>
              <span className="mobile-nav-badge">{groupsList.length}</span>
            </button>
            <button
              className={`mobile-nav-item ${activeMobileView === "friends" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("friends");
              }}
            >
              <UserPlus className="mobile-nav-icon" size={24} />
              <span>Friends</span>
            </button>
            <button
              className={`mobile-nav-item ${activeMobileView === "profile" ? "active" : ""}`}
              onClick={() => {
                vibrate(10);
                setActiveMobileView("profile");
              }}
            >
              <User className="mobile-nav-icon" size={24} />
              <span>Profile</span>
            </button>
          </nav>
        </>
      )}

    </section>
    </div>
  );
}

// Import mobile styles
import "../styles.mobile.css";
