import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertCircle, X, Search, Filter, Download, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Clock, User, Terminal, FileText,
  Bug, AlertTriangle, Info, CheckCircle, MoreHorizontal,
  Copy, ExternalLink, Calendar, Activity, BarChart3,
  Play, Pause, Zap, Server, Database, Wifi, Layers,
  Maximize2, Minimize2, RotateCcw, Save, Eye, EyeOff,
  Flag, FlagOff, Archive, ArchiveRestore
} from "lucide-react";
import { adminFetch } from "../../api/adminHttp";
import RippleButton from "../ui/RippleButton";
import { useT } from "../../context/LocaleContext";

const SEVERITIES = [
  { id: "critical", label: "Critical", color: "#f23f43", icon: AlertCircle },
  { id: "error", label: "Error", color: "#f23f43", icon: Bug },
  { id: "warning", label: "Warning", color: "#f0b232", icon: AlertTriangle },
  { id: "info", label: "Info", color: "#6678ff", icon: Info },
  { id: "debug", label: "Debug", color: "#9da5b5", icon: Terminal },
];

const TIME_RANGES = [
  { id: "1h", label: "Last Hour", value: 3600000 },
  { id: "6h", label: "Last 6 Hours", value: 21600000 },
  { id: "24h", label: "Last 24 Hours", value: 86400000 },
  { id: "7d", label: "Last 7 Days", value: 604800000 },
  { id: "30d", label: "Last 30 Days", value: 2592000000 },
  { id: "all", label: "All Time", value: Infinity },
];

const SOURCES = [
  { id: "socket", label: "Socket.IO" },
  { id: "api", label: "API" },
  { id: "auth", label: "Auth" },
  { id: "database", label: "Database" },
  { id: "webrtc", label: "WebRTC" },
  { id: "media", label: "Media" },
  { id: "storage", label: "Storage" },
  { id: "system", label: "System" },
];

export default function AdminErrorLogs({ socket }) {
  const t = useT();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [searchQ, setSearchQ] = useState("");
  const [filters, setFilters] = useState({
    severity: "all",
    source: "all",
    user: "all",
    timeRange: "24h",
  });
  const [sortConfig, setSortConfig] = useState({ key: "timestamp", order: "desc" });
  const [realtimeMode, setRealtimeMode] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(true);
  const [errorSources, setErrorSources] = useState([]);
  const [errorUsers, setErrorUsers] = useState([]);
  const [liveStats, setLiveStats] = useState({ count: 0, bySeverity: {} });
  const [archivedCount, setArchivedCount] = useState(0);
  
  const logsEndRef = useRef(null);
  const realtimeInterval = useRef(null);
  const containerRef = useRef(null);

  const loadLogs = useCallback(async (append = false) => {
    try {
      if (!append) setLoading(true);
      
      const params = new URLSearchParams();
      if (filters.severity !== "all") params.append("severity", filters.severity);
      if (filters.source !== "all") params.append("source", filters.source);
      if (filters.user !== "all") params.append("user", filters.user);
      if (filters.timeRange !== "all") params.append("timeRange", filters.timeRange);
      if (searchQ) params.append("q", searchQ);
      params.append("sort", sortConfig.key);
      params.append("order", sortConfig.order);
      params.append("limit", "500");
      
      console.log("[AdminErrorLogs] Fetching from /admin/errors?" + params.toString());
      
      const d = await adminFetch(`/errors?${params}`);
      
      console.log("[AdminErrorLogs] Response:", d);
      
      if (!d || typeof d !== 'object') {
        throw new Error("Invalid response from server");
      }
      
      if (append && realtimeMode) {
        setLogs(prev => {
          const newLogs = d.errors?.filter(e => !prev.some(p => p.id === e.id)) || [];
          if (newLogs.length > 0) {
            return [...newLogs, ...prev].slice(0, 1000);
          }
          return prev;
        });
      } else {
        setLogs(d.errors || []);
      }
      
      setStats(d.stats || null);
      setErrorSources(d.sources || []);
      setErrorUsers(d.users || []);
      setArchivedCount(d.archivedCount || 0);
    } catch (e) {
      console.error("Failed to load error logs:", e);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQ, sortConfig, realtimeMode]);

  const loadStats = useCallback(async () => {
    try {
      const d = await adminFetch("/errors/stats");
      setStats(d);
      setLiveStats({
        count: d.total || 0,
        bySeverity: d.bySeverity || {},
      });
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!realtimeMode) {
      if (realtimeInterval.current) clearInterval(realtimeInterval.current);
      return;
    }
    
    realtimeInterval.current = setInterval(() => {
      loadLogs(true);
      loadStats();
    }, 3000);
    
    return () => {
      if (realtimeInterval.current) clearInterval(realtimeInterval.current);
    };
  }, [loadLogs, loadStats, realtimeMode]);

  // Socket.io real-time error streaming
  useEffect(() => {
    if (!socket) return;
    
    const onNewError = (error) => {
      if (realtimeMode) {
        setLogs(prev => [error, ...prev].slice(0, 1000));
        setLiveStats(prev => ({
          count: prev.count + 1,
          bySeverity: {
            ...prev.bySeverity,
            [error.severity]: (prev.bySeverity[error.severity] || 0) + 1,
          },
        }));
      }
    };
    
    socket.on("error:new", onNewError);
    return () => socket.off("error:new", onNewError);
  }, [socket, realtimeMode]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logsEndRef.current && realtimeMode) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll, realtimeMode]);

  const deleteLog = async (id) => {
    try {
      await adminFetch(`/errors/${id}`, { method: "DELETE" });
      setLogs(prev => prev.filter(l => l.id !== id));
      if (selectedLog?.id === id) setSelectedLog(null);
    } catch (e) {
      console.error("Failed to delete log:", e);
    }
  };

  const deleteSelected = async () => {
    if (!confirm(t("Delete {count} selected logs?", { count: selectedLogs.size }))) return;
    try {
      await adminFetch("/errors/bulk-delete", {
        method: "POST",
        body: { ids: Array.from(selectedLogs) },
      });
      setLogs(prev => prev.filter(l => !selectedLogs.has(l.id)));
      setSelectedLogs(new Set());
    } catch (e) {
      console.error("Failed to delete logs:", e);
    }
  };

  const archiveOld = async (days = 7) => {
    if (!confirm(t("Archive all logs older than {days} days?", { days }))) return;
    try {
      await adminFetch("/errors/archive", { method: "POST", body: { days } });
      loadLogs();
    } catch (e) {
      console.error("Failed to archive logs:", e);
    }
  };

  const exportLogs = (format = "json") => {
    const data = filteredLogs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      severity: l.severity,
      source: l.source,
      message: l.message,
      stack: l.stack,
      user: l.user,
      metadata: l.metadata,
    }));
    
    let content, mime, ext;
    if (format === "json") {
      content = JSON.stringify(data, null, 2);
      mime = "application/json";
      ext = "json";
    } else if (format === "csv") {
      const headers = ["ID", "Timestamp", "Severity", "Source", "Message", "User", "Stack"];
      const rows = data.map(l => [
        l.id,
        l.timestamp,
        l.severity,
        l.source,
        `"${l.message?.replace(/"/g, '""')}"`,
        l.user?.username || "",
        `"${l.stack?.replace(/"/g, '""').replace(/\n/g, " ")}"`,
      ]);
      content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      mime = "text/csv";
      ext = "csv";
    }
    
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().split("T")[0]}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleLogExpand = (id) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLogSelect = (id) => {
    setSelectedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedLogs.size === filteredLogs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(filteredLogs.map(l => l.id)));
    }
  };

  const filteredLogs = logs.filter(l => {
    if (searchQ && !l.message?.toLowerCase().includes(searchQ.toLowerCase()) &&
        !l.source?.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const getSeverityStyle = (severity) => {
    const s = SEVERITIES.find(sev => sev.id === severity) || SEVERITIES[3];
    return { color: s.color, icon: s.icon };
  };

  return (
    <div className="admin-error-logs-container" ref={containerRef}>
      {/* Live Stats Bar */}
      <div className="live-stats-bar">
        <div className="stat-item">
          <Activity size={16} />
          <span className={realtimeMode ? "live-indicator" : ""}>
            {realtimeMode ? t("● LIVE") : t("○ PAUSED")}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{liveStats.count}</span>
          <span className="stat-label">{t("Total Errors")}</span>
        </div>
        {SEVERITIES.slice(0, 3).map(sev => (
          <div key={sev.id} className="stat-item">
            <sev.icon size={14} color={sev.color} />
            <span style={{ color: sev.color }}>
              {liveStats.bySeverity[sev.id] || 0}
            </span>
          </div>
        ))}
        <div className="stat-item">
          <Archive size={14} />
          <span>{t("{count} archived", { count: archivedCount })}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="error-logs-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder={t("Search errors...")}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>
          
          <RippleButton 
            onClick={() => setShowFilters(!showFilters)} 
            className={showFilters ? "active" : ""}
          >
            <Filter size={16} />
            {t("Filters")}
          </RippleButton>
          
          <RippleButton onClick={() => setRealtimeMode(!realtimeMode)}>
            {realtimeMode ? <Pause size={16} /> : <Play size={16} />}
            {realtimeMode ? t("Pause") : t("Resume")}
          </RippleButton>
        </div>
        
        <div className="toolbar-right">
          {selectedLogs.size > 0 && (
            <span className="selected-count">{t("{count} selected", { count: selectedLogs.size })}</span>
          )}
          
          <RippleButton onClick={selectAll}>
            {selectedLogs.size === filteredLogs.length ? t("Deselect All") : t("Select All")}
          </RippleButton>
          
          {selectedLogs.size > 0 && (
            <RippleButton onClick={deleteSelected} className="danger">
              <Trash2 size={16} />
              {t("Delete")}
            </RippleButton>
          )}
          
          <RippleButton onClick={() => exportLogs("json")}>
            <Download size={16} />
            {t("Export JSON")}
          </RippleButton>
          
          <RippleButton onClick={() => exportLogs("csv")}>
            <Download size={16} />
            {t("Export CSV")}
          </RippleButton>
          
          <RippleButton onClick={() => archiveOld(7)}>
            <Archive size={16} />
            {t("Archive Old")}
          </RippleButton>
          
          <RippleButton onClick={() => loadLogs()}>
            <RefreshCw size={16} />
          </RippleButton>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            className="filters-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="filter-row">
              <div className="filter-group">
                <label>{t("Severity")}</label>
                <select 
                  value={filters.severity} 
                  onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))}
                >
                  <option value="all">{t("All Severities")}</option>
                  {SEVERITIES.map(s => (
                    <option key={s.id} value={s.id}>{t(s.label)}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label>{t("Source")}</label>
                <select 
                  value={filters.source} 
                  onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
                >
                  <option value="all">{t("All Sources")}</option>
                  {SOURCES.map(s => (
                    <option key={s.id} value={s.id}>{t(s.label)}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label>{t("Time Range")}</label>
                <select 
                  value={filters.timeRange} 
                  onChange={e => setFilters(f => ({ ...f, timeRange: e.target.value }))}
                >
                  {TIME_RANGES.map(range => (
                    <option key={range.id} value={range.id}>{t(range.label)}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label>{t("User")}</label>
                <select 
                  value={filters.user} 
                  onChange={e => setFilters(f => ({ ...f, user: e.target.value }))}
                >
                  <option value="all">{t("All Users")}</option>
                  {errorUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="filter-row">
              <div className="filter-group">
                <label>{t("Sort By")}</label>
                <select 
                  value={sortConfig.key} 
                  onChange={e => setSortConfig({ ...sortConfig, key: e.target.value })}
                >
                  <option value="timestamp">{t("Timestamp")}</option>
                  <option value="severity">{t("Severity")}</option>
                  <option value="source">{t("Source")}</option>
                  <option value="user">{t("User")}</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>{t("Order")}</label>
                <select 
                  value={sortConfig.order} 
                  onChange={e => setSortConfig({ ...sortConfig, order: e.target.value })}
                >
                  <option value="desc">{t("Newest First")}</option>
                  <option value="asc">{t("Oldest First")}</option>
                </select>
              </div>
              
              <div className="filter-group checkbox">
                <label>
                  <input 
                    type="checkbox" 
                    checked={autoScroll} 
                    onChange={e => setAutoScroll(e.target.checked)} 
                  />
                  {t("Auto-scroll")}
                </label>
              </div>
              
              <div className="filter-group checkbox">
                <label>
                  <input 
                    type="checkbox" 
                    checked={viewMode === "compact"} 
                    onChange={e => setViewMode(e.target.checked ? "compact" : "list")} 
                  />
                  {t("Compact View")}
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      {stats && (
        <div className="error-stats-grid">
          {SEVERITIES.slice(0, 4).map(sev => {
            const count = stats.bySeverity?.[sev.id] || 0;
            const trend = stats.trends?.[sev.id] || 0;
            return (
              <motion.div 
                key={sev.id}
                className="error-stat-card"
                style={{ borderLeft: `3px solid ${sev.color}` }}
                whileHover={{ y: -2 }}
              >
                <div className="stat-header">
                  <sev.icon size={20} color={sev.color} />
                  <span style={{ color: sev.color }}>{t(sev.label)}</span>
                </div>
                <div className="stat-value">{count}</div>
                {trend !== 0 && (
                  <div className={`stat-trend ${trend > 0 ? "up" : "down"}`}>
                    {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(trend)}%
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Logs List */}
      <div className="logs-container">
        {loading && logs.length === 0 ? (
          <div className="loading-state">{t("Loading error logs...")}</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} color="#23a55a" />
            <p>{t("No errors found")}</p>
            <span>{t("Everything is running smoothly!")}</span>
          </div>
        ) : (
          <div className={`logs-list ${viewMode}`}>
            {filteredLogs.map((log, index) => {
              const sev = getSeverityStyle(log.severity);
              const isExpanded = expandedLogs.has(log.id);
              const isSelected = selectedLogs.has(log.id);
              const isNew = index < 5 && realtimeMode;
              
              return (
                <motion.div
                  key={log.id}
                  className={`log-item ${isExpanded ? "expanded" : ""} ${isSelected ? "selected" : ""} ${isNew ? "new" : ""}`}
                  initial={isNew ? { opacity: 0, x: -20 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="log-header" onClick={() => toggleLogExpand(log.id)}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={e => {
                        e.stopPropagation();
                        toggleLogSelect(log.id);
                      }}
                    />
                    
                    <div className="severity-indicator" style={{ background: sev.color }}>
                      <sev.icon size={14} />
                    </div>
                    
                    <div className="log-meta">
                      <span className="timestamp">
                        <Clock size={12} />
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      <span className="source" style={{ color: sev.color }}>
                        [{log.source?.toUpperCase()}]
                      </span>
                      {log.user && (
                        <span className="user">
                          <User size={12} />
                          {log.user.username}
                        </span>
                      )}
                    </div>
                    
                    <p className="log-message">{log.message}</p>
                    
                    <div className="log-actions">
                      <RippleButton onClick={e => {
                        e.stopPropagation();
                        setSelectedLog(log);
                      }}>
                        <Eye size={14} />
                      </RippleButton>
                      <RippleButton onClick={e => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(log.stack || log.message);
                      }}>
                        <Copy size={14} />
                      </RippleButton>
                      <RippleButton onClick={e => {
                        e.stopPropagation();
                        deleteLog(log.id);
                      }} className="danger">
                        <Trash2 size={14} />
                      </RippleButton>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <motion.div 
                      className="log-details"
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                    >
                      {/* Error Info */}
                      <div className="error-main-info">
                        <h4>{t("Error Details")}</h4>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="label">{t("Error Type:")}</span>
                            <span className="value error-type">{log.name || t("Error")}</span>
                          </div>
                          {log.category && (
                            <div className="info-item">
                              <span className="label">{t("Category:")}</span>
                              <span className="value error-category">{log.category}</span>
                            </div>
                          )}
                          {log.severity && (
                            <div className="info-item">
                              <span className="label">{t("Severity:")}</span>
                              <span className={`value severity-${log.severity.toLowerCase()}`}>{log.severity}</span>
                            </div>
                          )}
                        </div>
                        <div className="error-message-box">
                          <strong>{t("Message:")}</strong>
                          <p>{log.message}</p>
                        </div>
                      </div>

                      {/* User Info */}
                      <div className="user-info-section">
                        <h4>{t("User Information")}</h4>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="label">{t("Username:")}</span>
                            <span className="value">{log.username || t("Anonymous")}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">{t("User ID:")}</span>
                            <span className="value user-id">{log.userId || t("anonymous")}</span>
                          </div>
                          {log.userEmail && (
                            <div className="info-item">
                              <span className="label">{t("Email:")}</span>
                              <span className="value">{log.userEmail}</span>
                            </div>
                          )}
                          {log.userRole && (
                            <div className="info-item">
                              <span className="label">{t("Role:")}</span>
                              <span className="value">{log.userRole}</span>
                            </div>
                          )}
                          {log.sessionId && (
                            <div className="info-item">
                              <span className="label">{t("Session ID:")}</span>
                              <span className="value session-id">{log.sessionId}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* System Info */}
                      <div className="system-info-section">
                        <h4>{t("System Information")}</h4>
                        <div className="info-grid">
                          <div className="info-item">
                            <span className="label">{t("URL:")}</span>
                            <span className="value url">{log.url || t("N/A")}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">{t("Platform:")}</span>
                            <span className="value">{log.platform || t("Unknown")}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">{t("Language:")}</span>
                            <span className="value">{log.language || t("Unknown")}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">{t("Screen:")}</span>
                            <span className="value">{log.screenResolution || t("Unknown")}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">{t("Viewport:")}</span>
                            <span className="value">{log.viewport || t("Unknown")}</span>
                          </div>
                          <div className="info-item">
                            <span className="label">{t("Timezone:")}</span>
                            <span className="value">{log.timezone || t("Unknown")}</span>
                          </div>
                          <div className="info-item full-width">
                            <span className="label">{t("User Agent:")}</span>
                            <span className="value user-agent">{log.userAgent || t("Unknown")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Connection Info */}
                      {log.connection && (
                        <div className="connection-info-section">
                          <h4>{t("Connection Information")}</h4>
                          <div className="info-grid">
                            <div className="info-item">
                              <span className="label">{t("Network Type:")}</span>
                              <span className="value">{log.connection.effectiveType || t("Unknown")}</span>
                            </div>
                            {log.connection.downlink && (
                              <div className="info-item">
                                <span className="label">{t("Downlink:")}</span>
                                <span className="value">{log.connection.downlink} Mbps</span>
                              </div>
                            )}
                            {log.connection.rtt && (
                              <div className="info-item">
                                <span className="label">{t("RTT:")}</span>
                                <span className="value">{log.connection.rtt} ms</span>
                              </div>
                            )}
                            <div className="info-item">
                              <span className="label">{t("Online:")}</span>
                              <span className="value">{log.isOnline !== false ? t("Yes") : t("No")}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stack Trace */}
                      {log.stack && (
                        <div className="stack-trace">
                          <h4>{t("Stack Trace")}</h4>
                          <pre>{log.stack}</pre>
                        </div>
                      )}

                      {/* Component Stack (React) */}
                      {log.componentStack && (
                        <div className="component-stack">
                          <h4>{t("Component Stack")}</h4>
                          <pre>{log.componentStack}</pre>
                        </div>
                      )}

                      {/* Additional Metadata */}
                      {log.metadata && (
                        <div className="metadata">
                          <h4>{t("Additional Metadata")}</h4>
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <motion.div
            className="log-detail-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedLog(null)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{t("Error Details")}</h3>
                <button onClick={() => setSelectedLog(null)}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body">
              </div>
              <div>
                <label style={{ color: "#888" }}>{t("Severity:")}</label>
                <p style={{ 
                  color: selectedLog.severity === 'critical' ? '#ff0000' : 
                         selectedLog.severity === 'high' ? '#ff6b6b' : 
                         selectedLog.severity === 'medium' ? '#ffa500' : '#4ecdc4',
                  fontWeight: "bold",
                  margin: 0 
                }}>
                  {selectedLog.severity?.toUpperCase() || 'MEDIUM'}
                </p>
              </div>
              
              <div className="modal-actions">
                <RippleButton 
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2))}
                  className="secondary"
                >
                  <Copy size={16} />
                  {t("Copy JSON")}
                </RippleButton>
                <RippleButton onClick={() => deleteLog(selectedLog.id)} className="danger">
                  <Trash2 size={16} />
                  {t("Delete")}
                </RippleButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
