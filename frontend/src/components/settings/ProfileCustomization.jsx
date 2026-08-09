import { useState, useRef, useEffect, useCallback } from "react";
import { getToken } from "../../lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Palette, Type, Bell, Shield, Lock, Globe,
  Clock, Moon, Sun, Volume2, Keyboard, UserX,
  Download, Mail, Smartphone, Eye, EyeOff, AlertCircle,
  CheckCircle2, LogOut, Monitor
} from "lucide-react";
import RippleButton from "../ui/RippleButton";
import { Avatar } from "../ui/Avatar";
import { API_BASE_URL } from "../../config/api";
import { uploadFile } from "../../api/media";
import { setEmail as apiSetEmail, resendEmailCode, verifyEmailCode, enable2fa, disable2fa, getSessions, revokeSession, revokeOtherSessions } from "../../api/security";
import { blockUser, unblockUser, getBlockedUsers } from "../../api/friends";
import { useT } from "../../context/LocaleContext";

/**
 * Profile Customization Panel (15+ features)
 *
 * 1. Avatar
 * 2. Display name
 * 3. Bio/About me
 * 4. Custom status
 * 5. Profile banner
 * 6. Theme accent color
 * 7. Font size
 * 8. UI density (compact/comfortable)
 * 9. Message bubble style
 * 10. Sound preferences
 * 11. Notification settings
 * 12. Privacy (last seen, typing)
 * 13. Blocked users
 * 14. Language
 * 15. Timezone
 * 16. Email notifications
 * 17. Two-factor auth
 * 18. Session management
 * 19. Data export
 * 20. Keyboard shortcuts
 */
export default function ProfileCustomization({ me, onUpdate }) {
  const t = useT();
  const [activeTab, setActiveTab] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Email verification
  const [emailDraft, setEmailDraft] = useState(me?.email || "");
  const [emailVerified, setEmailVerified] = useState(Boolean(me?.emailVerified));
  const [emailCode, setEmailCode] = useState("");
  const [emailStage, setEmailStage] = useState(me?.email && !me?.emailVerified ? "code" : "idle"); // idle | sending | code
  const [emailNotice, setEmailNotice] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  // Two-factor authentication
  const [twoFactorOn, setTwoFactorOn] = useState(Boolean(me?.twoFactorEnabled));
  const [disable2faPassword, setDisable2faPassword] = useState("");
  const [show2faPasswordPrompt, setShow2faPasswordPrompt] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  // Session management
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");

  // Real blocked users (replaces the old cosmetic list)
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { sessions: list } = await getSessions();
      setSessions(list || []);
    } catch {
      // best-effort
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadBlocked = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const { blocked } = await getBlockedUsers();
      setBlockedUsers(blocked || []);
    } catch {
      // best-effort
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "security") loadSessions();
    if (activeTab === "privacy") loadBlocked();
  }, [activeTab, loadSessions, loadBlocked]);

  const handleSendEmailCode = async () => {
    setEmailBusy(true);
    setEmailNotice("");
    try {
      await apiSetEmail(emailDraft.trim());
      setEmailStage("code");
      setEmailNotice(t("Verification code sent. Check your inbox."));
    } catch (err) {
      setEmailNotice(err.message || t("Failed to send verification code."));
    } finally {
      setEmailBusy(false);
    }
  };

  const handleResendEmailCode = async () => {
    setEmailBusy(true);
    setEmailNotice("");
    try {
      await resendEmailCode();
      setEmailNotice(t("Verification code sent. Check your inbox."));
    } catch (err) {
      setEmailNotice(err.message || t("Failed to resend code."));
    } finally {
      setEmailBusy(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    setEmailBusy(true);
    setEmailNotice("");
    try {
      await verifyEmailCode(emailCode.trim());
      setEmailVerified(true);
      setEmailStage("idle");
      setEmailCode("");
      setEmailNotice(t("Email verified!"));
      await onUpdate?.({ ...profile, email: emailDraft.trim(), emailVerified: true });
    } catch (err) {
      setEmailNotice(err.message || t("Incorrect code."));
    } finally {
      setEmailBusy(false);
    }
  };

  const handleToggle2fa = async (checked) => {
    if (checked) {
      setTwoFaBusy(true);
      try {
        await enable2fa();
        setTwoFactorOn(true);
      } catch (err) {
        setEmailNotice(err.message || t("Failed to enable two-factor authentication."));
      } finally {
        setTwoFaBusy(false);
      }
    } else {
      setShow2faPasswordPrompt(true);
    }
  };

  const confirmDisable2fa = async () => {
    setTwoFaBusy(true);
    try {
      await disable2fa(disable2faPassword);
      setTwoFactorOn(false);
      setShow2faPasswordPrompt(false);
      setDisable2faPassword("");
    } catch (err) {
      setSessionNotice(err.message || t("Incorrect password."));
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setSessionNotice(err.message || t("Failed to end session."));
    }
  };

  const handleRevokeOthers = async () => {
    try {
      const { sessions: list } = await revokeOtherSessions();
      setSessions(list || []);
      setSessionNotice(t("All other sessions were signed out."));
    } catch (err) {
      setSessionNotice(err.message || t("Failed to end other sessions."));
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await unblockUser(userId);
      setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch {
      // best-effort
    }
  };

  // Profile state
  const [profile, setProfile] = useState({
    // 1-5: Profile basics
    avatarUrl: me?.avatarUrl || "",
    displayName: me?.username || "",
    bio: me?.bio || "",
    customStatus: me?.customStatus || "",
    bannerUrl: me?.bannerUrl || "",
    
    // 6-9: Appearance
    accentColor: me?.accentColor || "#7e81ff",
    fontSize: me?.fontSize || "medium", // small, medium, large
    uiDensity: me?.uiDensity || "comfortable", // compact, comfortable
    bubbleStyle: me?.bubbleStyle || "modern", // modern, classic, minimal
    
    // 10-11: Notifications
    soundEnabled: me?.soundEnabled !== false,
    soundVolume: me?.soundVolume ?? 0.8,
    notificationsEnabled: me?.notificationsEnabled !== false,
    desktopNotifications: me?.desktopNotifications !== false,
    mentionNotifications: me?.mentionNotifications !== false,
    callNotifications: me?.callNotifications !== false,
    
    // 12: Privacy
    onlineStatusVisible: me?.onlineStatusVisible !== false,
    lastSeenVisible: me?.lastSeenVisible !== false,
    typingIndicatorVisible: me?.typingIndicatorVisible !== false,
    profileVisibleTo: me?.profileVisibleTo || "everyone", // everyone, friends, nobody
    allowFriendRequests: me?.allowFriendRequests !== false,
    allowGroupInvites: me?.allowGroupInvites !== false,
    
    // 13: Blocked users (readonly here)
    blockedUsers: me?.blockedUsers || [],
    
    // 14-15: Regional
    language: me?.language || "tr",
    timezone: me?.timezone || "Europe/Istanbul",
    
    // 16-17: Security
    emailNotifications: me?.emailNotifications !== false,
    twoFactorEnabled: me?.twoFactorEnabled || false,
    
    // 18: Sessions (readonly)
    activeSessions: me?.activeSessions || [],
  });

  const handleChange = (key, value) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = getToken();
      
      // Update profile
      await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: profile.displayName,
          bio: profile.bio,
          customStatus: profile.customStatus,
          accentColor: profile.accentColor,
          fontSize: profile.fontSize,
          uiDensity: profile.uiDensity,
          bubbleStyle: profile.bubbleStyle,
        }),
      });

      // Update notifications
      await fetch(`${API_BASE_URL}/api/user/notifications`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          soundEnabled: profile.soundEnabled,
          soundVolume: profile.soundVolume,
          desktopNotifications: profile.desktopNotifications,
          callNotifications: profile.callNotifications,
          mentionNotifications: profile.mentionNotifications,
        }),
      });

      // Update privacy
      await fetch(`${API_BASE_URL}/api/user/privacy`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          onlineStatusVisible: profile.onlineStatusVisible,
          lastSeenVisible: profile.lastSeenVisible,
          typingIndicatorVisible: profile.typingIndicatorVisible,
          profileVisibleTo: profile.profileVisibleTo,
          allowFriendRequests: profile.allowFriendRequests,
          allowGroupInvites: profile.allowGroupInvites,
        }),
      });

      // Update regional
      await fetch(`${API_BASE_URL}/api/user/regional`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: profile.language,
          timezone: profile.timezone,
        }),
      });

      await onUpdate?.(profile);
    } catch (err) {
      setError("Failed to save profile. Please try again.");
      setTimeout(() => setError(""), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await uploadFile(file);
        handleChange("avatarUrl", result.url);
      } catch (err) {
        setError("Failed to upload avatar. Please try again.");
        setTimeout(() => setError(""), 5000);
      }
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await uploadFile(file);
        handleChange("bannerUrl", result.url);
      } catch (err) {
        setError("Failed to upload banner. Please try again.");
        setTimeout(() => setError(""), 5000);
      }
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: Camera },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "security", label: "Security", icon: Lock },
  ];

  return (
    <div className="profile-customization">
      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pc-error-banner"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="pc-sidebar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </aside>

      {/* Content */}
      <div className="pc-content custom-scroll">
        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <motion.div 
            className="pc-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3>Profile Settings</h3>
            
            {/* Avatar */}
            <div className="pc-avatar-section">
              <div className="pc-avatar-preview">
                <Avatar name={profile.displayName || profile.username || "User"} size={96} user={profile} />
                <button onClick={() => fileInputRef.current?.click()}>
                  <Camera size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              
              {/* Banner */}
              <div className="pc-banner-preview">
                <img 
                  src={profile.bannerUrl || "/default-banner.png"} 
                  alt="Banner"
                />
                <button onClick={() => bannerInputRef.current?.click()}>
                  <Camera size={16} />
                  Banner
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Display Name */}
            <label className="pc-field">
              <span>Display Name</span>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => handleChange("displayName", e.target.value)}
                maxLength={32}
              />
            </label>

            {/* Bio */}
            <label className="pc-field">
              <span>Bio / About Me</span>
              <textarea
                value={profile.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Tell others about yourself..."
              />
              <small>{profile.bio.length}/500</small>
            </label>

            {/* Custom Status */}
            <label className="pc-field">
              <span>Custom Status</span>
              <input
                type="text"
                value={profile.customStatus}
                onChange={(e) => handleChange("customStatus", e.target.value)}
                maxLength={100}
                placeholder="🎮 Playing games | 🎧 Listening to music"
              />
              <small>{profile.customStatus.length}/100</small>
            </label>
          </motion.div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === "appearance" && (
          <motion.div 
            className="pc-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3>Appearance</h3>

            {/* Accent Color */}
            <label className="pc-field">
              <span>Accent Color</span>
              <div className="pc-color-picker">
                {["#7e81ff", "#22c55e", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"].map(color => (
                  <button
                    key={color}
                    className={profile.accentColor === color ? "active" : ""}
                    style={{ background: color }}
                    onClick={() => handleChange("accentColor", color)}
                  />
                ))}
                <input
                  type="color"
                  value={profile.accentColor}
                  onChange={(e) => handleChange("accentColor", e.target.value)}
                />
              </div>
            </label>

            {/* Font Size */}
            <label className="pc-field">
              <span>Font Size</span>
              <div className="pc-segmented">
                {["small", "medium", "large"].map(size => (
                  <button
                    key={size}
                    className={profile.fontSize === size ? "active" : ""}
                    onClick={() => handleChange("fontSize", size)}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </label>

            {/* UI Density */}
            <label className="pc-field">
              <span>UI Density</span>
              <div className="pc-segmented">
                {["compact", "comfortable"].map(density => (
                  <button
                    key={density}
                    className={profile.uiDensity === density ? "active" : ""}
                    onClick={() => handleChange("uiDensity", density)}
                  >
                    {density.charAt(0).toUpperCase() + density.slice(1)}
                  </button>
                ))}
              </div>
            </label>

            {/* Message Bubble Style */}
            <label className="pc-field">
              <span>Message Bubble Style</span>
              <div className="pc-segmented">
                {["modern", "classic", "minimal"].map(style => (
                  <button
                    key={style}
                    className={profile.bubbleStyle === style ? "active" : ""}
                    onClick={() => handleChange("bubbleStyle", style)}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </label>
          </motion.div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === "notifications" && (
          <motion.div 
            className="pc-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3>Notifications</h3>

            {/* Sound */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <Volume2 size={20} />
                <div>
                  <span>Sound Effects</span>
                  <small>Play sounds for incoming messages and calls</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.soundEnabled}
                  onChange={(e) => handleChange("soundEnabled", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Volume */}
            {profile.soundEnabled && (
              <label className="pc-field">
                <span>Volume ({Math.round(profile.soundVolume * 100)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={profile.soundVolume}
                  onChange={(e) => handleChange("soundVolume", parseFloat(e.target.value))}
                />
              </label>
            )}

            {/* Desktop Notifications */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <Bell size={20} />
                <div>
                  <span>Desktop Notifications</span>
                  <small>Show notification popups</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.desktopNotifications}
                  onChange={(e) => handleChange("desktopNotifications", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Call Notifications */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <div>
                  <span>Call Notifications</span>
                  <small>Always notify for incoming calls</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.callNotifications}
                  onChange={(e) => handleChange("callNotifications", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Mention Notifications */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <div>
                  <span>Mention Notifications</span>
                  <small>Notify when someone mentions you</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.mentionNotifications}
                  onChange={(e) => handleChange("mentionNotifications", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>
          </motion.div>
        )}

        {/* PRIVACY TAB */}
        {activeTab === "privacy" && (
          <motion.div 
            className="pc-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3>Privacy</h3>

            {/* Online Status */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <Eye size={20} />
                <div>
                  <span>Show Online Status</span>
                  <small>Let others see when you're online</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.onlineStatusVisible}
                  onChange={(e) => handleChange("onlineStatusVisible", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Last Seen */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <Clock size={20} />
                <div>
                  <span>Show Last Seen</span>
                  <small>Show when you were last active</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.lastSeenVisible}
                  onChange={(e) => handleChange("lastSeenVisible", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Typing Indicator */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <div>
                  <span>Typing Indicator</span>
                  <small>Show when you're typing</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.typingIndicatorVisible}
                  onChange={(e) => handleChange("typingIndicatorVisible", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Profile Visibility */}
            <label className="pc-field">
              <span>Profile Visible To</span>
              <select
                value={profile.profileVisibleTo}
                onChange={(e) => handleChange("profileVisibleTo", e.target.value)}
              >
                <option value="everyone">Everyone</option>
                <option value="friends">Friends Only</option>
                <option value="nobody">Nobody</option>
              </select>
            </label>

            {/* Friend Requests */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <div>
                  <span>Allow Friend Requests</span>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.allowFriendRequests}
                  onChange={(e) => handleChange("allowFriendRequests", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Blocked Users */}
            <div className="pc-blocked-section">
              <h4>{t("Blocked users")} ({blockedUsers.length})</h4>
              {blockedLoading ? (
                <p className="pc-empty">{t("Loading…")}</p>
              ) : blockedUsers.length === 0 ? (
                <p className="pc-empty">{t("No blocked users")}</p>
              ) : (
                <ul className="pc-blocked-list">
                  {blockedUsers.map(user => (
                    <li key={user.id}>
                      <Avatar name={user.username} size={32} user={user} />
                      <span>{user.displayName || user.username}</span>
                      <button onClick={() => handleUnblock(user.id)}>{t("Unblock")}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        {/* SECURITY TAB */}
        {activeTab === "security" && (
          <motion.div 
            className="pc-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3>{t("Security")}</h3>

            {/* Email verification */}
            <div className="pc-security-card">
              <div className="pc-toggle-info">
                <Mail size={20} />
                <div>
                  <span>{t("Email address")}</span>
                  <small>
                    {emailVerified
                      ? t("Verified — used for sign-in codes and account alerts.")
                      : t("Verify your email to enable two-factor authentication.")}
                  </small>
                </div>
                {emailVerified && (
                  <span className="pc-verified-pill">
                    <CheckCircle2 size={13} /> {t("Verified")}
                  </span>
                )}
              </div>

              {!emailVerified && (
                <div className="pc-email-verify-flow">
                  <input
                    type="email"
                    className="pc-inline-input"
                    placeholder={t("you@example.com")}
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    disabled={emailStage === "code"}
                  />
                  {emailStage !== "code" ? (
                    <RippleButton className="btn-secondary sm" onClick={handleSendEmailCode} disabled={emailBusy || !emailDraft.trim()}>
                      {emailBusy ? t("Sending…") : t("Send code")}
                    </RippleButton>
                  ) : (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        className="pc-inline-input pc-code-input"
                        placeholder="123456"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                      />
                      <RippleButton className="btn-primary sm" onClick={handleVerifyEmailCode} disabled={emailBusy || emailCode.length !== 6}>
                        {emailBusy ? t("Verifying…") : t("Verify")}
                      </RippleButton>
                      <button type="button" className="pc-link-btn" onClick={handleResendEmailCode} disabled={emailBusy}>
                        {t("Resend code")}
                      </button>
                    </>
                  )}
                </div>
              )}
              {emailNotice && <p className="pc-inline-notice">{emailNotice}</p>}
            </div>

            {/* Two Factor */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <Shield size={20} />
                <div>
                  <span>{t("Two-Factor Authentication")}</span>
                  <small>
                    {emailVerified
                      ? t("Get a sign-in code emailed to you on every new login.")
                      : t("Verify your email above to unlock this.")}
                  </small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={twoFactorOn}
                  disabled={!emailVerified || twoFaBusy}
                  onChange={(e) => handleToggle2fa(e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            <AnimatePresence>
              {show2faPasswordPrompt && (
                <motion.div
                  className="pc-security-card"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <p className="pc-inline-notice">{t("Enter your password to turn off two-factor authentication.")}</p>
                  <div className="pc-email-verify-flow">
                    <input
                      type="password"
                      className="pc-inline-input"
                      placeholder={t("Password")}
                      value={disable2faPassword}
                      onChange={(e) => setDisable2faPassword(e.target.value)}
                    />
                    <RippleButton className="btn-primary sm" onClick={confirmDisable2fa} disabled={twoFaBusy || !disable2faPassword}>
                      {t("Confirm")}
                    </RippleButton>
                    <button type="button" className="pc-link-btn" onClick={() => { setShow2faPasswordPrompt(false); setDisable2faPassword(""); }}>
                      {t("Cancel")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Notifications */}
            <div className="pc-toggle-row">
              <div className="pc-toggle-info">
                <Mail size={20} />
                <div>
                  <span>Email Notifications</span>
                  <small>Get important updates via email</small>
                </div>
              </div>
              <label className="pc-switch">
                <input
                  type="checkbox"
                  checked={profile.emailNotifications}
                  onChange={(e) => handleChange("emailNotifications", e.target.checked)}
                />
                <span className="pc-slider" />
              </label>
            </div>

            {/* Active Sessions */}
            <div className="pc-sessions-section">
              <div className="pc-sessions-header">
                <h4>{t("Active sessions")}</h4>
                {sessions.length > 1 && (
                  <button type="button" className="pc-link-btn" onClick={handleRevokeOthers}>
                    <LogOut size={12} /> {t("Sign out all other sessions")}
                  </button>
                )}
              </div>
              {sessionNotice && <p className="pc-inline-notice">{sessionNotice}</p>}
              {sessionsLoading ? (
                <p className="pc-empty">{t("Loading…")}</p>
              ) : (
                <ul className="pc-sessions-list">
                  {sessions.map((session) => (
                    <li key={session.id} className={session.current ? "current" : ""}>
                      <Monitor size={16} />
                      <div>
                        <span>
                          {session.device}
                          {session.current && <em className="pc-current-tag"> · {t("This device")}</em>}
                        </span>
                        <small>
                          {session.ip} • {t("Last active")} {session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : ""}
                        </small>
                      </div>
                      {!session.current && (
                        <button onClick={() => handleRevokeSession(session.id)}>{t("End session")}</button>
                      )}
                    </li>
                  ))}
                  {sessions.length === 0 && <p className="pc-empty">{t("No active sessions found.")}</p>}
                </ul>
              )}
            </div>

            {/* Data Export */}
            <div className="pc-export-section">
              <h4>Data Export</h4>
              <p>Download all your data including messages, friends, and settings</p>
              <RippleButton className="btn-secondary">
                <Download size={16} />
                Export My Data
              </RippleButton>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="pc-shortcuts-section">
              <h4>Keyboard Shortcuts</h4>
              <div className="pc-shortcuts-grid">
                <div><kbd>Ctrl</kbd> + <kbd>K</kbd> <span>Quick search</span></div>
                <div><kbd>Ctrl</kbd> + <kbd>N</kbd> <span>New message</span></div>
                <div><kbd>Esc</kbd> <span>Close modals</span></div>
                <div><kbd>M</kbd> <span>Toggle mute</span></div>
                <div><kbd>V</kbd> <span>Toggle camera</span></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Save Button */}
        <div className="pc-footer">
          <RippleButton 
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </RippleButton>
        </div>
      </div>
    </div>
  );
}
