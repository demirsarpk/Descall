import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Settings, Users, Shield,
  Database, Activity, Zap,
  Globe, Lock, Bell, Palette,
  ChevronRight, Check, AlertTriangle, RefreshCw, Ban, Trash2
} from "lucide-react";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

export default function AdminMenu({ onClose, onLogout, me }) {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", icon: Activity, label: "Overview", desc: "System status and metrics" },
    { id: "users", icon: Users, label: "User Management", desc: "Manage users and permissions" },
    { id: "servers", icon: Shield, label: "Server Settings", desc: "Configure server options" },
    { id: "security", icon: Lock, label: "Security", desc: "Security settings and logs" },
    { id: "notifications", icon: Bell, label: "Notifications", desc: "Configure alerts" },
    { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme and styling" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="admin-menu-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: -320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -320, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="admin-menu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-header">
          <div className="admin-header-left">
            <div className="admin-icon">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="admin-title">Admin Panel</h2>
              <span className="admin-subtitle">System Management</span>
            </div>
          </div>
          <button 
            className="icon-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="admin-content">
          {/* Sidebar Navigation */}
          <div className="admin-sidebar">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  className={`admin-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon size={20} className="nav-icon" />
                  <div className="nav-content">
                    <span className="nav-label">{section.label}</span>
                    <span className="nav-desc">{section.desc}</span>
                  </div>
                  {isActive && <div className="nav-indicator" />}
                </button>
              );
            })}
          </div>

          {/* Main Panel */}
          <div className="admin-main">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="admin-panel"
              >
                {activeSection === "overview" && <OverviewSection />}
                {activeSection === "users" && <UsersSection />}
                {activeSection === "servers" && <ServersSection />}
                {activeSection === "security" && <SecuritySection />}
                {activeSection === "notifications" && <NotificationsSection />}
                {activeSection === "appearance" && <AppearanceSection />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="admin-footer">
          <span className="admin-version">Descall v1.3.0</span>
          <button className="admin-logout" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Shared API helper ─── */
function useAdminApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setData(json);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [path]);

  useEffect(() => { fetchData(); }, [fetchData]);
  return { data, loading, error, refresh: fetchData };
}

function OverviewSection() {
  const { data, loading, refresh } = useAdminApi("/api/admin/stats");
  return (
    <div className="admin-section">
      <h3 className="section-title">System Overview</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon online"><Users size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{loading ? "..." : data?.totalUsers ?? 0}</span>
            <span className="stat-label">Total Users</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success"><Activity size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{loading ? "..." : data?.onlineUsers ?? 0}</span>
            <span className="stat-label">Online Now</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning"><Shield size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{loading ? "..." : data?.groups ?? 0}</span>
            <span className="stat-label">Groups</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon danger"><Zap size={24} /></div>
          <div className="stat-content">
            <span className="stat-value">{loading ? "..." : data?.uptime ? `${Math.floor(data.uptime / 60)}m` : "0m"}</span>
            <span className="stat-label">Uptime</span>
          </div>
        </div>
      </div>
      <motion.button className="settings-action-btn small" onClick={refresh} whileTap={{ scale: 0.97 }} style={{ marginTop: 12 }}>
        <RefreshCw size={14} /> Refresh Stats
      </motion.button>
    </div>
  );
}

function UsersSection() {
  const { data, loading, error, refresh } = useAdminApi("/api/admin/users");
  const [updating, setUpdating] = useState("");
  const users = Array.isArray(data) ? data : [];

  const toggleRole = async (id, currentRole) => {
    const next = currentRole === "admin" ? "user" : "admin";
    setUpdating(id);
    try {
      const token = getToken();
      await fetch(`${API_BASE_URL}/api/admin/users/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: next }),
      });
      refresh();
    } catch (err) { console.error(err); }
    setUpdating("");
  };

  const banUser = async (id) => {
    if (!window.confirm("Ban this user?")) return;
    setUpdating(id);
    try {
      const token = getToken();
      await fetch(`${API_BASE_URL}/api/admin/users/${id}/ban`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      refresh();
    } catch (err) { console.error(err); }
    setUpdating("");
  };

  return (
    <div className="admin-section">
      <h3 className="section-title">User Management</h3>
      <p className="section-desc">Manage users, roles, and permissions</p>
      {error && <div className="add-modal-error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead><tr><th>User</th><th>Status</th><th>Role</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading users...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td><span className={`badge ${u.isOnline ? "online" : "offline"}`}>{u.isOnline ? "Online" : "Offline"}</span></td>
                <td><span className={`badge ${u.role === "admin" ? "admin" : "user"}`}>{u.role}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="table-action" disabled={updating === u.id} onClick={() => toggleRole(u.id, u.role)}>
                      {updating === u.id ? "..." : u.role === "admin" ? "Demote" : "Promote"}
                    </button>
                    <button className="table-action danger" disabled={updating === u.id} onClick={() => banUser(u.id)}>
                      <Ban size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <motion.button className="settings-action-btn small" onClick={refresh} whileTap={{ scale: 0.97 }} style={{ marginTop: 12 }}>
        <RefreshCw size={14} /> Refresh
      </motion.button>
    </div>
  );
}

function ServersSection() {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("descall_server_settings") || "{}"); }
    catch { return {}; }
  });
  const persist = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem("descall_server_settings", JSON.stringify(next));
  };

  return (
    <div className="admin-section">
      <h3 className="section-title">Server Settings</h3>
      <p className="section-desc">Configure server-wide options (stored locally)</p>
      <div className="toggle-row"><span>Registration Open</span><Toggle value={settings.registrationOpen !== false} onChange={(v) => persist("registrationOpen", v)} /></div>
      <div className="toggle-row"><span>Allow File Uploads</span><Toggle value={settings.fileUploads !== false} onChange={(v) => persist("fileUploads", v)} /></div>
      <div className="toggle-row"><span>Require Email Verification</span><Toggle value={settings.emailVerify === true} onChange={(v) => persist("emailVerify", v)} /></div>
      <div className="toggle-row"><span>Maintenance Mode</span><Toggle value={settings.maintenance === true} onChange={(v) => persist("maintenance", v)} /></div>
    </div>
  );
}

function SecuritySection() {
  const { data, loading, refresh } = useAdminApi("/api/admin/security-logs");
  const logs = Array.isArray(data) ? data : [];

  return (
    <div className="admin-section">
      <h3 className="section-title">Security Logs</h3>
      <p className="section-desc">Recent security events</p>
      <div className="admin-table-container" style={{ maxHeight: 320, overflow: "auto" }}>
        <table className="admin-table">
          <thead><tr><th>Time</th><th>Event</th><th>User</th><th>IP</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading...</td></tr> :
              logs.length === 0 ? <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)" }}>No security logs</td></tr> :
                logs.map((log, i) => (
                  <tr key={i}><td>{log.time}</td><td>{log.event}</td><td>{log.user}</td><td className="mono">{log.ip}</td></tr>
                ))}
          </tbody>
        </table>
      </div>
      <motion.button className="settings-action-btn small" onClick={refresh} whileTap={{ scale: 0.97 }} style={{ marginTop: 12 }}>
        <RefreshCw size={14} /> Refresh
      </motion.button>
    </div>
  );
}

function NotificationsSection() {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("descall_admin_notifications") || "{}"); }
    catch { return {}; }
  });
  const persist = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem("descall_admin_notifications", JSON.stringify(next));
  };

  return (
    <div className="admin-section">
      <h3 className="section-title">Notification Settings</h3>
      <p className="section-desc">Configure admin alerts</p>
      <div className="toggle-row"><span>New User Alerts</span><Toggle value={settings.newUser !== false} onChange={(v) => persist("newUser", v)} /></div>
      <div className="toggle-row"><span>Failed Login Alerts</span><Toggle value={settings.failedLogin !== false} onChange={(v) => persist("failedLogin", v)} /></div>
      <div className="toggle-row"><span>Error Report Alerts</span><Toggle value={settings.errorReports === true} onChange={(v) => persist("errorReports", v)} /></div>
    </div>
  );
}

function AppearanceSection() {
  const [accent, setAccent] = useState(() => localStorage.getItem("descall_accent") || "#6678ff");
  const applyAccent = (color) => { setAccent(color); localStorage.setItem("descall_accent", color); };
  const colors = ["#6678ff", "#f23f43", "#23a55a", "#f0b232", "#9b59b6", "#1abc9c", "#e74c3c", "#3498db"];

  return (
    <div className="admin-section">
      <h3 className="section-title">Appearance Settings</h3>
      <p className="section-desc">Customize theme accent color</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        {colors.map((c) => (
          <motion.button
            key={c}
            onClick={() => applyAccent(c)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            style={{
              width: 36, height: 36, borderRadius: 10, background: c,
              border: accent === c ? "2px solid white" : "2px solid transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {accent === c && <Check size={16} color="white" />}
          </motion.button>
        ))}
      </div>
      <div className="toggle-row" style={{ marginTop: 16 }}>
        <span>Compact Admin UI</span>
        <Toggle value={localStorage.getItem("descall_admin_compact") === "true"} onChange={(v) => localStorage.setItem("descall_admin_compact", String(v))} />
      </div>
    </div>
  );
}

/* Reusable toggle (AdminMenu inline) */
function Toggle({ value, onChange }) {
  return (
    <button className={`toggle-switch ${value ? "active" : ""}`} onClick={() => onChange(!value)} type="button" aria-pressed={value}>
      <div className="toggle-knob" />
    </button>
  );
}
