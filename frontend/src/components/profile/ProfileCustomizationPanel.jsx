import { Avatar } from "../ui/Avatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Layout,
  Sparkles,
  User,
  Check,
  RotateCcw,
  Moon,
  Sun,
  Smartphone,
  Type,
  Bell,
  Eye,
  EyeOff,
  Camera,
  Image as ImageIcon,
  Hash,
  Upload
} from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { uploadFile } from "../../api/media";
import { API_BASE_URL } from "../../config/api";

const colorPresets = [
  { name: "Default", primary: "#6678ff", secondary: "#7d6bff", accent: "#4ecdc4" },
  { name: "Ocean", primary: "#0066ff", secondary: "#00ccff", accent: "#00ffcc" },
  { name: "Sunset", primary: "#ff6b6b", secondary: "#feca57", accent: "#ff9ff3" },
  { name: "Forest", primary: "#2ecc71", secondary: "#27ae60", accent: "#1dd1a1" },
  { name: "Purple", primary: "#9b59b6", secondary: "#8e44ad", accent: "#e74c3c" },
  { name: "Midnight", primary: "#2c3e50", secondary: "#34495e", accent: "#95a5a6" },
];

const fontSizes = [
  { value: "small", label: "Small", scale: "0.9" },
  { value: "medium", label: "Medium", scale: "1" },
  { value: "large", label: "Large", scale: "1.1" },
];

const borderRadiusOptions = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const animationIntensities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const statusOptions = [
  { emoji: "", label: "None" },
  { emoji: "✅", label: "Available" },
  { emoji: "🎮", label: "Gaming" },
  { emoji: "💼", label: "Working" },
  { emoji: "🎵", label: "Listening" },
  { emoji: "📚", label: "Studying" },
  { emoji: "☕", label: "Coffee" },
  { emoji: "🏃", label: "Exercising" },
  { emoji: "🍿", label: "Watching" },
  { emoji: "💤", label: "Sleeping" },
];

export default function ProfileCustomizationPanel({
  customization,
  updateTheme,
  updateAnimations,
  updateLayout,
  updateProfile,
  updateNotifications,
  updatePrivacy,
  resetCustomization,
  onClose,
  me,
  refreshMe,
}) {
  const [activeTab, setActiveTab] = useState("theme");
  const [tempColor, setTempColor] = useState(customization.theme.primaryColor);
  const [previewStatus, setPreviewStatus] = useState(customization.profile.customStatus);
  const [uploading, setUploading] = useState(false);
  
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  const handleAvatarUpload = async (file) => {
    if (!file) return;
    
    try {
      setUploading(true);
      const token = getToken();
      const formData = new FormData();
      formData.append("avatar", file);
      
      const response = await fetch(`${API_BASE_URL}/media/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        updateProfile({ avatarUrl: data.avatarUrl });
        // Refresh me data to update avatar everywhere
        if (refreshMe) {
          await refreshMe();
        }
      } else {
      }
    } catch (err) {
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (file) => {
    if (!file) return;
    
    try {
      setUploading(true);
      const token = getToken();
      const formData = new FormData();
      formData.append("banner", file);
      
      const response = await fetch(`${API_BASE_URL}/media/banner`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        updateProfile({ bannerUrl: data.bannerUrl });
      } else {
      }
    } catch (err) {
    } finally {
      setUploading(false);
    }
  };

  const handleColorPreset = (preset) => {
    updateTheme({
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    });
    setTempColor(preset.primary);
  };

  const handleCustomColor = (color) => {
    setTempColor(color);
    updateTheme({ primaryColor: color });
  };

  const tabs = [
    { id: "theme", label: "Theme", icon: Palette },
    { id: "animations", label: "Animations", icon: Sparkles },
    { id: "layout", label: "Layout", icon: Layout },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <motion.div
      className="profile-customization-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="customization-header">
        <h2>Customize Your Experience</h2>
        <p>Personalize your Descall interface</p>
      </div>

      {/* Tabs */}
      <div className="customization-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`customization-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                className="tab-indicator"
                layoutId="tabIndicator"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="customization-content">
        <AnimatePresence mode="wait">
          {activeTab === "theme" && (
            <motion.div
              key="theme"
              className="customization-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Dark Mode Toggle */}
              <div className="setting-card">
                <div className="setting-header">
                  <h3>Appearance</h3>
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <Moon size={20} />
                    <span>Dark Mode</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.theme.darkMode ? "on" : ""}`}
                    onClick={() => updateTheme({ darkMode: !customization.theme.darkMode })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.theme.darkMode ? 24 : 0 }}
                    />
                  </button>
                </div>
                <div className="setting-row">
                  <div className="setting-info">
                    <Sparkles size={20} />
                    <span>Glass Effect</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.theme.glassEffect ? "on" : ""}`}
                    onClick={() => updateTheme({ glassEffect: !customization.theme.glassEffect })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.theme.glassEffect ? 24 : 0 }}
                    />
                  </button>
                </div>
              </div>

              {/* Color Presets */}
              <div className="setting-card">
                <div className="setting-header">
                  <h3>Color Theme</h3>
                </div>
                <div className="color-presets">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.name}
                      className="color-preset"
                      onClick={() => handleColorPreset(preset)}
                      style={{
                        background: `linear-gradient(135deg, ${preset.primary} 0%, ${preset.secondary} 100%)`,
                      }}
                    >
                      {customization.theme.primaryColor === preset.primary && (
                        <motion.div
                          className="preset-check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <Check size={14} />
                        </motion.div>
                      )}
                      <span className="preset-name">{preset.name}</span>
                    </button>
                  ))}
                </div>

                <div className="custom-color-section">
                  <label>Custom Primary Color</label>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      value={tempColor}
                      onChange={(e) => handleCustomColor(e.target.value)}
                      className="color-input"
                    />
                    <input
                      type="text"
                      value={tempColor}
                      onChange={(e) => handleCustomColor(e.target.value)}
                      className="color-text-input"
                      placeholder="#6678ff"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "animations" && (
            <motion.div
              key="animations"
              className="customization-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="setting-card">
                <div className="setting-header">
                  <h3>Animation Settings</h3>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Sparkles size={20} />
                    <span>Enable Animations</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.animations.enabled ? "on" : ""}`}
                    onClick={() => updateAnimations({ enabled: !customization.animations.enabled })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.animations.enabled ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row stacked">
                  <label>Animation Intensity</label>
                  <div className="option-pills">
                    {animationIntensities.map((intensity) => (
                      <button
                        key={intensity.value}
                        className={`option-pill ${customization.animations.intensity === intensity.value ? "active" : ""}`}
                        onClick={() => updateAnimations({ intensity: intensity.value })}
                      >
                        {intensity.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Bell size={20} />
                    <span>Sound Effects</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.animations.soundEffects ? "on" : ""}`}
                    onClick={() => updateAnimations({ soundEffects: !customization.animations.soundEffects })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.animations.soundEffects ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Sparkles size={20} />
                    <span>Particle Effects</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.animations.particleEffects ? "on" : ""}`}
                    onClick={() => updateAnimations({ particleEffects: !customization.animations.particleEffects })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.animations.particleEffects ? 24 : 0 }}
                    />
                  </button>
                </div>
              </div>

              <div className="animation-preview">
                <h4>Preview</h4>
                <div className="preview-area">
                  <motion.div
                    className="preview-box"
                    animate={{
                      scale: customization.animations.enabled ? [1, 1.05, 1] : 1,
                      rotate: customization.animations.enabled ? [0, 5, -5, 0] : 0,
                    }}
                    transition={{
                      duration: customization.animations.intensity === "high" ? 1 : customization.animations.intensity === "medium" ? 2 : 3,
                      repeat: Infinity,
                    }}
                    style={{
                      background: `linear-gradient(135deg, ${customization.theme.primaryColor}, ${customization.theme.secondaryColor})`,
                    }}
                  >
                    <Sparkles size={24} color="white" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "layout" && (
            <motion.div
              key="layout"
              className="customization-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="setting-card">
                <div className="setting-header">
                  <h3>Layout Preferences</h3>
                </div>

                <div className="setting-row stacked">
                  <div className="setting-info">
                    <Type size={20} />
                    <label>Font Size</label>
                  </div>
                  <div className="option-pills">
                    {fontSizes.map((size) => (
                      <button
                        key={size.value}
                        className={`option-pill ${customization.layout.fontSize === size.value ? "active" : ""}`}
                        onClick={() => updateLayout({ fontSize: size.value })}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row stacked">
                  <div className="setting-info">
                    <Hash size={20} />
                    <label>Border Radius</label>
                  </div>
                  <div className="option-pills">
                    {borderRadiusOptions.map((radius) => (
                      <button
                        key={radius.value}
                        className={`option-pill ${customization.layout.borderRadius === radius.value ? "active" : ""}`}
                        onClick={() => updateLayout({ borderRadius: radius.value })}
                      >
                        {radius.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Smartphone size={20} />
                    <span>Compact Mode</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.layout.compactMode ? "on" : ""}`}
                    onClick={() => updateLayout({ compactMode: !customization.layout.compactMode })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.layout.compactMode ? 24 : 0 }}
                    />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "profile" && (
            <motion.div
              key="profile"
              className="customization-section"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="setting-card">
                <div className="setting-header">
                  <h3>Profile Customization</h3>
                </div>

                {/* Profile Photo */}
                <div className="setting-row stacked">
                  <label>Profile Photo</label>
                  <div className="profile-photo-section">
                    <div className="profile-photo-preview">
                      <Avatar name={me?.username || "User"} size={80} user={me} />
                    </div>
                    <button
                      className="upload-btn"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload size={16} />
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: "none" }}
                      onChange={(e) => handleAvatarUpload(e.target.files[0])}
                    />
                  </div>
                </div>

                {/* Custom Status */}
                <div className="setting-row stacked">
                  <label>Custom Status</label>
                  <div className="custom-status-input">
                    <input
                      type="text"
                      value={previewStatus}
                      onChange={(e) => setPreviewStatus(e.target.value)}
                      placeholder="What's on your mind?"
                      maxLength={100}
                      className="status-text-input"
                    />
                    <RippleButton
                      onClick={() => updateProfile({ customStatus: previewStatus })}
                      className="btn-primary"
                      disabled={previewStatus === customization.profile.customStatus}
                    >
                      <Check size={16} />
                    </RippleButton>
                  </div>
                </div>

                {/* Status Emoji */}
                <div className="setting-row stacked">
                  <label>Status Emoji</label>
                  <div className="status-emoji-grid">
                    {statusOptions.map((option) => (
                      <button
                        key={option.label}
                        className={`status-emoji-btn ${customization.profile.statusEmoji === option.emoji ? "active" : ""}`}
                        onClick={() => updateProfile({ statusEmoji: option.emoji })}
                        title={option.label}
                      >
                        <span className="emoji">{option.emoji || "—"}</span>
                        <span className="label">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Banner Color */}
                <div className="setting-row stacked">
                  <label>Profile Banner</label>
                  <div className="banner-options">
                    <button
                      className="banner-option"
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Camera size={20} />
                      <span>{uploading ? "Uploading..." : "Upload Image"}</span>
                    </button>
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: "none" }}
                      onChange={(e) => handleBannerUpload(e.target.files[0])}
                    />
                    <div className="banner-color-picker">
                      <input
                        type="color"
                        value={customization.profile.bannerColor || "#6678ff"}
                        onChange={(e) => updateProfile({ bannerColor: e.target.value })}
                        className="color-input"
                      />
                      <span>Custom Color</span>
                    </div>
                  </div>
                </div>

                {/* Privacy */}
                <div className="setting-row">
                  <div className="setting-info">
                    {customization.profile.showStatusTo === "everyone" ? <Eye size={20} /> : <EyeOff size={20} />}
                    <span>Show Status To</span>
                  </div>
                  <select
                    value={customization.profile.showStatusTo}
                    onChange={(e) => updateProfile({ showStatusTo: e.target.value })}
                    className="privacy-select"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="friends">Friends Only</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Bell size={20} />
                    <span>Show Activity</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.profile.showActivity ? "on" : ""}`}
                    onClick={() => updateProfile({ showActivity: !customization.profile.showActivity })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.profile.showActivity ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Camera size={20} />
                    <span>Show Online Status</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.profile.showOnlineStatus ? "on" : ""}`}
                    onClick={() => updateProfile({ showOnlineStatus: !customization.profile.showOnlineStatus })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.profile.showOnlineStatus ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Hash size={20} />
                    <span>Show Username</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.profile.showUsername ? "on" : ""}`}
                    onClick={() => updateProfile({ showUsername: !customization.profile.showUsername })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.profile.showUsername ? 24 : 0 }}
                    />
                  </button>
                </div>
              </div>

              <div className="setting-card">
                <div className="setting-header">
                  <h3>Notification Settings</h3>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Bell size={20} />
                    <span>Message Notifications</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.notifications?.messageNotifications ? "on" : ""}`}
                    onClick={() => updateNotifications({ messageNotifications: !customization.notifications?.messageNotifications })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.notifications?.messageNotifications ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Bell size={20} />
                    <span>Call Notifications</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.notifications?.callNotifications ? "on" : ""}`}
                    onClick={() => updateNotifications({ callNotifications: !customization.notifications?.callNotifications })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.notifications?.callNotifications ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Bell size={20} />
                    <span>Group Notifications</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.notifications?.groupNotifications ? "on" : ""}`}
                    onClick={() => updateNotifications({ groupNotifications: !customization.notifications?.groupNotifications })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.notifications?.groupNotifications ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Bell size={20} />
                    <span>Friend Request Notifications</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.notifications?.friendRequestNotifications ? "on" : ""}`}
                    onClick={() => updateNotifications({ friendRequestNotifications: !customization.notifications?.friendRequestNotifications })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.notifications?.friendRequestNotifications ? 24 : 0 }}
                    />
                  </button>
                </div>
              </div>

              <div className="setting-card">
                <div className="setting-header">
                  <h3>Privacy Settings</h3>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Eye size={20} />
                    <span>Allow Messages From Non-Friends</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.privacy?.allowMessagesFromNonFriends ? "on" : ""}`}
                    onClick={() => updatePrivacy({ allowMessagesFromNonFriends: !customization.privacy?.allowMessagesFromNonFriends })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.privacy?.allowMessagesFromNonFriends ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Eye size={20} />
                    <span>Show Online Status To Friends Only</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.privacy?.onlineStatusFriendsOnly ? "on" : ""}`}
                    onClick={() => updatePrivacy({ onlineStatusFriendsOnly: !customization.privacy?.onlineStatusFriendsOnly })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.privacy?.onlineStatusFriendsOnly ? 24 : 0 }}
                    />
                  </button>
                </div>

                <div className="setting-row">
                  <div className="setting-info">
                    <Eye size={20} />
                    <span>Allow Profile Viewing</span>
                  </div>
                  <button
                    className={`toggle-switch ${customization.privacy?.allowProfileViewing ? "on" : ""}`}
                    onClick={() => updatePrivacy({ allowProfileViewing: !customization.privacy?.allowProfileViewing })}
                  >
                    <motion.div
                      className="toggle-handle"
                      animate={{ x: customization.privacy?.allowProfileViewing ? 24 : 0 }}
                    />
                  </button>
                </div>
              </div>

              {/* Profile Preview */}
              <div className="profile-preview-card">
                <div
                  className="profile-banner"
                  style={{
                    background: customization.profile.bannerColor
                      ? customization.profile.bannerColor
                      : `linear-gradient(135deg, ${customization.theme.primaryColor}, ${customization.theme.secondaryColor})`,
                  }}
                />
                <div className="profile-preview-content">
                  <div className="preview-avatar">
                    {me?.username?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="preview-info">
                    <h4>@{me?.username || "username"}</h4>
                    <p className="preview-status">
                      {customization.profile.statusEmoji} {customization.profile.customStatus || "No status set"}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="customization-footer">
        <RippleButton
          onClick={resetCustomization}
          className="btn-secondary"
        >
          <RotateCcw size={16} />
          Reset
        </RippleButton>
        <RippleButton
          onClick={() => {
            // Settings are already auto-saved by useProfileCustomization hook
            onClose();
          }}
          className="btn-primary"
        >
          <Check size={16} />
          Save Changes
        </RippleButton>
      </div>
    </motion.div>
  );
}
