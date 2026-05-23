import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Settings, Users, Shield, 
  Database, Activity, Zap, 
  Globe, Lock, Bell, Palette,
  ChevronRight
} from "lucide-react";

/**
 * COMPLETELY REBUILT ADMIN MENU
 * Discord-style admin settings panel
 * No old layout remnants
 * Fixed all positioning and layout issues
 */
export default function AdminMenu({ onClose, onLogout, me }) {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", icon: Activity, label: "Overview", desc: "System status and metrics" },
    { id: "users", icon: Users, label: "User Management", desc: "Manage users and permissions" },
    { id: "servers", icon: Shield, label: "Server Settings", desc: "Configure server options" },
    { id: "database", icon: Database, label: "Database", desc: "Data management and backups" },
    { id: "performance", icon: Zap, label: "Performance", desc: "Monitor system performance" },
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
                {activeSection === "database" && <DatabaseSection />}
                {activeSection === "performance" && <PerformanceSection />}
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

function OverviewSection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">System Overview</h3>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon online">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">1,234</span>
            <span className="stat-label">Active Users</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">567</span>
            <span className="stat-label">Online Now</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">
            <Database size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">89%</span>
            <span className="stat-label">Database Load</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon danger">
            <Zap size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">42ms</span>
            <span className="stat-label">Avg Response</span>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h4 className="activity-title">Recent Activity</h4>
        <div className="activity-list">
          <div className="activity-item">
            <span className="activity-time">2m ago</span>
            <span className="activity-text">User john_doe joined</span>
          </div>
          <div className="activity-item">
            <span className="activity-time">5m ago</span>
            <span className="activity-text">Group "Dev Team" created</span>
          </div>
          <div className="activity-item">
            <span className="activity-time">12m ago</span>
            <span className="activity-text">Server backup completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersSection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">User Management</h3>
      <p className="section-desc">Manage users, roles, and permissions</p>
      
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Status</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>john_doe</td>
              <td><span className="badge online">Online</span></td>
              <td>Admin</td>
              <td><button className="table-action">Edit</button></td>
            </tr>
            <tr>
              <td>jane_smith</td>
              <td><span className="badge offline">Offline</span></td>
              <td>User</td>
              <td><button className="table-action">Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServersSection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">Server Settings</h3>
      <p className="section-desc">Configure server-wide options</p>
      <div className="placeholder-content">
        <Settings size={48} className="placeholder-icon" />
        <p>Server configuration options</p>
      </div>
    </div>
  );
}

function DatabaseSection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">Database Management</h3>
      <p className="section-desc">Manage data and backups</p>
      <div className="placeholder-content">
        <Database size={48} className="placeholder-icon" />
        <p>Database management tools</p>
      </div>
    </div>
  );
}

function PerformanceSection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">Performance Monitoring</h3>
      <p className="section-desc">Monitor system performance metrics</p>
      <div className="placeholder-content">
        <Zap size={48} className="placeholder-icon" />
        <p>Performance metrics dashboard</p>
      </div>
    </div>
  );
}

function SecuritySection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">Security Settings</h3>
      <p className="section-desc">Configure security options and view logs</p>
      <div className="placeholder-content">
        <Lock size={48} className="placeholder-icon" />
        <p>Security configuration</p>
      </div>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">Notification Settings</h3>
      <p className="section-desc">Configure system notifications</p>
      <div className="placeholder-content">
        <Bell size={48} className="placeholder-icon" />
        <p>Notification preferences</p>
      </div>
    </div>
  );
}

function AppearanceSection() {
  return (
    <div className="admin-section">
      <h3 className="section-title">Appearance Settings</h3>
      <p className="section-desc">Customize theme and styling</p>
      <div className="placeholder-content">
        <Palette size={48} className="placeholder-icon" />
        <p>Theme customization</p>
      </div>
    </div>
  );
}

import { useState } from "react";
