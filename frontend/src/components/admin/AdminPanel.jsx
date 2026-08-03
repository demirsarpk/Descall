import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ThumbsDown, Upload, Video, Voicemail, ZoomIn, ZoomOut, Megaphone,
  Coins, DollarSign, Wallet, Plus, Minus
} from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import { API_BASE_URL } from "../../config/api";
import RippleButton from "../ui/RippleButton";
import AdminFeedback from "./AdminFeedback";
import AdminErrorLogs from "./AdminErrorLogs";
import { Avatar } from "../ui/Avatar";
import { useT } from "../../context/LocaleContext";

const TABS = [
  { id: "overview", label: "admin.overview", icon: BarChart3 },
  { id: "activity", label: "admin.activity", icon: ActivityIcon },
  { id: "engagement", label: "admin.engagement", icon: Zap },
  { id: "growth", label: "admin.growth", icon: TrendingUp },
  { id: "topusers", label: "admin.topUsers", icon: Star },
  { id: "users", label: "admin.users", icon: Users },
  { id: "messages", label: "admin.messages", icon: MessageSquare },
  { id: "dm", label: "admin.dm", icon: Mail },
  { id: "sockets", label: "admin.sockets", icon: Wifi },
  { id: "errors", label: "admin.errors", icon: AlertCircle },
  { id: "feedback", label: "admin.feedback", icon: Bell },
  { id: "announcements", label: "admin.announcements", icon: Megaphone },
  { id: "casino", label: "admin.casino", icon: Coins },
  { id: "moderation", label: "admin.moderation", icon: Shield },
  { id: "analytics", label: "admin.analytics", icon: Activity },
  { id: "system", label: "admin.system", icon: Settings },
  { id: "security", label: "admin.security", icon: Lock },
  { id: "maintenance", label: "admin.maintenance", icon: Server },
  { id: "audit", label: "admin.audit", icon: FileText },
];

export default function AdminPanel({ socket, onClose, onAdminChanged }) {
  const t = useT();
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
  const [announcementDraft, setAnnouncementDraft] = useState({
    title: "", content: "", priority: "normal", color: "#5865F2",
    pinned: false, target: "all", emoji: "📢",
  });
  const [showComposePanel, setShowComposePanel] = useState(false);
  const [announcementSubmitting, setAnnouncementSubmitting] = useState(false);
  const [announcementError, setAnnouncementError] = useState("");

  // Success/Error Messages
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  
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
  
  // Casino/Credits States
  const [userCredits, setUserCredits] = useState([]);
  const [creditSearch, setCreditSearch] = useState("");
  const [selectedCreditUser, setSelectedCreditUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState(1000);
  const [creditReason, setCreditReason] = useState("");
  const [creditOperation, setCreditOperation] = useState("add"); // 'add' or 'remove'
  const [creditHistory, setCreditHistory] = useState([]);
  const [creditStats, setCreditStats] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  
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
      const list = (d.users || []).map((u) => ({
        ...u,
        is_admin: Boolean(u.is_admin) || u.role === "admin" || u.username === "admin",
      }));
      setUsers(list);
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
      
      // Fetch all users (high limit for accurate 24h activity)
      const d = await adminFetch("/users?limit=500");
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
      const usersRes = await adminFetch("/users?limit=500");
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
      const d = await adminFetch("/users?limit=500");
      const allUsers = d.users || [];
      const totalUsersCount = Number(d.total) || allUsers.length;
      
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
      
      // Calculate cumulative totals (prefer API exact total when available)
      const windowRegs = Object.values(dailyData).reduce((sum, day) => sum + day.newUsers, 0);
      let runningTotal = Math.max(0, totalUsersCount - windowRegs);
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
      const usersRes = await adminFetch("/users?limit=500");
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

  // Load casino/credits data
  const loadCasinoData = useCallback(async () => {
    try {
      const [creditsRes, historyRes, statsRes] = await Promise.all([
        adminFetch("/credits"),
        adminFetch("/credits/history?limit=100"),
        adminFetch("/credits/stats")
      ]);
      setUserCredits(creditsRes.users || []);
      setCreditHistory(historyRes.history || []);
      setCreditStats(statsRes);
      setGameHistory(historyRes.games || []);
    } catch (e) {
      console.error("[ADMIN] Failed to load casino data:", e);
      throw e;
    }
  }, []);

  // Credit management functions
  const updateUserCredits = async (userId, amount, operation, reason) => {
    try {
      // Ensure amount is a number
      const numericAmount = parseInt(amount, 10);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Invalid amount");
      }
      const res = await adminFetch("/credits/update", {
        method: "POST",
        body: JSON.stringify({ userId, amount: numericAmount, operation, reason })
      });
      setSuccessMessage(`Credits ${operation === 'add' ? 'added to' : 'removed from'} user successfully`);
      await loadCasinoData(); // Refresh data
      return res;
    } catch (e) {
      console.error("[Admin] Credit update error:", e);
      setErrorMessage(`Failed to update credits: ${e.message}`);
      throw e;
    }
  };

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
    if (tab === "casino") loadCasinoData().catch((e) => setErr(e.message));
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
function getTimeAgo(date, t) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t("Just now");
  if (diffMin < 60) return t("{count}m ago", { count: diffMin });
  if (diffHour < 24) return t("{count}h ago", { count: diffHour });
  if (diffDay < 7) return t("{count}d ago", { count: diffDay });
  return date.toLocaleDateString();
}

  const filteredUsers = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    if (!q) return users || [];
    return (users || []).filter((u) => {
      const name = String(u.username || "").toLowerCase();
      const id = String(u.id || "").toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [users, userQ]);

  const usersOnlineCount = useMemo(
    () => (users || []).filter((u) => u.isOnline).length,
    [users]
  );
  const usersAdminCount = useMemo(
    () => (users || []).filter((u) => u.is_admin).length,
    [users]
  );

  return (
    <motion.div
      className="admin-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="admin-container"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <header className="admin-top">
          {/* Success/Error Messages */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="admin-success-banner"
              >
                <CheckCircle size={16} />
                <span>{successMessage}</span>
              </motion.div>
            )}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="admin-error-banner"
              >
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

        <div className="admin-header-content">
          <div className="admin-header-icon">
            <Shield size={32} />
          </div>
          <div>
            <h1>{t("admin.title")}</h1>
            <p className="admin-sub">{t("admin.subtitle")}</p>
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
        {TABS.map((tabDef) => {
          const Icon = tabDef.icon;
          return (
            <motion.button
              key={tabDef.id}
              type="button"
              className={`admin-tab ${tab === tabDef.id ? "active" : ""}`}
              onClick={() => setTab(tabDef.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon size={16} />
              {t(tabDef.label)}
            </motion.button>
          );
        })}
      </nav>

      <div className="admin-body">
        {tab === "overview" && (
          <section className="admin-section">
            <h2>{t("Server stats")}</h2>
            {stats && (
              <div className="admin-grid">
                <div className="admin-card">
                  <span>{t("Uptime (s)")}</span>
                  <strong>{Math.floor(stats.uptime)}</strong>
                </div>
                <div className="admin-card">
                  <span>{t("Online")}</span>
                  <strong>{stats.onlineUsers}</strong>
                </div>
                <div className="admin-card">
                  <span>{t("#general msgs")}</span>
                  <strong>{stats.generalMessageCount}</strong>
                </div>
                <div className="admin-card">
                  <span>{t("DM threads")}</span>
                  <strong>{stats.dmConversationKeys}</strong>
                </div>
                <div className="admin-card">
                  <span>{t("Banned")}</span>
                  <strong>{stats.bannedUsers}</strong>
                </div>
                <div className="admin-card">
                  <span>{t("Audit entries")}</span>
                  <strong>{stats.auditEntries}</strong>
                </div>
              </div>
            )}
            <RippleButton type="button" onClick={() => act(loadStats)} disabled={busy}>
              {t("Refresh")}
            </RippleButton>
            {snapshot && (
              <div className="admin-live">
                <h3>{t("Live socket snapshot")}</h3>
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
                <h2>{t("24-Hour Activity Monitor")}</h2>
                <p className="activity-subtitle">
                  {t("Real-time tracking of user registrations and online activity")}
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
                    <span className="stat-label">{t("New Registrations")}</span>
                    <span className="stat-time">{t("Last 24h")}</span>
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
                    <span className="stat-label">{t("Active Users")}</span>
                    <span className="stat-time">{t("Last 24h")}</span>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Last Updated Info */}
            <div className="activity-toolbar">
              <div className="last-updated">
                <Clock size={14} />
                <span>
                  {t("Last updated")}: {activityLastUpdated 
                    ? activityLastUpdated.toLocaleTimeString() 
                    : t("Never")}
                </span>
              </div>
              <RippleButton 
                type="button" 
                onClick={() => act(loadActivity)} 
                disabled={activityLoading}
                className="refresh-btn"
              >
                <RefreshCw size={16} className={activityLoading ? "spin" : ""} />
                {activityLoading ? t("Loading...") : t("Refresh Now")}
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
                {t("New Registrations")}
                <span className="badge">{recentRegistrations.length}</span>
              </button>
              <button
                type="button"
                className={`sub-tab ${activitySubTab === "online" ? "active" : ""}`}
                onClick={() => setActivitySubTab("online")}
              >
                <Wifi size={16} />
                {t("Online Activity")}
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
                    <h3>{t("No New Registrations")}</h3>
                    <p>{t("No users registered in the last 24 hours")}</p>
                  </div>
                ) : (
                  <div className="activity-timeline">
                    {recentRegistrations.map((user, index) => {
                      const timeAgo = getTimeAgo(new Date(user.created_at), t);
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
                              <Avatar user={user} name={user.username} size={36} />
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
                    <h3>{t("No Online Activity")}</h3>
                    <p>{t("No users were online in the last 24 hours")}</p>
                  </div>
                ) : (
                  <div className="activity-timeline">
                    {recentOnlineUsers.map((user, index) => {
                      const timeAgo = getTimeAgo(new Date(user.last_seen), t);
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
                              <Avatar user={user} name={user.username} size={36} />
                              <div className="user-details">
                                <span className="username">
                                  {user.username}
                                  {isCurrentlyOnline && (
                                    <span className="online-indicator">● {t("Online Now")}</span>
                                  )}
                                </span>
                                <span className="user-id">{user.id.slice(0, 8)}...</span>
                              </div>
                            </div>
                            <div className="time-info">
                              <span className={`time-badge ${isCurrentlyOnline ? "online" : ""}`}>
                                {isCurrentlyOnline ? t("Currently Online") : timeAgo}
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

        {tab === "growth" && (() => {
          const days =
            growthPeriod === "24h" ? 1 : growthPeriod === "7d" ? 7 : 30;
          const chartDays = growthData.slice(-days);
          const maxUsers = Math.max(...chartDays.map((d) => d.newUsers), 1);
          const periodNew = chartDays.reduce((sum, d) => sum + d.newUsers, 0);
          const weekNew = growthData.slice(-7).reduce((sum, d) => sum + d.newUsers, 0);
          const monthNew = growthData.slice(-30).reduce((sum, d) => sum + d.newUsers, 0);
          const totalUsers = growthData[growthData.length - 1]?.totalUsers || 0;

          return (
          <section className="admin-section admin-growth-section">
            <div className="activity-header">
              <div className="activity-title-section">
                <h2>{t("admin.growthTitle")}</h2>
                <p className="activity-subtitle">
                  {t("admin.growthSubtitle")}
                </p>
              </div>
              <div className="period-selector" role="tablist" aria-label={t("Growth period")}>
                <button
                  type="button"
                  className={growthPeriod === "24h" ? "active" : ""}
                  onClick={() => setGrowthPeriod("24h")}
                >
                  24h
                </button>
                <button
                  type="button"
                  className={growthPeriod === "7d" ? "active" : ""}
                  onClick={() => setGrowthPeriod("7d")}
                >
                  {t("7 Days")}
                </button>
                <button
                  type="button"
                  className={growthPeriod === "30d" ? "active" : ""}
                  onClick={() => setGrowthPeriod("30d")}
                >
                  {t("30 Days")}
                </button>
              </div>
            </div>

            <div className="activity-toolbar">
              <div className="last-updated">
                <Clock size={14} />
                <span>
                  {t("Last updated")}: {growthLastUpdated
                    ? growthLastUpdated.toLocaleTimeString()
                    : t("Never")}
                </span>
              </div>
              <RippleButton
                type="button"
                onClick={() => act(loadGrowth)}
                disabled={growthLoading}
                className="refresh-btn"
              >
                <RefreshCw size={16} className={growthLoading ? "spin" : ""} />
                {growthLoading ? t("Loading...") : t("Refresh")}
              </RippleButton>
            </div>

            <div className="growth-summary">
              <motion.div className="summary-card accent-green" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <span className="summary-label">{t("New ({period})", { period: growthPeriod })}</span>
                <span className="summary-value">{periodNew}</span>
              </motion.div>
              <motion.div className="summary-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <span className="summary-label">{t("New (7 days)")}</span>
                <span className="summary-value">{weekNew}</span>
              </motion.div>
              <motion.div className="summary-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <span className="summary-label">{t("New (30 days)")}</span>
                <span className="summary-value">{monthNew}</span>
              </motion.div>
              <motion.div className="summary-card accent-blue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <span className="summary-label">{t("Total Users")}</span>
                <span className="summary-value">{totalUsers}</span>
              </motion.div>
            </div>

            <div className="growth-chart-container">
              <h3>{t("admin.dailyRegs")}</h3>
              {chartDays.length === 0 ? (
                <div className="empty-state">
                  <TrendingUp size={40} className="empty-icon" />
                  <h3>{t("No growth data yet")}</h3>
                  <p>{t("Registration trends will appear here")}</p>
                </div>
              ) : (
                <div className="growth-chart" role="img" aria-label={t("Daily New Registrations")}>
                  {chartDays.map((day, index) => {
                    const height = day.newUsers > 0 ? Math.max(8, (day.newUsers / maxUsers) * 100) : 0;
                    const d = new Date(day.date);
                    return (
                      <div key={day.date} className="chart-bar-wrapper" title={t("{date}: {count} new", { date: day.date, count: day.newUsers })}>
                        <div className="chart-bar-container">
                          <motion.div
                            className={`chart-bar${day.newUsers === 0 ? " is-empty" : ""}`}
                            initial={{ height: 0 }}
                            animate={{ height: day.newUsers > 0 ? `${height}%` : 4 }}
                            transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {day.newUsers > 0 && (
                              <span className="bar-value">{day.newUsers}</span>
                            )}
                          </motion.div>
                        </div>
                        <span className="bar-label">
                          {growthPeriod === "30d"
                            ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : d.toLocaleDateString("en-US", { weekday: "short" })}
                          {growthPeriod !== "30d" && (
                            <span className="bar-date">
                              {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          );
        })()}

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
              {(topUsersMetric === "activity"
                ? [...topUsers].sort((a, b) => {
                    const ta = a.lastActive ? new Date(a.lastActive).getTime() : 0;
                    const tb = b.lastActive ? new Date(b.lastActive).getTime() : 0;
                    return tb - ta;
                  })
                : topUsers
              ).slice(0, 20).map((user, index) => (
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
                  <Avatar user={user} name={user.username} size={40} />
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
            <div className="activity-header">
              <div className="activity-title-section">
                <h2>{t("admin.users")}</h2>
                <p className="activity-subtitle">
                  {t("admin.manageUsers")}
                </p>
              </div>
              <RippleButton
                type="button"
                onClick={() => act(loadAllUsers)}
                disabled={busy}
                className="refresh-btn"
              >
                <RefreshCw size={16} className={busy ? "spin" : ""} />
                {t("Refresh")}
              </RippleButton>
            </div>

            <div className="admin-users-hero">
              <motion.div className="hero-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="hero-label">{t("Total Users")}</div>
                <div className="hero-value">{users.length}</div>
              </motion.div>
              <motion.div className="hero-card online" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <div className="hero-label">{t("Online Now")}</div>
                <div className="hero-value">{usersOnlineCount}</div>
              </motion.div>
              <motion.div className="hero-card admins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="hero-label">{t("Admins")}</div>
                <div className="hero-value">{usersAdminCount}</div>
              </motion.div>
            </div>

            <div className="admin-toolbar">
              <input
                className="admin-input"
                placeholder={t("Search username or ID…")}
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
              />
              <RippleButton type="button" onClick={() => act(loadAllUsers)} disabled={busy}>
                {t("Search")}
              </RippleButton>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t("Username")}</th>
                    <th>{t("ID")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Joined")}</th>
                    <th>{t("Admin")}</th>
                    <th>{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "rgba(244,246,251,0.45)", padding: 28 }}>
                        {users.length === 0 ? t("No users loaded") : t("No users match your search")}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                  <motion.tr key={u.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td>
                      <Avatar name={u.username} size={36} user={u} />
                    </td>
                    <td>{u.username}</td>
                    <td className="mono">{u.id.slice(0, 8)}…</td>
                    <td className="admin-status">
                      {u.isOnline ? (
                        <span className="admin-badge online">{t("Online")}</span>
                      ) : (
                        <span className="admin-badge offline">{t("Offline")}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="admin-status">
                      {u.is_admin ? (
                        <span className="admin-badge">{t("Admin")}</span>
                      ) : (
                        <span className="admin-badge-false">{t("User")}</span>
                      )}
                    </td>
                    <td className="admin-actions">
                      {u.is_admin ? (
                        <button
                          type="button"
                          className="admin-btn-red"
                          onClick={() =>
                            act(async () => {
                              const token = localStorage.getItem("descall_token");
                              const res = await fetch(`${API_BASE_URL}/api/admin/remove-admin/${u.id}`, {
                                method: "PUT",
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              if (res.ok) {
                                setUsers((prev) =>
                                  (prev || []).map((x) =>
                                    x.id === u.id ? { ...x, is_admin: false, role: "user" } : x
                                  )
                                );
                                await loadAllUsers();
                                onAdminChanged?.();
                              } else {
                                const body = await res.json().catch(() => ({}));
                                setErr(body.error || body.message || `Remove admin failed (${res.status})`);
                              }
                            })
                          }
                        >
                          {t("Remove Admin")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn-green"
                          onClick={() =>
                            act(async () => {
                              const token = localStorage.getItem("descall_token");
                              const res = await fetch(`${API_BASE_URL}/api/admin/make-admin/${u.id}`, {
                                method: "PUT",
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              if (res.ok) {
                                setUsers((prev) =>
                                  (prev || []).map((x) =>
                                    x.id === u.id ? { ...x, is_admin: true, role: "admin" } : x
                                  )
                                );
                                await loadAllUsers();
                                onAdminChanged?.();
                              } else {
                                const body = await res.json().catch(() => ({}));
                                setErr(body.error || body.message || `Make admin failed (${res.status})`);
                              }
                            })
                          }
                        >
                          {t("Make Admin")}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
          <section className="admin-section admin-section-full">
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  <Megaphone size={22} style={{ color: "#5865F2" }} /> Announcements
                </h2>
                <p className="muted" style={{ marginTop: 4 }}>Broadcast messages to all users in real-time</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <RippleButton type="button" onClick={() => act(loadAnnouncements)} disabled={busy} style={{ minWidth: 90 }}>
                  <RefreshCw size={14} /> Refresh
                </RippleButton>
                <RippleButton
                  type="button"
                  className={showComposePanel ? "admin-btn-red" : "admin-btn-green"}
                  onClick={() => { setShowComposePanel((v) => !v); setAnnouncementError(""); }}
                >
                  {showComposePanel ? <><X size={14} /> Cancel</> : <><Send size={14} /> Compose</>}
                </RippleButton>
              </div>
            </div>

            {/* Compose Panel */}
            <AnimatePresence>
              {showComposePanel && (
                <motion.div
                  key="compose"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    background: "var(--surface-2)",
                    border: `1px solid ${announcementDraft.color}44`,
                    borderRadius: 14,
                    padding: 24,
                    marginBottom: 28,
                    boxShadow: `0 0 0 1px ${announcementDraft.color}22, 0 8px 32px rgba(0,0,0,0.3)`,
                  }}
                >
                  <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--text-0)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Edit3 size={16} style={{ color: announcementDraft.color }} /> New Announcement
                  </h3>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    {/* Emoji picker quick-select */}
                    <div>
                      <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Icon</label>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {["📢", "🚨", "✅", "⚠️", "🔔", "🎉", "🔧", "📌"].map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setAnnouncementDraft((d) => ({ ...d, emoji: em }))}
                            style={{
                              width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 18,
                              background: announcementDraft.emoji === em ? announcementDraft.color + "33" : "var(--surface-3)",
                              outline: announcementDraft.emoji === em ? `2px solid ${announcementDraft.color}` : "none",
                              transition: "all 0.15s",
                            }}
                          >{em}</button>
                        ))}
                      </div>
                    </div>

                    {/* Priority + Color + Target */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Priority</label>
                          <select
                            className="admin-input"
                            value={announcementDraft.priority}
                            onChange={(e) => {
                              const colors = { normal: "#5865F2", important: "#F0B232", urgent: "#DA373C" };
                              setAnnouncementDraft((d) => ({ ...d, priority: e.target.value, color: colors[e.target.value] }));
                            }}
                            style={{ width: "100%" }}
                          >
                            <option value="normal">🔵 Normal</option>
                            <option value="important">🟡 Important</option>
                            <option value="urgent">🔴 Urgent</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Color</label>
                          <input
                            type="color"
                            value={announcementDraft.color}
                            onChange={(e) => setAnnouncementDraft((d) => ({ ...d, color: e.target.value }))}
                            style={{ width: 44, height: 38, border: "none", borderRadius: 8, cursor: "pointer", padding: 2, background: "transparent" }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Target Audience</label>
                        <select
                          className="admin-input"
                          value={announcementDraft.target}
                          onChange={(e) => setAnnouncementDraft((d) => ({ ...d, target: e.target.value }))}
                          style={{ width: "100%" }}
                        >
                          <option value="all">👥 All Users</option>
                          <option value="online">🟢 Online Users</option>
                          <option value="admins">🛡️ Admins Only</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Title</label>
                    <input
                      className="admin-input"
                      placeholder="Announcement title..."
                      value={announcementDraft.title}
                      onChange={(e) => setAnnouncementDraft((d) => ({ ...d, title: e.target.value }))}
                      maxLength={100}
                      style={{ width: "100%", fontSize: 15, fontWeight: 600 }}
                    />
                  </div>

                  {/* Content */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Message</label>
                    <textarea
                      className="admin-input"
                      placeholder="Write your announcement content..."
                      value={announcementDraft.content}
                      onChange={(e) => setAnnouncementDraft((d) => ({ ...d, content: e.target.value }))}
                      rows={4}
                      maxLength={1000}
                      style={{ width: "100%", resize: "vertical", lineHeight: 1.6 }}
                    />
                    <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      {announcementDraft.content.length}/1000
                    </div>
                  </div>

                  {/* Pin toggle */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                    <button
                      type="button"
                      onClick={() => setAnnouncementDraft((d) => ({ ...d, pinned: !d.pinned }))}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, padding: "7px 14px",
                        borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                        background: announcementDraft.pinned ? announcementDraft.color + "22" : "var(--surface-3)",
                        color: announcementDraft.pinned ? announcementDraft.color : "var(--text-2)",
                        outline: announcementDraft.pinned ? `1.5px solid ${announcementDraft.color}` : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <Flag size={13} /> {announcementDraft.pinned ? "Pinned" : "Pin to top"}
                    </button>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Pinned announcements appear at the top of the list</span>
                  </div>

                  {/* Live Preview */}
                  {(announcementDraft.title || announcementDraft.content) && (
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Preview</label>
                      <div style={{
                        background: "var(--surface-1)", borderRadius: 12, padding: "14px 16px",
                        borderLeft: `4px solid ${announcementDraft.color}`,
                        border: `1px solid ${announcementDraft.color}33`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 18 }}>{announcementDraft.emoji}</span>
                          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-0)" }}>{announcementDraft.title || "Untitled"}</span>
                          {announcementDraft.pinned && <Flag size={12} style={{ color: announcementDraft.color }} />}
                          <span style={{
                            marginLeft: "auto", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                            padding: "2px 8px", borderRadius: 4,
                            background: announcementDraft.priority === "urgent" ? "#DA373C22" : announcementDraft.priority === "important" ? "#F0B23222" : "#5865F222",
                            color: announcementDraft.priority === "urgent" ? "#DA373C" : announcementDraft.priority === "important" ? "#F0B232" : "#5865F2",
                          }}>{announcementDraft.priority}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{announcementDraft.content || "No message yet."}</p>
                      </div>
                    </div>
                  )}

                  {announcementError && (
                    <div style={{ background: "#DA373C22", border: "1px solid #DA373C44", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#DA373C", display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertCircle size={14} /> {announcementError}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <RippleButton type="button" onClick={() => setShowComposePanel(false)}>Cancel</RippleButton>
                    <RippleButton
                      type="button"
                      className="admin-btn-green"
                      disabled={announcementSubmitting || !announcementDraft.title.trim() || !announcementDraft.content.trim()}
                      onClick={async () => {
                        setAnnouncementSubmitting(true);
                        setAnnouncementError("");
                        try {
                          const token = localStorage.getItem("descall_token");
                          const res = await fetch(`${API_BASE_URL}/api/admin/announcements`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify(announcementDraft),
                          });
                          if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            throw new Error(body.error || `Server error ${res.status}`);
                          }
                          setAnnouncementDraft({ title: "", content: "", priority: "normal", color: "#5865F2", pinned: false, target: "all", emoji: "📢" });
                          setShowComposePanel(false);
                          await loadAnnouncements();
                        } catch (e) {
                          setAnnouncementError(e.message);
                        } finally {
                          setAnnouncementSubmitting(false);
                        }
                      }}
                    >
                      {announcementSubmitting ? "Sending..." : <><Send size={14} /> Publish</>}
                    </RippleButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Announcements list */}
            {announcements.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
                <Megaphone size={44} style={{ opacity: 0.3, marginBottom: 14 }} />
                <p style={{ margin: 0, fontSize: 15 }}>No announcements yet</p>
                <p style={{ margin: "6px 0 0", fontSize: 13 }}>Compose one above to broadcast to your users.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...announcements]
                  .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.created_at) - new Date(a.created_at))
                  .map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      style={{
                        background: "var(--surface-2)",
                        borderRadius: 12,
                        padding: "16px 18px",
                        borderLeft: `4px solid ${a.color || "#5865F2"}`,
                        border: `1px solid ${(a.color || "#5865F2")}22`,
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{a.emoji || "📢"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-0)" }}>{a.title}</span>
                            {a.pinned && (
                              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: a.color || "#5865F2", fontWeight: 600 }}>
                                <Flag size={11} /> Pinned
                              </span>
                            )}
                            <span style={{
                              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                              padding: "2px 8px", borderRadius: 4,
                              background: a.priority === "urgent" ? "#DA373C22" : a.priority === "important" ? "#F0B23222" : "#5865F222",
                              color: a.priority === "urgent" ? "#DA373C" : a.priority === "important" ? "#F0B232" : "#5865F2",
                            }}>{a.priority}</span>
                            {a.target && a.target !== "all" && (
                              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", background: "var(--surface-3)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                {a.target}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{a.content}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
                            {a.author && <span>By <strong style={{ color: "var(--text-3)" }}>{a.author}</strong></span>}
                            <span>·</span>
                            <span>{new Date(a.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button
                            type="button"
                            title={a.pinned ? "Unpin" : "Pin"}
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem("descall_token");
                                await fetch(`${API_BASE_URL}/api/admin/announcements/${a.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                  body: JSON.stringify({ pinned: !a.pinned }),
                                });
                                await loadAnnouncements();
                              } catch (e) { console.error("Pin toggle failed:", e); }
                            }}
                            style={{
                              background: a.pinned ? (a.color || "#5865F2") + "22" : "var(--surface-3)",
                              border: "none", borderRadius: 7, width: 32, height: 32,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", color: a.pinned ? (a.color || "#5865F2") : "var(--text-muted)",
                              transition: "all 0.15s",
                            }}
                          >
                            <Flag size={14} />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem("descall_token");
                                const res = await fetch(`${API_BASE_URL}/api/admin/announcements/${a.id}`, {
                                  method: "DELETE",
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                if (res.ok) await loadAnnouncements();
                              } catch (e) { console.error("Failed to delete announcement:", e); }
                            }}
                            style={{
                              background: "var(--surface-3)", border: "none", borderRadius: 7, width: 32, height: 32,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", color: "var(--text-muted)", transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#DA373C22"; e.currentTarget.style.color = "#DA373C"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            )}
          </section>
        )}

        {tab === "casino" && (
          <section className="admin-section admin-section-full">
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                  <Coins size={22} style={{ color: "#f59e0b" }} /> Casino / Credits Management
                </h2>
                <p className="muted" style={{ marginTop: 4 }}>Manage user credits and view Blackjack statistics</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <RippleButton type="button" onClick={() => act(loadCasinoData)} disabled={busy} style={{ minWidth: 90 }}>
                  <RefreshCw size={14} /> Refresh
                </RippleButton>
              </div>
            </div>

            {/* Stats Overview */}
            {creditStats && (
              <div className="admin-grid" style={{ marginBottom: 24 }}>
                <div className="admin-card" style={{ background: "linear-gradient(135deg, #f59e0b22, #d9770622)", borderColor: "#f59e0b44" }}>
                  <span style={{ color: "#f59e0b" }}>Total Credits in System</span>
                  <strong style={{ color: "#f59e0b", fontSize: 24 }}>{(creditStats.totalCredits || 0).toLocaleString()}</strong>
                </div>
                <div className="admin-card">
                  <span>Total Players</span>
                  <strong>{creditStats.totalPlayers || 0}</strong>
                </div>
                <div className="admin-card">
                  <span>Games Played</span>
                  <strong>{creditStats.totalGames || 0}</strong>
                </div>
                <div className="admin-card">
                  <span>Avg Credits/User</span>
                  <strong>{Math.round((creditStats.totalCredits || 0) / (creditStats.totalPlayers || 1)).toLocaleString()}</strong>
                </div>
              </div>
            )}

            {/* Credit Management Section */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
              {/* Search and Manage Users */}
              <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: 20, border: "1px solid var(--border-2)" }}>
                <h3 style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Search size={18} /> Find User
                </h3>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input
                    className="admin-input"
                    placeholder="Search by username..."
                    value={creditSearch}
                    onChange={(e) => setCreditSearch(e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                
                {/* User List */}
                <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {userCredits
                    .filter(u => !creditSearch || u.username?.toLowerCase().includes(creditSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(user => (
                      <motion.div
                        key={user.user_id}
                        onClick={() => setSelectedCreditUser(user)}
                        style={{
                          padding: "12px 14px",
                          background: selectedCreditUser?.user_id === user.user_id ? "rgba(102, 120, 255, 0.2)" : "var(--surface-3)",
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          border: selectedCreditUser?.user_id === user.user_id ? "1px solid #6678ff" : "1px solid transparent",
                        }}
                        whileHover={{ scale: 1.01 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ 
                            width: 36, height: 36, borderRadius: "50%", 
                            background: "linear-gradient(135deg, #6678ff, #7d6bff)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontWeight: 600, fontSize: 14, color: "white"
                          }}>
                            {user.username?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{user.username || "Unknown"}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>ID: {user.user_id?.slice(0, 8)}...</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: 16, color: "#f59e0b" }}>
                            <Wallet size={14} style={{ display: "inline", marginRight: 4 }} />
                            {user.credits?.toLocaleString() || 0}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {user.games_played || 0} games
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  {userCredits.filter(u => !creditSearch || u.username?.toLowerCase().includes(creditSearch.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                      <p>No users found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Credit Operations */}
              <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: 20, border: "1px solid var(--border-2)" }}>
                <h3 style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <DollarSign size={18} /> Manage Credits
                </h3>
                
                {selectedCreditUser ? (
                  <div>
                    <div style={{ 
                      background: "var(--surface-3)", 
                      padding: "14px 16px", 
                      borderRadius: 10, 
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{selectedCreditUser.username}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Current Balance</div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
                        {selectedCreditUser.credits?.toLocaleString() || 0}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setCreditOperation("add")}
                          style={{
                            flex: 1,
                            padding: "10px",
                            borderRadius: 8,
                            border: "none",
                            cursor: "pointer",
                            background: creditOperation === "add" ? "#22c55e" : "var(--surface-3)",
                            color: creditOperation === "add" ? "white" : "var(--text-1)",
                            fontWeight: 600,
                          }}
                        >
                          <Plus size={14} style={{ display: "inline", marginRight: 6 }} />
                          Add Credits
                        </button>
                        <button
                          onClick={() => setCreditOperation("remove")}
                          style={{
                            flex: 1,
                            padding: "10px",
                            borderRadius: 8,
                            border: "none",
                            cursor: "pointer",
                            background: creditOperation === "remove" ? "#ef4444" : "var(--surface-3)",
                            color: creditOperation === "remove" ? "white" : "var(--text-1)",
                            fontWeight: 600,
                          }}
                        >
                          <Minus size={14} style={{ display: "inline", marginRight: 6 }} />
                          Remove Credits
                        </button>
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Amount</label>
                        <input
                          type="number"
                          className="admin-input"
                          value={creditAmount}
                          onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                          min="1"
                          max="1000000"
                          style={{ width: "100%" }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "block" }}>Reason (optional)</label>
                        <input
                          className="admin-input"
                          value={creditReason}
                          onChange={(e) => setCreditReason(e.target.value)}
                          placeholder="e.g., Bonus, Correction, etc."
                          style={{ width: "100%" }}
                        />
                      </div>

                      <RippleButton
                        type="button"
                        className={creditOperation === "add" ? "admin-btn-green" : "admin-btn-red"}
                        onClick={() => act(() => updateUserCredits(selectedCreditUser.user_id, creditAmount, creditOperation, creditReason))}
                        disabled={busy || creditAmount <= 0}
                        style={{ width: "100%", marginTop: 8 }}
                      >
                        {busy ? "Processing..." : (
                          <>{creditOperation === "add" ? <Plus size={16} /> : <Minus size={16} />} {creditOperation === "add" ? "Add" : "Remove"} {creditAmount.toLocaleString()} Credits</>
                        )}
                      </RippleButton>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                    <Coins size={44} style={{ opacity: 0.3, marginBottom: 14 }} />
                    <p>Select a user from the list to manage their credits</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Game History */}
            <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: 20, border: "1px solid var(--border-2)" }}>
              <h3 style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                <History size={18} /> Recent Game History
              </h3>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Bet</th>
                      <th>Result</th>
                      <th>Win Amount</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameHistory.slice(0, 20).map((game, idx) => (
                      <tr key={idx}>
                        <td>{game.username || game.user_id?.slice(0, 8)}</td>
                        <td>{game.bet_amount?.toLocaleString() || 0}</td>
                        <td>
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            background: game.result === 'win' || game.result === 'blackjack' ? '#22c55e22' : game.result === 'loss' ? '#ef444422' : '#6b728022',
                            color: game.result === 'win' || game.result === 'blackjack' ? '#22c55e' : game.result === 'loss' ? '#ef4444' : '#9ca3af',
                          }}>
                            {game.result?.toUpperCase() || 'PUSH'}
                          </span>
                        </td>
                        <td style={{ color: game.win_amount > 0 ? '#22c55e' : 'var(--text-1)' }}>
                          {game.win_amount > 0 ? '+' : ''}{game.win_amount?.toLocaleString() || 0}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-muted)" }}>
                          {game.played_at ? new Date(game.played_at).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                    {gameHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                          No games played yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                      setSuccessMessage("Cache cleared successfully");
                      setTimeout(() => setSuccessMessage(""), 3000);
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
                      setSuccessMessage("Old logs archived successfully");
                      setTimeout(() => setSuccessMessage(""), 3000);
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
                      setSuccessMessage("Backup created: " + d.backupId);
                      setTimeout(() => setSuccessMessage(""), 5000);
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
    </motion.div>
  );
}
