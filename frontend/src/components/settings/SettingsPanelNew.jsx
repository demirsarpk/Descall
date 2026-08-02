import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, User, Palette, Bell, Mic, Headphones,
  Globe, Lock, Shield, ChevronRight, Save
} from "lucide-react";
import { Avatar } from "../ui/Avatar";

/**
 * COMPLETELY REBUILT SETTINGS PANEL
 * Discord-style settings interface
 * No old layout remnants
 */
export default function SettingsPanelNew({ onClose, me }) {
  const [activeSection, setActiveSection] = useState("account");
  const [settings, setSettings] = useState({
    theme: "dark",
    fontSize: "medium",
    density: "comfortable",
    notifications: true,
    soundEffects: true,
    inputDevice: "default",
    outputDevice: "default",
  });

  const sections = [
    { id: "account", icon: User, label: "My Account", desc: "Edit profile and account settings" },
    { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme, colors, and display" },
    { id: "notifications", icon: Bell, label: "Notifications", desc: "Message and alert preferences" },
    { id: "voice", icon: Mic, label: "Voice & Video", desc: "Input, output, and devices" },
    { id: "sound", icon: Headphones, label: "Sound Effects", desc: "Volume and sound settings" },
    { id: "privacy", icon: Lock, label: "Privacy & Safety", desc: "Security and privacy options" },
    { id: "advanced", icon: Shield, label: "Advanced", desc: "Developer and advanced options" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="settings-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-header">
          <h2 className="settings-title">User Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="settings-content">
          {/* Sidebar Navigation */}
          <div className="settings-sidebar">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  className={`settings-nav-item ${isActive ? "active" : ""}`}
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
          <div className="settings-main">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="settings-section-panel"
              >
                {activeSection === "account" && <AccountSection me={me} />}
                {activeSection === "appearance" && <AppearanceSection settings={settings} setSettings={setSettings} />}
                {activeSection === "notifications" && <NotificationsSection settings={settings} setSettings={setSettings} />}
                {activeSection === "voice" && <VoiceSection settings={settings} setSettings={setSettings} />}
                {activeSection === "sound" && <SoundSection settings={settings} setSettings={setSettings} />}
                {activeSection === "privacy" && <PrivacySection />}
                {activeSection === "advanced" && <AdvancedSection />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="btn btn-primary" onClick={onClose}>
            <Save size={16} />
            Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccountSection({ me }) {
  return (
    <div className="section-content">
      <h3 className="section-title">My Account</h3>
      
      <div className="profile-card-large">
        <div className="profile-banner" />
        <div className="profile-avatar-large">
          <Avatar name={me?.username || "User"} size={80} user={me} animate="always" />
        </div>
        <div className="profile-info">
          <h4 className="profile-username">{me?.username || "User"}</h4>
          <span className="profile-discriminator">#{me?.discriminator || "0000"}</span>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="group-title">Profile</h4>
        <div className="setting-item">
          <label className="setting-label">Username</label>
          <input type="text" defaultValue={me?.username} className="setting-input" />
        </div>
        <div className="setting-item">
          <label className="setting-label">Email</label>
          <input type="email" defaultValue={me?.email} className="setting-input" />
        </div>
      </div>
    </div>
  );
}

function AppearanceSection({ settings, setSettings }) {
  return (
    <div className="section-content">
      <h3 className="section-title">Appearance</h3>
      
      <div className="settings-group">
        <h4 className="group-title">Theme</h4>
        <div className="theme-options">
          {["dark", "light", "midnight"].map((theme) => (
            <button
              key={theme}
              className={`theme-option ${settings.theme === theme ? "active" : ""}`}
              onClick={() => setSettings({ ...settings, theme })}
            >
              <div className={`theme-preview ${theme}`} />
              <span className="theme-name">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <h4 className="group-title">Font Size</h4>
        <div className="setting-item">
          <select 
            value={settings.fontSize}
            onChange={(e) => setSettings({ ...settings, fontSize: e.target.value })}
            className="setting-select"
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="group-title">UI Density</h4>
        <div className="setting-item">
          <select 
            value={settings.density}
            onChange={(e) => setSettings({ ...settings, density: e.target.value })}
            className="setting-select"
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="spacious">Spacious</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection({ settings, setSettings }) {
  return (
    <div className="section-content">
      <h3 className="section-title">Notifications</h3>
      
      <div className="settings-group">
        <h4 className="group-title">Message Notifications</h4>
        <div className="setting-toggle">
          <span className="toggle-label">Enable Notifications</span>
          <button 
            className={`toggle-switch ${settings.notifications ? "on" : "off"}`}
            onClick={() => setSettings({ ...settings, notifications: !settings.notifications })}
          >
            <div className="toggle-thumb" />
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="group-title">Sound</h4>
        <div className="setting-toggle">
          <span className="toggle-label">Sound Effects</span>
          <button 
            className={`toggle-switch ${settings.soundEffects ? "on" : "off"}`}
            onClick={() => setSettings({ ...settings, soundEffects: !settings.soundEffects })}
          >
            <div className="toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VoiceSection({ settings, setSettings }) {
  return (
    <div className="section-content">
      <h3 className="section-title">Voice & Video</h3>
      
      <div className="settings-group">
        <h4 className="group-title">Input Device</h4>
        <div className="setting-item">
          <select 
            value={settings.inputDevice}
            onChange={(e) => setSettings({ ...settings, inputDevice: e.target.value })}
            className="setting-select"
          >
            <option value="default">Default</option>
            <option value="mic1">Microphone 1</option>
            <option value="mic2">Microphone 2</option>
          </select>
        </div>
      </div>

      <div className="settings-group">
        <h4 className="group-title">Output Device</h4>
        <div className="setting-item">
          <select 
            value={settings.outputDevice}
            onChange={(e) => setSettings({ ...settings, outputDevice: e.target.value })}
            className="setting-select"
          >
            <option value="default">Default</option>
            <option value="speakers1">Speakers 1</option>
            <option value="headphones">Headphones</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function SoundSection({ settings, setSettings }) {
  return (
    <div className="section-content">
      <h3 className="section-title">Sound Effects</h3>
      
      <div className="settings-group">
        <h4 className="group-title">Volume</h4>
        <div className="setting-item">
          <input 
            type="range" 
            min="0" 
            max="100" 
            defaultValue="75"
            className="setting-slider"
          />
        </div>
      </div>

      <div className="settings-group">
        <h4 className="group-title">Test Sound</h4>
        <button className="btn btn-secondary">Play Test Sound</button>
      </div>
    </div>
  );
}

function PrivacySection() {
  const [settings, setSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("descall_privacy_settings") || "{}"); }
    catch { return {}; }
  });
  const persist = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem("descall_privacy_settings", JSON.stringify(next));
  };

  return (
    <div className="section-content">
      <h3 className="section-title">Privacy & Safety</h3>
      <p className="section-desc">Configure your privacy settings</p>
      <div className="settings-group">
        <h4 className="group-title">Direct Messages</h4>
        <label className="settings-row check">
          <input type="checkbox" checked={settings.allowDms !== false} onChange={(e) => persist("allowDms", e.target.checked)} />
          <span>Allow direct messages from friends</span>
        </label>
        <label className="settings-row check">
          <input type="checkbox" checked={settings.allowDmsFromEveryone === true} onChange={(e) => persist("allowDmsFromEveryone", e.target.checked)} />
          <span>Allow direct messages from everyone</span>
        </label>
      </div>
      <div className="settings-group">
        <h4 className="group-title">Profile Visibility</h4>
        <label className="settings-row check">
          <input type="checkbox" checked={settings.showOnlineStatus !== false} onChange={(e) => persist("showOnlineStatus", e.target.checked)} />
          <span>Show online status</span>
        </label>
        <label className="settings-row check">
          <input type="checkbox" checked={settings.showActivity !== false} onChange={(e) => persist("showActivity", e.target.checked)} />
          <span>Show activity status</span>
        </label>
      </div>
      <div className="settings-group">
        <h4 className="group-title">Friend Requests</h4>
        <label className="settings-row check">
          <input type="checkbox" checked={settings.allowFriendRequests !== false} onChange={(e) => persist("allowFriendRequests", e.target.checked)} />
          <span>Allow friend requests</span>
        </label>
      </div>
    </div>
  );
}

function AdvancedSection() {
  const [devMode, setDevMode] = useState(() => localStorage.getItem("descall_dev_mode") === "true");
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem("descall_reduce_motion") === "true");
  const [hardwareAccel, setHardwareAccel] = useState(() => localStorage.getItem("descall_hw_accel") !== "false");

  return (
    <div className="section-content">
      <h3 className="section-title">Advanced</h3>
      <p className="section-desc">Developer and advanced options</p>
      <div className="settings-group">
        <h4 className="group-title">Developer</h4>
        <label className="settings-row check">
          <input type="checkbox" checked={devMode} onChange={(e) => { setDevMode(e.target.checked); localStorage.setItem("descall_dev_mode", String(e.target.checked)); }} />
          <span>Developer Mode (shows IDs and debug info)</span>
        </label>
      </div>
      <div className="settings-group">
        <h4 className="group-title">Performance</h4>
        <label className="settings-row check">
          <input type="checkbox" checked={reduceMotion} onChange={(e) => { setReduceMotion(e.target.checked); localStorage.setItem("descall_reduce_motion", String(e.target.checked)); }} />
          <span>Reduce motion (disable animations)</span>
        </label>
        <label className="settings-row check">
          <input type="checkbox" checked={hardwareAccel} onChange={(e) => { setHardwareAccel(e.target.checked); localStorage.setItem("descall_hw_accel", String(e.target.checked)); }} />
          <span>Hardware acceleration</span>
        </label>
      </div>
      <div className="settings-group">
        <h4 className="group-title">Data</h4>
        <motion.button className="settings-action-btn secondary" whileTap={{ scale: 0.97 }} onClick={() => {
          if (window.confirm("Clear all local settings?")) { localStorage.clear(); window.location.reload(); }
        }}>
          Clear All Local Data
        </motion.button>
      </div>
    </div>
  );
}
