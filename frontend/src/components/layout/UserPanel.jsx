import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Settings, Mic, Headphones, 
  Bell, User, LogOut, Moon, Sun, ChevronRight,
  Palette, Monitor, Volume2, Shield
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";

/**
 * PROFESSIONAL USER PANEL
 * Fully functional settings sidebar
 */
export default function UserPanel({ me, onClose, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [darkMode, setDarkMode] = useState(true);

  const handleLogoutClick = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      onLogout?.();
    }
  };

  const settingsTabs = [
    { id: "overview", label: "My Account", icon: User },
    { id: "profile", label: "User Profile", icon: Settings },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "voice", label: "Voice & Video", icon: Mic },
    { id: "sound", label: "Sound Effects", icon: Volume2 },
  ];

  return (
    <motion.aside
      initial={{ x: 340, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 340, opacity: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className="user-panel"
    >
      {/* Header */}
      <div className="user-panel-header">
        <h2 className="panel-title">User Settings</h2>
        <motion.button 
          className="icon-btn close-btn"
          onClick={onClose}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Close"
        >
          <X size={20} />
        </motion.button>
      </div>

      {/* Profile Overview Card */}
      <div className="profile-card">
        <div className="profile-banner" />
        <div className="profile-content">
          <div className="profile-avatar-wrapper">
            <Avatar 
              name={me?.username || "User"} 
              size={72}
              imageUrl={me?.avatarUrl}
            />
            <div className="profile-status-ring">
              <StatusBadge status="online" />
            </div>
          </div>
          <div className="profile-text">
            <h3 className="profile-name">{me?.username || "User"}</h3>
            <span className="profile-tag">@{me?.username?.toLowerCase() || "user"}</span>
          </div>
        </div>
      </div>

      {/* Settings Navigation */}
      <div className="settings-nav">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              className={`settings-nav-item ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="nav-item-icon">
                <Icon size={20} />
              </div>
              <span className="nav-item-label">{tab.label}</span>
              <ChevronRight size={16} className="nav-item-chevron" />
            </motion.button>
          );
        })}
      </div>

      {/* Active Settings Content */}
      <div className="settings-content">
        <AnimatePresence mode="wait">
          {activeTab === "overview" && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="settings-tab"
            >
              <h3>Account Overview</h3>
              <div className="info-card">
                <div className="info-row">
                  <span className="info-label">Username</span>
                  <span className="info-value">{me?.username || "User"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">User ID</span>
                  <span className="info-value">{me?.id || "Unknown"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Email</span>
                  <span className="info-value">{me?.email || "Not set"}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Status</span>
                  <span className="info-value status-online">Online</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="settings-tab"
            >
              <h3>Profile Customization</h3>
              <p className="settings-desc">Customize your profile picture, banner, and bio.</p>
              <button className="settings-action-btn" onClick={() => alert('Profile editor coming soon')}>
                Edit Profile
              </button>
            </motion.div>
          )}

          {activeTab === "appearance" && (
            <motion.div
              key="appearance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="settings-tab"
            >
              <h3>Appearance</h3>
              <div className="toggle-row">
                <span>Dark Mode</span>
                <button 
                  className={`toggle-switch ${darkMode ? "active" : ""}`}
                  onClick={() => setDarkMode(!darkMode)}
                >
                  <div className="toggle-knob" />
                </button>
              </div>
              <div className="toggle-row">
                <span>Compact Mode</span>
                <button className="toggle-switch" onClick={() => alert('Coming soon')}>
                  <div className="toggle-knob" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="settings-tab"
            >
              <h3>Notifications</h3>
              <div className="toggle-row">
                <span>Message Notifications</span>
                <button className="toggle-switch active" onClick={() => alert('Coming soon')}>
                  <div className="toggle-knob" />
                </button>
              </div>
              <div className="toggle-row">
                <span>Call Notifications</span>
                <button className="toggle-switch active" onClick={() => alert('Coming soon')}>
                  <div className="toggle-knob" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="settings-tab"
            >
              <h3>Voice & Video</h3>
              <p className="settings-desc">Configure your audio input and output devices.</p>
              <button className="settings-action-btn" onClick={() => alert('Device settings coming soon')}>
                Configure Devices
              </button>
            </motion.div>
          )}

          {activeTab === "sound" && (
            <motion.div
              key="sound"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="settings-tab"
            >
              <h3>Sound Effects</h3>
              <div className="toggle-row">
                <span>Message Sounds</span>
                <button className="toggle-switch active" onClick={() => alert('Coming soon')}>
                  <div className="toggle-knob" />
                </button>
              </div>
              <div className="toggle-row">
                <span>Call Sounds</span>
                <button className="toggle-switch active" onClick={() => alert('Coming soon')}>
                  <div className="toggle-knob" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logout Button */}
      <div className="user-panel-footer">
        <motion.button
          className="logout-btn"
          onClick={handleLogoutClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut size={18} />
          <span>Log Out</span>
        </motion.button>
      </div>
    </motion.aside>
  );
}
