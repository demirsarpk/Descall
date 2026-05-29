import { motion } from "framer-motion";
import { useState } from "react";
import { User, Volume2, Monitor, Bell, Shield } from "lucide-react";
import RippleButton from "../ui/RippleButton";
import ProfileCustomization from "./ProfileCustomization";
import { getAudioSettings, setGlobalMute, setSoundEnabled, setSoundVolume } from "../../lib/audioManager";

export default function SettingsPanel({
  onClose,
  compactBlur,
  setCompactBlur,
  reduceMotion,
  setReduceMotion,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  borderRadius,
  setBorderRadius,
  accentColor,
  setAccentColor,
  uiDensity,
  setUiDensity,
  messageBubbleStyle,
  setMessageBubbleStyle,
  me,
  onLogout,
}) {
  const [activeTab, setActiveTab] = useState("profile");
  const [soundSettings, setSoundSettings] = useState(() => getAudioSettings());

  const updateSetting = (key, value) => {
    if (key === "globalMute") {
      setGlobalMute(value);
    } else if (key === "volume") {
      setSoundVolume(value);
    } else {
      setSoundEnabled(key, value);
    }
    setSoundSettings(getAudioSettings());
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Monitor },
    { id: "sound", label: "Sound", icon: Volume2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
  ];

  return (
    <motion.div
      className="settings-panel glass"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
    >
      <header className="settings-head">
        <h3>Settings</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </header>
      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="settings-content custom-scroll">
        {activeTab === "profile" && (
          <ProfileCustomization me={me} onUpdate={(data) => {}} />
        )}

        {activeTab === "appearance" && (
          <section className="settings-section">
            <h4>Appearance</h4>
            
            <label className="settings-row check">
              <span>Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="settings-select"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="midnight">Midnight</option>
                <option value="ocean">Ocean</option>
              </select>
            </label>

            <label className="settings-row check">
              <span>Accent Color</span>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="color-picker"
                />
                <span className="color-value">{accentColor}</span>
              </div>
            </label>

            <label className="settings-row check">
              <span>Font Size</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="settings-select"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
              </select>
            </label>

            <label className="settings-row check">
              <span>Border Radius</span>
              <select
                value={borderRadius}
                onChange={(e) => setBorderRadius(e.target.value)}
                className="settings-select"
              >
                <option value="none">None</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>

            <label className="settings-row check">
              <span>UI Density</span>
              <select
                value={uiDensity}
                onChange={(e) => setUiDensity(e.target.value)}
                className="settings-select"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>

            <label className="settings-row check">
              <span>Message Bubble Style</span>
              <select
                value={messageBubbleStyle}
                onChange={(e) => setMessageBubbleStyle(e.target.value)}
                className="settings-select"
              >
                <option value="modern">Modern</option>
                <option value="classic">Classic</option>
                <option value="minimal">Minimal</option>
                <option value="rounded">Rounded</option>
              </select>
            </label>

            <label className="settings-row">
              <span>Glass Blur ({compactBlur}px)</span>
              <input
                type="range"
                min={4}
                max={40}
                value={compactBlur}
                onChange={(e) => setCompactBlur(Number(e.target.value))}
              />
            </label>

            <label className="settings-row check">
              <input type="checkbox" checked={reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} />
              <span>Reduce Motion</span>
            </label>
          </section>
        )}

        {activeTab === "sound" && (
          <section className="settings-section">
            <h4>Sound</h4>
            <label className="settings-row check">
              <input
                type="checkbox"
                checked={!soundSettings.globalMute}
                onChange={(e) => updateSetting("globalMute", !e.target.checked)}
              />
              <span>Enable sounds</span>
            </label>
            <label className="settings-row">
              <span>Master volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={soundSettings.volume}
                onChange={(e) => updateSetting("volume", Number(e.target.value))}
                disabled={soundSettings.globalMute}
              />
            </label>
            <label className="settings-row check">
              <input
                type="checkbox"
                checked={soundSettings.incomingCall}
                onChange={(e) => updateSetting("incomingCall", e.target.checked)}
                disabled={soundSettings.globalMute}
              />
              <span>Incoming call ringtone</span>
            </label>
            <label className="settings-row check">
              <input
                type="checkbox"
                checked={soundSettings.outgoingCall}
                onChange={(e) => updateSetting("outgoingCall", e.target.checked)}
                disabled={soundSettings.globalMute}
              />
              <span>Outgoing call tone</span>
            </label>
            <label className="settings-row check">
              <input
                type="checkbox"
                checked={soundSettings.message}
                onChange={(e) => updateSetting("message", e.target.checked)}
                disabled={soundSettings.globalMute}
              />
              <span>Message notifications</span>
            </label>
            <label className="settings-row check">
              <input
                type="checkbox"
                checked={soundSettings.notification}
                onChange={(e) => updateSetting("notification", e.target.checked)}
                disabled={soundSettings.globalMute}
              />
              <span>Friend online notifications</span>
            </label>
          </section>
        )}

        {activeTab === "notifications" && (
          <section className="settings-section">
            <h4>Notifications</h4>
            <p className="settings-muted">Notification settings are now in Profile tab</p>
          </section>
        )}

        {activeTab === "privacy" && (
          <section className="settings-section">
            <h4>Privacy & Security</h4>
            <p className="settings-muted">Privacy settings are now in Profile tab</p>
            <section className="settings-section" style={{ marginTop: 20 }}>
              <RippleButton type="button" className="btn-secondary full-width danger-outline" onClick={onLogout}>
                Log out
              </RippleButton>
            </section>
          </section>
        )}
      </div>
    </motion.div>
  );
}
