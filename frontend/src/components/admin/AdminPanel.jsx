import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Shield, Users, MessageSquare, Activity, AlertCircle, Settings, 
  FileText, BarChart3, Bell, Search, Filter, Download, RefreshCw,
  Ban, Trash2, Eye, EyeOff, Lock, Unlock, Wifi, WifiOff, Zap,
  Database, Server, Clock, Calendar, MapPin, Smartphone, Globe,
  Mail, Send, Image, Paperclip, X, CheckCircle, AlertTriangle,
  Info, MoreHorizontal, ChevronDown, ChevronUp, Terminal, Cpu,
  HardDrive, Network, TrendingUp, TrendingDown, UserCheck,
  UserX, MessageCircle, Volume2, VolumeX, Flag, FlagOff,
  History, RotateCcw, Save, Edit3, Layers, Grid, List, PieChart,
  Activity as ActivityIcon, Box, Code, GitBranch, Layers2, Monitor,
  MousePointer, Play, Pause, Square, Maximize2, Minimize2, Copy,
  ExternalLink, FileDown, Printer, Share2, Star, ThumbsUp,
  ThumbsDown, Upload, Video, Voicemail, ZoomIn, ZoomOut, Megaphone
} from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import { API_BASE_URL } from "../../config/api";
import RippleButton from "../ui/RippleButton";
import AdminFeedback from "./AdminFeedback";
import AdminErrorLogs from "./AdminErrorLogs";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "activity", label: "Activity", icon: ActivityIcon },
  { id: "engagement", label: "Engagement", icon: Zap },
  { id: "growth", label: "Growth", icon: TrendingUp },
  { id: "topusers", label: "Top Users", icon: Star },
  { id: "users", label: "Users", icon: Users },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "dm", label: "DM", icon: Mail },
  { id: "sockets", label: "Sockets", icon: Wifi },
  { id: "errors", label: "Error Logs", icon: AlertCircle },
  { id: "feedback", label: "Feedback", icon: Bell },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "moderation", label: "Moderation", icon: Shield },
  { id: "analytics", label: "Analytics", icon: Activity },
  { id: "system", label: "System", icon: Settings },
  { id: "security", label: "Security", icon: Lock },
  { id: "maintenance", label: "Maintenance", icon: Server },
  { id: "audit", label: "Audit", icon: FileText },
];

export default function AdminPanel({ socket, onClose, onAdminChanged }) {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [userQ, setUserQ] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [userSessions, setUserSessions] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msgQ, setMsgQ] = useState("");
  const [conversations, setConversations] = useState([]);
  const [audit, setAudit] = useState([]);
  const [system, setSystem] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  
  // Enhanced Error Log States
  const [errorLogs, setErrorLogs] = useState([]);
  const [errorQ, setErrorQ] = useState("");
  const [errorSourceFilter, setErrorSourceFilter] = useState("all");
  const [errorUserFilter, setErrorUserFilter] = useState("all");
  const [errorSeverityFilter, setErrorSeverityFilter] = useState("all");
  const [errorTimeRange, setErrorTimeRange] = useState("24h");
  const [errorSources, setErrorSources] = useState([]);
  const [errorUsers, setErrorUsers] = useState([]);
  const [expandedError, setExpandedError] = useState(null);
  const [realtimeErrors, setRealtimeErrors] = useState(true);
  const [errorStats, setErrorStats] = useState(null);
  const [selectedErrors, setSelectedErrors] = useState(new Set());
  const [autoRefreshErrors, setAutoRefreshErrors] = useState(true);
  const errorLogEndRef = useRef(null);
  
  // User Feedback States
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [feedbackStatus, setFeedbackStatus] = useState("all");
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [feedbackReply, setFeedbackReply] = useState("");
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  const [feedbackCategories, setFeedbackCategories] = useState([]);
  const [feedbackPriority, setFeedbackPriority] = useState("all");
  
  // Announcements States
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", priority: "normal", color: "#6678ff" });
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  
  // Moderation States
  const [bannedWords, setBannedWords] = useState([]);
  const [spamPatterns, setSpamPatterns] = useState([]);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [autoModSettings, setAutoModSettings] = useState(null);
  const [reportedContent, setReportedContent] = useState([]);
  const [shadowBannedUsers, setShadowBannedUsers] = useState([]);
  const [slowModeSettings, setSlowModeSettings] = useState(null);
  const [ipBlacklist, setIpBlacklist] = useState([]);
  
  // Analytics States
  const [trafficData, setTrafficData] = useState([]);
  const [userGrowth, setUserGrowth] = useState([]);
  const [messageStats, setMessageStats] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [deviceStats, setDeviceStats] = useState([]);
  const [geographicData, setGeographicData] = useState([]);
  const [retentionData, setRetentionData] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState([]);
  
  // Security States
  const [failedLogins, setFailedLogins] = useState([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [activeThreats, setActiveThreats] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [twoFactorStats, setTwoFactorStats] = useState(null);
  const [tokenBlacklist, setTokenBlacklist] = useState([]);
  
  // Maintenance States
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [chatFrozen, setChatFrozen] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [dbStats, setDbStats] = useState(null);
  
  // UI States
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [dateRange, setDateRange] = useState("7d");
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [exportFormat, setExportFormat] = useState("json");
  const [modalContent, setModalContent] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);
  
  // Real-time updates
  const [liveUsers, setLiveUsers] = useState([]);
  const [liveMessages, setLiveMessages] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  
  // Activity States - Last 24h tracking
  const [recentRegistrations, setRecentRegistrations] = useState([]);
  const [recentOnlineUsers, setRecentOnlineUsers] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityLastUpdated, setActivityLastUpdated] = useState(null);
  const [activitySubTab, setActivitySubTab] = useState("registrations"); // "registrations" | "online"
  
  // Engagement States - User interaction stats
  const [engagementStats, setEngagementStats] = useState(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementLastUpdated, setEngagementLastUpdated] = useState(null);
  const [engagementSubTab, setEngagementSubTab] = useState("overview"); // "overview" | "messages" | "calls"
  
  // Growth States - User growth analytics
  const [growthData, setGrowthData] = useState([]);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthLastUpdated, setGrowthLastUpdated] = useState(null);
  const [growthPeriod, setGrowthPeriod] = useState("7d"); // "24h" | "7d" | "30d"
  
  // Top Users States - Leaderboard
  const [topUsers, setTopUsers] = useState([]);
  const [topUsersLoading, setTopUsersLoading] = useState(false);
  const [topUsersLastUpdated, setTopUsersLastUpdated] = useState(null);
  const [topUsersMetric, setTopUsersMetric] = useState("messages"); // "messages" | "calls" | "activity"

  const loadStats = useCallback(async () => {
    const d = await adminFetch("/stats");
    setStats(d);
  }, []);

  const loadUsers = useCallback(async () => {
    const q = userQ ? `?q=${encodeURIComponent(userQ)}` : "";
    const d = await adminFetch(`/users${q}`);
    setUsers(d.users || []);
  }, [userQ]);

  const loadAllUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("descall_token");
      console.log("[ADMIN] Loading users, token:", !!token);
      console.log("[ADMIN] API_BASE_URL:", API_BASE_URL);
      
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      
      console.log("[ADMIN] Users response:", d);
      setUsers(d.users || []);
    } catch (e) {
      console.error("[ADMIN] Failed to load users:", e);
      setErr(e.message);
    }
  }, []);

  const loadAnnouncements = useCallback(async () => {
    try {
      const token = localStorage.getItem("descall_token");
      const res = await fetch(`${API_BASE_URL}/api/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setAnnouncements(d.announcements || []);
    } catch (e) {
      console.error("[ADMIN] Failed to load announcements:", e);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    const q = msgQ ? `?q=${encodeURIComponent(msgQ)}` : "";
    const d = await adminFetch(`/messages${q}`);
    setMessages(d.messages || []);
  }, [msgQ]);

  const loadDm = useCallback(async () => {
    const d = await adminFetch("/dm/conversations");
    setConversations(d.conversations || []);
  }, []);

  const loadAudit = useCallback(async () => {
    const d = await adminFetch("/audit?limit=300");
    setAudit(d.entries || []);
  }, []);

  const loadSystem = useCallback(async () => {
    const d = await adminFetch("/system");
    setSystem(d);
  }, []);

  const loadErrors = useCallback(async () => {
    const d = await adminFetch("/errors");
    const logs = Array.isArray(d) ? d : Array.isArray(d?.errors) ? d.errors : [];
    setErrorLogs(logs);
    setErrorSources(d?.sources || []);
    setErrorUsers(d?.usersWithErrors || []);
  }, []);

  // Load activity data - recent registrations and online users (last 24h)
  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      console.log("[ADMIN] Loading activity data...");
      
      // Fetch all users
      const d = await adminFetch("/users");
      console.log("[ADMIN] Users data:", d);
      
      const allUsers = d.users || [];
      console.log("[ADMIN] Total users:", allUsers.length);
      
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Filter registrations in last 24h
      const recentRegs = allUsers
        .filter(u => {
          if (!u.created_at) return false;
          const createdDate = new Date(u.created_at);
          return createdDate >= last24h;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      console.log("[ADMIN] Recent registrations (24h):", recentRegs.length);
      
      // Get ALL currently online users (isOnline flag) + recently active
      const currentlyOnline = allUsers.filter(u => u.isOnline === true);
      console.log("[ADMIN] Currently online:", currentlyOnline.length);
      
      // Filter users who were active in last 24h (including online now)
      const recentActive = allUsers
        .filter(u => {
          if (!u.last_seen) return false;
          const lastSeenDate = new Date(u.last_seen);
          return lastSeenDate >= last24h;
        })
        .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
      
      console.log("[ADMIN] Recent active (24h):", recentActive.length);
      
      // Merge online users with recent active (remove duplicates)
      const onlineIds = new Set(currentlyOnline.map(u => u.id));
      const mergedOnline = [
        ...currentlyOnline,
        ...recentActive.filter(u => !onlineIds.has(u.id))
      ];
      
      setRecentRegistrations(recentRegs);
      setRecentOnlineUsers(mergedOnline);
      setActivityLastUpdated(new Date());
    } catch (e) {
      console.error("[ADMIN] Failed to load activity:", e);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // Load engagement stats - user interactions
  const loadEngagement = useCallback(async () => {
    setEngagementLoading(true);
    try {
      // Fetch messages for stats
      const messagesRes = await adminFetch("/messages");
      const allMessages = messagesRes.messages || [];
      
      // Fetch users for activity data
      const usersRes = await adminFetch("/users");
      const allUsers = usersRes.users || [];
      
      // Calculate engagement stats
      const totalMessages = allMessages.length;
      const messagesLast24h = allMessages.filter(m => {
        const msgDate = new Date(m.timestamp);
        return msgDate >= new Date(Date.now() - 24 * 60 * 60 * 1000);
      }).length;
      
      const messagesLast7d = allMessages.filter(m => {
        const msgDate = new Date(m.timestamp);
        return msgDate >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }).length;
      
      // Active users (sent at least one message)
      const activeUserIds = new Set(allMessages.map(m => m.user_id || m.from));
      const activeUsers = activeUserIds.size;
      
      // Most active hours
      const hourCounts = {};
      allMessages.forEach(m => {
        const hour = new Date(m.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));
      
      setEngagementStats({
        totalMessages,
        messagesLast24h,
        messagesLast7d,
        activeUsers,
        totalUsers: allUsers.length,
        peakHours,
        avgMessagesPerUser: allUsers.length > 0 ? (totalMessages / allUsers.length).toFixed(1) : 0
      });
      setEngagementLastUpdated(new Date());
    } catch (e) {
      console.error("[ADMIN] Failed to load engagement:", e);
    } finally {
      setEngagementLoading(false);
    }
  }, []);

  // Load growth data - user registration trends
  const loadGrowth = useCallback(async () => {
    setGrowthLoading(true);
    try {
      const d = await adminFetch("/users");
      const allUsers = d.users || [];
      
      // Generate daily growth data based on registration dates
      const dailyData = {};
      const now = new Date();
      
      // Initialize last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        dailyData[dateKey] = { date: dateKey, newUsers: 0, totalUsers: 0 };
      }
      
      // Count registrations per day
      allUsers.forEach(u => {
        if (u.created_at) {
          const dateKey = new Date(u.created_at).toISOString().split('T')[0];
          if (dailyData[dateKey]) {
            dailyData[dateKey].newUsers++;
          }
        }
      });
      
      // Calculate cumulative totals
      let runningTotal = allUsers.length - Object.values(dailyData).reduce((sum, d) => sum + d.newUsers, 0);
      Object.keys(dailyData).sort().forEach(dateKey => {
        runningTotal += dailyData[dateKey].newUsers;
        dailyData[dateKey].totalUsers = runningTotal;
      });
      
      setGrowthData(Object.values(dailyData));
      setGrowthLastUpdated(new Date());
    } catch (e) {
      console.error("[ADMIN] Failed to load growth:", e);
    } finally {
      setGrowthLoading(false);
    }
  }, []);

  // Load top users - leaderboard
  const loadTopUsers = useCallback(async () => {
    setTopUsersLoading(true);
    try {
      // Fetch messages
      const messagesRes = await adminFetch("/messages");
      const allMessages = messagesRes.messages || [];
      
      // Fetch users
      const usersRes = await adminFetch("/users");
      const allUsers = usersRes.users || [];
      
      // Calculate message counts per user
      const userMessageCounts = {};
      allMessages.forEach(m => {
        const userId = m.user_id || m.from;
        if (userId) {
          userMessageCounts[userId] = (userMessageCounts[userId] || 0) + 1;
        }
      });
      
      // Create leaderboard
      const leaderboard = allUsers
        .map(u => ({
          ...u,
          messageCount: userMessageCounts[u.id] || 0,
          lastActive: u.last_seen ? new Date(u.last_seen) : null
        }))
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 50); // Top 50
      
      setTopUsers(leaderboard);
      setTopUsersLastUpdated(new Date());
    } catch (e) {
      console.error("[ADMIN] Failed to load top users:", e);
    } finally {
      setTopUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    adminFetch("/snapshot")
      .then(setSnapshot)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onSync = (p) => setSnapshot(p);
    const onUp = (p) => setSnapshot((s) => (s ? { ...s, lastEvent: p } : s));
    socket.on("admin:sync", onSync);
    socket.on("admin:update", onUp);
    socket.emit("admin:subscribe");
    return () => {
      socket.off("admin:sync", onSync);
      socket.off("admin:update", onUp);
    };
  }, [socket]);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        await loadStats();
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "users") loadAllUsers().catch((e) => setErr(e.message));
    if (tab === "activity") loadActivity().catch((e) => setErr(e.message));
    if (tab === "engagement") loadEngagement().catch((e) => setErr(e.message));
    if (tab === "growth") loadGrowth().catch((e) => setErr(e.message));
    if (tab === "topusers") loadTopUsers().catch((e) => setErr(e.message));
    if (tab === "messages") loadMessages().catch((e) => setErr(e.message));
    if (tab === "dm") loadDm().catch((e) => setErr(e.message));
    if (tab === "audit") loadAudit().catch((e) => setErr(e.message));
    if (tab === "system") loadSystem().catch((e) => setErr(e.message));
    if (tab === "announcements") loadAnnouncements().catch((e) => setErr(e.message));
    // feedback and errors tabs use their own components with internal loading
  }, [tab, loadAllUsers, loadActivity, loadEngagement, loadGrowth, loadTopUsers, loadMessages, loadDm, loadAudit, loadSystem, loadAnnouncements]);

  // Auto-refresh activity every hour
  useEffect(() => {
    if (tab !== "activity") return;
    
    const interval = setInterval(() => {
      loadActivity().catch(console.error);
    }, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(interval);
  }, [tab, loadActivity]);

  // Auto-refresh engagement every hour
  useEffect(() => {
    if (tab !== "engagement") return;
    
    const interval = setInterval(() => {
      loadEngagement().catch(console.error);
    }, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [tab, loadEngagement]);

  // Auto-refresh growth every hour
  useEffect(() => {
    if (tab !== "growth") return;
    
    const interval = setInterval(() => {
      loadGrowth().catch(console.error);
    }, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [tab, loadGrowth]);

  // Auto-refresh top users every hour
  useEffect(() => {
    if (tab !== "topusers") return;
    
    const interval = setInterval(() => {
      loadTopUsers().catch(console.error);
    }, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [tab, loadTopUsers]);

  const act = async (fn) => {
    try {
      setBusy(true);
      setErr("");
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

// Helper function to format time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

  return (
    <motion.div
      className="admin-shell"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
    >
      <header className="admin-top">
        <div className="admin-header-content">
          <div className="admin-header-icon">
            <Shield size={32} />
          </div>
          <div>
            <h1>Admin Panel</h1>
            <p className="admin-sub">System administration & moderation</p>
          </div>
        </div>
        <RippleButton type="button" className="admin-close" onClick={onClose}>
          <X size={20} />
        </RippleButton>
      </header>

      {err && (
        <motion.div 
          className="admin-error"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle size={16} />
          {err}
        </motion.div>
      )}

      <nav className="admin-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <motion.button
              key={t.id}
              type="button"
              className={`admin-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon size={16} />
              {t.label}
            </motion.button>
          );
        })}
      </nav>

      <div className="admin-body custom-scroll">
        {tab === "overview" && (
          <section className="admin-section">
            <h2>Server stats</h2>
            {stats && (
              <div className="admin-grid">
                <div className="admin-card">
                  <span>Uptime (s)</span>
                  <strong>{Math.floor(stats.uptime)}</strong>
                </div>
                <div className="admin-card">
                  <span>Online</span>
                  <strong>{stats.onlineUsers}</strong>
                </div>
                <div className="admin-card">
                  <span>#general msgs</span>
                  <strong>{stats.generalMessageCount}</strong>
                </div>
                <div className="admin-card">
                  <span>DM threads</span>
                  <strong>{stats.dmConversationKeys}</strong>
                </div>
                <div className="admin-card">
                  <span>Banned</span>
                  <strong>{stats.bannedUsers}</strong>
                </div>
                <div className="admin-card">
                  <span>Audit entries</span>
                  <strong>{stats.auditEntries}</strong>
                </div>
              </div>
            )}
            <RippleButton type="button" onClick={() => act(loadStats)} disabled={busy}>
              Refresh
            </RippleButton>
            {snapshot && (
              <div className="admin-live">
                <h3>Live socket snapshot</h3>
                <pre className="admin-pre">{JSON.stringify(snapshot, null, 2)}</pre>
              </div>
            )}
          </section>
        )}

        {tab === "activity" && (
          <section className="admin-section admin-activity-section">
            {/* Activity Header with Stats */}
            <div className="activity-header">
              <div className="activity-title-section">
                <h2>24-Hour Activity Monitor</h2>
                <p className="activity-subtitle">
                  Real-time tracking of user registrations and online activity
                </p>
              </div>
              <div className="activity-stats-grid">
                <motion.div 
                  className="activity-stat-card registrations"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="stat-icon-wrapper">
                    <UserCheck size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number">{recentRegistrations.length}</span>
                    <span className="stat-label">New Registrations</span>
                    <span className="stat-time">Last 24h</span>
                  </div>
                </motion.div>
                <motion.div 
                  className="activity-stat-card online"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="stat-icon-wrapper">
                    <Wifi size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number">{recentOnlineUsers.length}</span>
                    <span className="stat-label">Active Users</span>
                    <span className="stat-time">Last 24h</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Last Updated Info */}
            <div className="activity-toolbar">
              <div className="last-updated">
                <Clock size={14} />
                <span>
                  Last updated: {activityLastUpdated 
                    ? activityLastUpdated.toLocaleTimeString() 
                    : "Never"}
                </span>
              </div>
              <RippleButton 
                type="button" 
                onClick={() => act(loadActivity)} 
                disabled={activityLoading}
                className="refresh-btn"
              >
                <RefreshCw size={16} className={activityLoading ? "spin" : ""} />
                {activityLoading ? "Loading..." : "Refresh Now"}
              </RippleButton>
            </div>

            {/* Sub-tab Navigation */}
            <div className="activity-sub-tabs">
              <button
                type="button"
                className={`sub-tab ${activitySubTab === "registrations" ? "active" : ""}`}
                onClick={() => setActivitySubTab("registrations")}
              >
                <UserCheck size={16} />
                New Registrations
                <span className="badge">{recentRegistrations.length}</span>
              </button>
              <button
                type="button"
                className={`sub-tab ${activitySubTab === "online" ? "active" : ""}`}
                onClick={() => setActivitySubTab("online")}
              >
                <Wifi size={16} />
                Online Activity
                <span className="badge">{recentOnlineUsers.length}</span>
              </button>
            </div>

            {/* Registrations Tab Content */}
            {activitySubTab === "registrations" && (
              <motion.div 
                className="activity-content"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                {recentRegistrations.length === 0 ? (
                  <div className="empty-state">
                    <Users size={48} className="empty-icon" />
                    <h3>No New Registrations</h3>
                    <p>No users registered in the last 24 hours</p>
                  </div>
                ) : (
                  <div className="activity-timeline">
                    {recentRegistrations.map((user, index) => {
                      const timeAgo = getTimeAgo(new Date(user.created_at));
                      return (
                        <motion.div
                          key={user.id}
                          className="timeline-item"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <div className="timeline-marker registration">
                            <UserCheck size={14} />
                          </div>
                          <div className="timeline-content">
                            <div className="user-info">
                              <img 
                                src={user.avatar_url || "/default-avatar.png"} 
                                alt={user.username}
                                className="user-avatar"
                              />
                              <div className="user-details">
                                <span className="username">{user.username}</span>
                                <span className="user-id">{user.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                            <div className="time-info">
                              <span className="time-badge">{timeAgo}</span>
                              <span className="exact-time">
                                {new Date(user.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Online Users Tab Content */}
            {activitySubTab === "online" && (
              <motion.div 
                className="activity-content"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                {recentOnlineUsers.length === 0 ? (
                  <div className="empty-state">
                    <WifiOff size={48} className="empty-icon" />
                    <h3>No Online Activity</h3>
                    <p>No users were online in the last 24 hours</p>
                  </div>
                ) : (
                  <div className="activity-timeline">
                    {recentOnlineUsers.map((user, index) => {
                      const timeAgo = getTimeAgo(new Date(user.last_seen));
                      const isCurrentlyOnline = user.isOnline;
                      return (
                        <motion.div
                          key={user.id}
                          className={`timeline-item ${isCurrentlyOnline ? "online-now" : ""}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <div className={`timeline-marker ${isCurrentlyOnline ? "online" : "offline"}`}>
                            {isCurrentlyOnline ? <Wifi size={14} /> : <Clock size={14} />}
                          </div>
                          <div className="timeline-content">
                            <div className="user-info">
                              <img 
                                src={user.avatar_url || "/default-avatar.png"} 
                                alt={user.username}
                                className="user-avatar"
                              />
                              <div className="user-details">
                                <span className="username">
                                  {user.username}
                                  {isCurrentlyOnline && (
                                    <span className="online-indicator">● Online Now</span>
                                  )}
                                </span>
                                <span className="user-id">{user.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                            <div className="time-info">
                              <span className={`time-badge ${isCurrentlyOnline ? "online" : ""}`}>
                                {isCurrentlyOnline ? "Currently Online" : timeAgo}
                              </span>
                              <span className="exact-time">
                                {new Date(user.last_seen).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </section>
        )}

        {tab === "engagement" && (
          <section className="admin-section admin-engagement-section">
            {/* Engagement Header */}
            <div className="activity-header">
              <div className="activity-title-section">
                <h2>User Engagement Analytics</h2>
                <p className="activity-subtitle">
                  Message activity and user interaction statistics
                </p>
              </div>
              <div className="activity-stats-grid">
                <motion.div 
                  className="activity-stat-card messages"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="stat-icon-wrapper">
                    <MessageSquare size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number">{engagementStats?.totalMessages || 0}</span>
                    <span className="stat-label">Total Messages</span>
                  </div>
                </motion.div>
                <motion.div 
                  className="activity-stat-card active-users"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="stat-icon-wrapper">
                    <Users size={24} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-number">{engagementStats?.activeUsers || 0}</span>
                    <span className="stat-label">Active Users</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="activity-toolbar">
              <div className="last-updated">
                <Clock size={14} />
                <span>
                  Last updated: {engagementLastUpdated 
                    ? engagementLastUpdated.toLocaleTimeString() 
                    : "Never"}
                </span>
              </div>
              <RippleButton 
                type="button" 
                onClick={() => act(loadEngagement)} 
                disabled={engagementLoading}
                className="refresh-btn"
              >
                <RefreshCw size={16} className={engagementLoading ? "spin" : ""} />
                {engagementLoading ? "Loading..." : "Refresh"}
              </RippleButton>
            </div>

            {/* Stats Grid */}
            <div className="engagement-stats-grid">
              <div className="stat-card">
                <h4>Messages (24h)</h4>
                <span className="big-number">{engagementStats?.messagesLast24h || 0}</span>
              </div>
              <div className="stat-card">
                <h4>Messages (7d)</h4>
                <span className="big-number">{engagementStats?.messagesLast7d || 0}</span>
              </div>
              <div className="stat-card">
                <h4>Avg Messages/User</h4>
                <span className="big-number">{engagementStats?.avgMessagesPerUser || 0}</span>
              </div>
              <div className="stat-card peak-hours">
                <h4>Peak Activity Hours</h4>
                <div className="peak-hours-list">
                  {(engagementStats?.peakHours || []).slice(0, 3).map((peak, i) => (
                    <div key={i} className="peak-hour-item">
                      <span className="hour">{peak.hour}:00</span>
                      <div className="bar-container">
                        <div 
                          className="bar" 
                          style={{ width: `${Math.min(100, (peak.count / (engagementStats?.peakHours[0]?.count || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="count">{peak.count} msgs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "growth" && (
          <section className="admin-section admin-growth-section">
            {/* Growth Header */}
            <div className="activity-header">
              <div className="activity-title-section">
                <h2>User Growth Analytics</h2>
                <p className="activity-subtitle">
                  Daily registration trends and growth metrics
                </p>
              </div>
              <div className="period-selector">
                <button 
                  className={growthPeriod === "24h" ? "active" : ""}
                  onClick={() => setGrowthPeriod("24h")}
                >
                  24h
                </button>
                <button 
                  className={growthPeriod === "7d" ? "active" : ""}
                  onClick={() => setGrowthPeriod("7d")}
                >
                  7 Days
                </button>
                <button 
                  className={growthPeriod === "30d" ? "active" : ""}
                  onClick={() => setGrowthPeriod("30d")}
                >
                  30 Days
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="activity-toolbar">
              <div className="last-updated">
                <Clock size={14} />
                <span>
                  Last updated: {growthLastUpdated 
                    ? growthLastUpdated.toLocaleTimeString() 
                    : "Never"}
                </span>
              </div>
              <RippleButton 
                type="button" 
                onClick={() => act(loadGrowth)} 
                disabled={growthLoading}
                className="refresh-btn"
              >
                <RefreshCw size={16} className={growthLoading ? "spin" : ""} />
                {growthLoading ? "Loading..." : "Refresh"}
              </RippleButton>
            </div>

            {/* Growth Chart */}
            <div className="growth-chart-container">
              <h3>Daily New Registrations</h3>
              <div className="growth-chart">
                {growthData.slice(-7).map((day, index) => {
                  const maxUsers = Math.max(...growthData.slice(-7).map(d => d.newUsers), 1);
                  const height = day.newUsers > 0 ? (day.newUsers / maxUsers) * 100 : 0;
                  return (
                    <div key={day.date} className="chart-bar-wrapper">
                      <div className="chart-bar-container">
                        <motion.div 
                          className="chart-bar"
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: index * 0.1, duration: 0.5 }}
                        >
                          {day.newUsers > 0 && (
                            <span className="bar-value">{day.newUsers}</span>
                          )}
                        </motion.div>
                      </div>
                      <span className="bar-label">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Growth Stats */}
            <div className="growth-summary">
              <div className="summary-card">
                <span className="summary-label">New (7 days)</span>
                <span className="summary-value">
                  {growthData.slice(-7).reduce((sum, d) => sum + d.newUsers, 0)}
                </span>
              </div>
              <div className="summary-card">
                <span className="summary-label">New (30 days)</span>
                <span className="summary-value">
                  {growthData.slice(-30).reduce((sum, d) => sum + d.newUsers, 0)}
                </span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Total Users</span>
                <span className="summary-value">
                  {growthData[growthData.length - 1]?.totalUsers || 0}
                </span>
              </div>
            </div>
          </section>
        )}

        {tab === "topusers" && (
          <section className="admin-section admin-topusers-section">
            {/* Top Users Header */}
            <div className="activity-header">
              <div className="activity-title-section">
                <h2>Top Active Users</h2>
                <p className="activity-subtitle">
                  Leaderboard of most engaged users
                </p>
              </div>
              <div className="metric-selector">
                <button 
                  className={topUsersMetric === "messages" ? "active" : ""}
                  onClick={() => setTopUsersMetric("messages")}
                >
                  <MessageSquare size={14} />
                  By Messages
                </button>
                <button 
                  className={topUsersMetric === "activity" ? "active" : ""}
                  onClick={() => setTopUsersMetric("activity")}
                >
                  <ActivityIcon size={14} />
                  By Activity
                </button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="activity-toolbar">
              <div className="last-updated">
                <Clock size={14} />
                <span>
                  Last updated: {topUsersLastUpdated 
                    ? topUsersLastUpdated.toLocaleTimeString() 
                    : "Never"}
                </span>
              </div>
              <RippleButton 
                type="button" 
                onClick={() => act(loadTopUsers)} 
                disabled={topUsersLoading}
                className="refresh-btn"
              >
                <RefreshCw size={16} className={topUsersLoading ? "spin" : ""} />
                {topUsersLoading ? "Loading..." : "Refresh"}
              </RippleButton>
            </div>

            {/* Top Users List */}
            <div className="top-users-list">
              {topUsers.slice(0, 20).map((user, index) => (
                <motion.div
                  key={user.id}
                  className="top-user-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className={`rank-badge ${index < 3 ? 'top-three' : ''}`}>
                    {index + 1}
                  </div>
                  <img 
                    src={user.avatar_url || "/default-avatar.png"} 
                    alt={user.username}
                    className="user-avatar"
                  />
                  <div className="user-details">
                    <span className="username">{user.username}</span>
                    <span className="user-meta">
                      {user.messageCount} messages • {user.lastActive ? getTimeAgo(user.lastActive) + ' ago' : 'Never active'}
                    </span>
                  </div>
                  <div className="user-stats">
                    <div className="stat-badge messages">
                      <MessageSquare size={12} />
                      {user.messageCount}
                    </div>
                    {user.isOnline && (
                      <div className="stat-badge online">
                        <Wifi size={12} />
                        Online
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {tab === "users" && (
          <section className="admin-section">
            <div className="admin-toolbar">
              <input
                className="admin-input"
                placeholder="Search username…"
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
              />
              <RippleButton type="button" onClick={() => act(loadAllUsers)} disabled={busy}>
                Search
              </RippleButton>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Admin</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>{u.username}</td>
                    <td className="mono">{u.id.slice(0, 8)}…</td>
                    <td className="admin-status">
                      {u.isOnline ? (
                        <span className="status-badge online">Online</span>
                      ) : (
                        <span className="status-badge offline">Offline</span>
                      )}
                    </td>
                    <td className="admin-status">
                      {u.is_admin ? (
                        <span className="admin-badge">Admin</span>
                      ) : (
                        <span className="admin-badge-false">User</span>
                      )}
                    </td>
                    <td className="admin-actions">
                      {u.is_admin ? (
                        <button
                          type="button"
                          className="admin-btn-red"
                          onClick={() =>
                            act(async () => {
                              console.log("[ADMIN] Removing admin for user:", u.id);
                              const token = localStorage.getItem("descall_token");
                              const res = await fetch(`${API_BASE_URL}/api/admin/remove-admin/${u.id}`, {
                                method: "PUT",
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              console.log("[ADMIN] Remove admin response:", res.status);
                              if (res.ok) {
                                await loadAllUsers();
                                console.log("[ADMIN] Calling onAdminChanged...");
                                onAdminChanged?.();
                              }
                            })
                          }
                        >
                          Remove Admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn-green"
                          onClick={async () => {
                            console.log("[ADMIN] Make Admin button clicked for user:", u.id);
                            try {
                              const token = localStorage.getItem("descall_token");
                              console.log("[ADMIN] Token:", !!token);
                              const res = await fetch(`${API_BASE_URL}/api/admin/make-admin/${u.id}`, {
                                method: "PUT",
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              console.log("[ADMIN] Make admin response:", res.status);
                              if (res.ok) {
                                await loadAllUsers();
                                console.log("[ADMIN] Calling onAdminChanged...");
                                onAdminChanged?.();
                              } else {
                                console.error("[ADMIN] Make admin failed:", res.status);
                              }
                            } catch (err) {
                              console.error("[ADMIN] Make admin error:", err);
                            }
                          }}
                        >
                          Make Admin
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "messages" && (
          <section className="admin-section">
            <div className="admin-toolbar">
              <input
                className="admin-input"
                placeholder="Search text…"
                value={msgQ}
                onChange={(e) => setMsgQ(e.target.value)}
              />
              <RippleButton type="button" onClick={() => act(loadMessages)} disabled={busy}>
                Load
              </RippleButton>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Text</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <motion.tr key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>{m.timestamp}</td>
                    <td>{m.username}</td>
                    <td className="msg-cell">{m.text}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          act(async () => {
                            await adminFetch(`/messages/${m.id}`, { method: "DELETE" });
                            await loadMessages();
                          })
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "dm" && (
          <section className="admin-section">
            <h2>DM conversations (in-memory keys)</h2>
            <ul className="admin-list">
              {conversations.map((c) => (
                <li key={c.key}>
                  <code>{c.key}</code> — {c.messageCount} msgs
                </li>
              ))}
            </ul>
            <RippleButton
              type="button"
              onClick={() =>
                act(async () => {
                  const d = await adminFetch("/dm/export");
                  const blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = "dm-export.json";
                  a.click();
                })
              }
            >
              Export DM JSON
            </RippleButton>
          </section>
        )}

        {tab === "sockets" && (
          <section className="admin-section">
            <h2>Connected sockets</h2>
            <p className="muted">From latest admin:sync / admin:update</p>
            <pre className="admin-pre">{JSON.stringify(snapshot?.sockets || [], null, 2)}</pre>
            <div className="admin-row">
              <RippleButton
                type="button"
                className="danger"
                onClick={() =>
                  act(async () => {
                    await adminFetch("/sockets/kick-all", { method: "POST", body: JSON.stringify({}) });
                  })
                }
              >
                Disconnect everyone
              </RippleButton>
            </div>
          </section>
        )}

        {tab === "errors" && (
          <section className="admin-section admin-section-full">
            <AdminErrorLogs socket={socket} />
          </section>
        )}

        {tab === "feedback" && (
          <section className="admin-section admin-section-full">
            <AdminFeedback socket={socket} />
          </section>
        )}

        {tab === "announcements" && (
          <section className="admin-section">
            <h2>Announcements</h2>
            <p className="muted">Create and manage system-wide announcements</p>
            
            <div className="admin-toolbar">
              <RippleButton 
                type="button" 
                onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
                className="admin-btn-green"
              >
                {showAnnouncementForm ? "Cancel" : "New Announcement"}
              </RippleButton>
              <RippleButton 
                type="button" 
                onClick={() => act(loadAnnouncements)} 
                disabled={busy}
              >
                Refresh
              </RippleButton>
            </div>

            {showAnnouncementForm && (
              <div className="admin-form">
                <input
                  className="admin-input"
                  placeholder="Announcement title"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                />
                <textarea
                  className="admin-input"
                  placeholder="Announcement content"
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                  rows={4}
                />
                <div className="admin-row">
                  <select
                    className="admin-input"
                    value={newAnnouncement.priority}
                    onChange={(e) => setNewAnnouncement({...newAnnouncement, priority: e.target.value})}
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input
                    type="color"
                    className="admin-input"
                    value={newAnnouncement.color}
                    onChange={(e) => setNewAnnouncement({...newAnnouncement, color: e.target.value})}
                    style={{ width: "60px" }}
                  />
                </div>
                <RippleButton 
                  type="button" 
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem("descall_token");
                      const res = await fetch(`${API_BASE_URL}/api/admin/announcements`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify(newAnnouncement),
                      });
                      if (res.ok) {
                        setNewAnnouncement({ title: "", content: "", priority: "normal", color: "#6678ff" });
                        setShowAnnouncementForm(false);
                        await loadAnnouncements();
                      }
                    } catch (e) {
                      console.error("Failed to create announcement:", e);
                    }
                  }}
                  disabled={busy || !newAnnouncement.title || !newAnnouncement.content}
                  className="admin-btn-green"
                >
                  Create Announcement
                </RippleButton>
              </div>
            )}

            <div className="admin-list">
              {announcements.map((a) => (
                <motion.div 
                  key={a.id} 
                  className="admin-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ borderLeft: `4px solid ${a.color}` }}
                >
                  <div className="admin-row">
                    <h4>{a.title}</h4>
                    <span className={`priority-badge ${a.priority}`}>{a.priority}</span>
                  </div>
                  <p>{a.content}</p>
                  <div className="admin-row">
                    <span className="muted">{new Date(a.created_at).toLocaleString()}</span>
                    <RippleButton 
                      type="button" 
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem("descall_token");
                          const res = await fetch(`${API_BASE_URL}/api/admin/announcements/${a.id}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (res.ok) {
                            await loadAnnouncements();
                          }
                        } catch (e) {
                          console.error("Failed to delete announcement:", e);
                        }
                      }}
                      className="admin-btn-red"
                    >
                      Delete
                    </RippleButton>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {tab === "moderation" && (
          <section className="admin-section">
            <h2>Content Moderation</h2>
            <p className="muted">Manage banned users, flagged messages, and content filters</p>
            
            <div className="admin-toolbar">
              <RippleButton type="button" onClick={() => act(loadSystem)} disabled={busy}>
                Refresh
              </RippleButton>
            </div>
            
            {system && (
              <div className="admin-form">
                <h3>Banned Users</h3>
                <div className="banned-users-list">
                  {system.bannedUserIds?.length > 0 ? (
                    system.bannedUserIds.map(id => (
                      <div key={id} className="banned-user-item">
                        <code>{id}</code>
                        <RippleButton 
                          type="button" 
                          className="small"
                          onClick={() => act(async () => {
                            await adminFetch(`/users/${id}/unban`, { method: "POST" });
                            await loadSystem();
                          })}
                        >
                          Unban
                        </RippleButton>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No banned users</p>
                  )}
                </div>
                
                <h3>Flagged Messages</h3>
                <div className="flagged-messages-list">
                  {system.flaggedMessages?.length > 0 ? (
                    system.flaggedMessages.map(msg => (
                      <div key={msg.id} className="flagged-message-item">
                        <span>{msg.text}</span>
                        <span className="badge">{msg.reason}</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No flagged messages</p>
                  )}
                </div>
                
                <h3>Profanity Filter</h3>
                <label>
                  Add word to filter
                  <input className="admin-input" id="prof-moderation" placeholder="Enter word..." />
                  <RippleButton
                    type="button"
                    onClick={() => {
                      const w = document.getElementById("prof-moderation")?.value?.trim();
                      if (!w) return;
                      act(async () => {
                        await adminFetch("/profanity", { method: "POST", body: JSON.stringify({ word: w }) });
                        await loadSystem();
                      });
                    }}
                  >
                    Add
                  </RippleButton>
                </label>
                <div className="profanity-list">
                  {system.profanityWords?.length > 0 ? (
                    system.profanityWords.map(word => (
                      <span key={word} className="profanity-tag">{word}</span>
                    ))
                  ) : (
                    <p className="muted">No filter words</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "analytics" && (
          <section className="admin-section">
            <h2>Analytics Dashboard</h2>
            <p className="muted">Real-time system analytics and usage statistics</p>
            
            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>User Activity</h3>
                <div className="stat-row">
                  <span>Online Now:</span>
                  <strong>{snapshot?.onlineCount || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>Total Connections:</span>
                  <strong>{snapshot?.sockets?.length || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>Banned Users:</span>
                  <strong>{snapshot?.bannedCount || 0}</strong>
                </div>
              </div>
              
              <div className="analytics-card">
                <h3>Message Statistics</h3>
                <div className="stat-row">
                  <span>Total Messages:</span>
                  <strong>{stats?.totalMessages || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>DM Conversations:</span>
                  <strong>{stats?.totalDmConversations || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>Groups:</span>
                  <strong>{stats?.totalGroups || 0}</strong>
                </div>
              </div>
              
              <div className="analytics-card">
                <h3>System Health</h3>
                <div className="stat-row">
                  <span>Uptime:</span>
                  <strong>{stats?.uptime || "N/A"}</strong>
                </div>
                <div className="stat-row">
                  <span>Memory Usage:</span>
                  <strong>{stats?.memoryUsage || "N/A"}</strong>
                </div>
                <div className="stat-row">
                  <span>Last Restart:</span>
                  <strong>{stats?.lastRestart || "N/A"}</strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "security" && (
          <section className="admin-section">
            <h2>Security Center</h2>
            <p className="muted">Security settings and access control</p>
            
            <div className="security-grid">
              <div className="security-card">
                <h3>Access Control</h3>
                <label>
                  <input 
                    type="checkbox" 
                    checked={system?.config?.registrationEnabled !== false}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ registrationEnabled: e.target.checked }),
                      });
                      await loadSystem();
                    })}
                  />
                  Allow new user registrations
                </label>
                
                <label>
                  <input 
                    type="checkbox" 
                    checked={system?.config?.dmEnabled !== false}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ dmEnabled: e.target.checked }),
                      });
                      await loadSystem();
                    })}
                  />
                  Enable direct messages
                </label>
                
                <label>
                  <input 
                    type="checkbox" 
                    checked={system?.config?.groupCreationEnabled !== false}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ groupCreationEnabled: e.target.checked }),
                      });
                      await loadSystem();
                    })}
                  />
                  Allow group creation
                </label>
              </div>
              
              <div className="security-card">
                <h3>Rate Limits</h3>
                <label>
                  Max login attempts per minute
                  <input 
                    type="number" 
                    className="admin-input"
                    value={system?.config?.maxLoginAttempts || 5}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ maxLoginAttempts: Number(e.target.value) }),
                      });
                      await loadSystem();
                    })}
                  />
                </label>
                
                <label>
                  Max messages per minute
                  <input 
                    type="number" 
                    className="admin-input"
                    value={system?.config?.maxMessagesPerMinute || 60}
                    onChange={(e) => act(async () => {
                      await adminFetch("/system", {
                        method: "PATCH",
                        body: JSON.stringify({ maxMessagesPerMinute: Number(e.target.value) }),
                      });
                      await loadSystem();
                    })}
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {tab === "maintenance" && (
          <section className="admin-section">
            <h2>System Maintenance</h2>
            <p className="muted">System maintenance and cleanup tools</p>
            
            <div className="maintenance-grid">
              <div className="maintenance-card">
                <h3>Cache Management</h3>
                <RippleButton
                  type="button"
                  onClick={() =>
                    act(async () => {
                      await adminFetch("/cache/clear", { method: "POST" });
                      alert("Cache cleared successfully");
                    })
                  }
                >
                  Clear System Cache
                </RippleButton>
                <p className="muted">Clears all temporary caches</p>
              </div>
              
              <div className="maintenance-card">
                <h3>Log Management</h3>
                <RippleButton
                  type="button"
                  onClick={() =>
                    act(async () => {
                      await adminFetch("/logs/archive", { method: "POST" });
                      alert("Old logs archived successfully");
                    })
                  }
                >
                  Archive Old Logs
                </RippleButton>
                <p className="muted">Archives logs older than 30 days</p>
              </div>
              
              <div className="maintenance-card">
                <h3>Database</h3>
                <RippleButton
                  type="button"
                  onClick={() =>
                    act(async () => {
                      const d = await adminFetch("/backup", { method: "POST" });
                      alert("Backup created: " + d.backupId);
                    })
                  }
                >
                  Create Backup
                </RippleButton>
                <p className="muted">Creates a full system backup</p>
              </div>
              
              <div className="maintenance-card danger">
                <h3>Danger Zone</h3>
                <RippleButton
                  type="button"
                  className="danger"
                  onClick={() =>
                    act(async () => {
                      if (!window.confirm("Restart Node process?\n\nAll connections will be lost.")) return;
                      await adminFetch("/restart", { method: "POST" });
                    })
                  }
                >
                  Restart Server
                </RippleButton>
                <p className="muted warning">Immediately restarts the server</p>
              </div>
            </div>
          </section>
        )}

        {tab === "system" && (
          <section className="admin-section">
            {system && (
              <div className="admin-form">
                <label>
                  Max message length
                  <input
                    type="number"
                    defaultValue={system.config?.maxMessageLength}
                    onBlur={(e) =>
                      act(async () => {
                        await adminFetch("/system", {
                          method: "PATCH",
                          body: JSON.stringify({ maxMessageLength: Number(e.target.value) }),
                        });
                        await loadSystem();
                      })
                    }
                  />
                </label>
                <label>
                  Rate limit (ms)
                  <input
                    type="number"
                    defaultValue={system.config?.rateLimitGlobalMs}
                    onBlur={(e) =>
                      act(async () => {
                        await adminFetch("/system", {
                          method: "PATCH",
                          body: JSON.stringify({ rateLimitGlobalMs: Number(e.target.value) }),
                        });
                        await loadSystem();
                      })
                    }
                  />
                </label>
                <label>
                  Slow mode (seconds)
                  <input
                    type="number"
                    defaultValue={system.config?.slowModeSeconds}
                    onBlur={(e) =>
                      act(async () => {
                        await adminFetch("/chat/slowmode", {
                          method: "POST",
                          body: JSON.stringify({ seconds: Number(e.target.value) }),
                        });
                        await loadSystem();
                      })
                    }
                  />
                </label>
                <div className="admin-row">
                  <RippleButton
                    type="button"
                    onClick={() =>
                      act(async () => {
                        await adminFetch("/chat/freeze", {
                          method: "POST",
                          body: JSON.stringify({ frozen: !system.config?.chatFrozen }),
                        });
                        await loadSystem();
                      })
                    }
                  >
                    Toggle chat freeze
                  </RippleButton>
                  <RippleButton
                    type="button"
                    onClick={() =>
                      act(async () => {
                        await adminFetch("/maintenance", {
                          method: "POST",
                          body: JSON.stringify({ enabled: !system.config?.maintenanceMode }),
                        });
                        await loadSystem();
                      })
                    }
                  >
                    Toggle maintenance
                  </RippleButton>
                </div>
                <label>
                  Broadcast
                  <textarea
                    className="admin-textarea"
                    placeholder="Announcement text"
                    id="bc-text"
                  />
                  <RippleButton
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("bc-text");
                      const text = el?.value?.trim();
                      if (!text) return;
                      act(async () => {
                        await adminFetch("/broadcast", { method: "POST", body: JSON.stringify({ text }) });
                      });
                    }}
                  >
                    Send broadcast
                  </RippleButton>
                </label>
                <label>
                  Profanity word
                  <input className="admin-input" id="prof" />
                  <RippleButton
                    type="button"
                    onClick={() => {
                      const w = document.getElementById("prof")?.value?.trim();
                      if (!w) return;
                      act(async () => {
                        await adminFetch("/profanity", { method: "POST", body: JSON.stringify({ word: w }) });
                        await loadSystem();
                      });
                    }}
                  >
                    Add filter
                  </RippleButton>
                </label>
                <div className="admin-row">
                  <RippleButton
                    type="button"
                    onClick={() =>
                      act(async () => {
                        await adminFetch("/backup", { method: "POST", body: JSON.stringify({}) });
                      })
                    }
                  >
                    Memory backup (JSON response in network tab)
                  </RippleButton>
                  <RippleButton
                    type="button"
                    className="danger"
                    onClick={() =>
                      act(async () => {
                        if (!window.confirm("Restart Node process?")) return;
                        await adminFetch("/restart", { method: "POST", body: JSON.stringify({}) });
                      })
                    }
                  >
                    Restart server
                  </RippleButton>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "audit" && (
          <section className="admin-section">
            <table className="admin-table compact">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id}>
                    <td>{e.at}</td>
                    <td>{e.actorUsername}</td>
                    <td>{e.action}</td>
                    <td className="mono">{String(e.target)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </motion.div>
  );
}
