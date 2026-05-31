import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Settings, Mic, Headphones,
  Bell, User, LogOut, Moon, Sun, ChevronRight,
  Palette, Volume2, Camera, Type, Upload, Check,
  MonitorSpeaker, AlertTriangle
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { getToken } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";

/* ─── Helpers ─── */
const loadSettings = () => {
  try {
    return JSON.parse(localStorage.getItem("descall_user_settings") || "{}");
  } catch { return {}; }
};
const saveSettings = (obj) => {
  localStorage.setItem("descall_user_settings", JSON.stringify(obj));
};

export default function UserPanel({ me, onClose, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const stored = loadSettings();

  /* ── Profile editor state ── */
  const [displayName, setDisplayName] = useState(me?.displayName || me?.username || "");
  const [bio, setBio] = useState(me?.bio || "");
  const [customStatus, setCustomStatus] = useState(me?.customStatus || "");
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || "");
  const [bannerUrl, setBannerUrl] = useState(me?.bannerUrl || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  /* ── Appearance ── */
  const [darkMode, setDarkMode] = useState(stored.darkMode !== false);
  const [compactMode, setCompactMode] = useState(stored.compactMode === true);

  /* ── Notifications ── */
  const [msgNotifications, setMsgNotifications] = useState(stored.msgNotifications !== false);
  const [callNotifications, setCallNotifications] = useState(stored.callNotifications !== false);

  /* ── Sound ── */
  const [msgSounds, setMsgSounds] = useState(stored.msgSounds !== false);
  const [callSounds, setCallSounds] = useState(stored.callSounds !== false);

  /* ── Voice & Video ── */
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [selectedAudioIn, setSelectedAudioIn] = useState(stored.selectedAudioIn || "");
  const [selectedAudioOut, setSelectedAudioOut] = useState(stored.selectedAudioOut || "");
  const [selectedVideoIn, setSelectedVideoIn] = useState(stored.selectedVideoIn || "");
  const [micTestLevel, setMicTestLevel] = useState(0);
  const micAnalyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const micRafRef = useRef(null);

  /* Persist any setting change */
  useEffect(() => {
    saveSettings({
      darkMode, compactMode,
      msgNotifications, callNotifications,
      msgSounds, callSounds,
      selectedAudioIn, selectedAudioOut, selectedVideoIn,
    });
  }, [darkMode, compactMode, msgNotifications, callNotifications, msgSounds, callSounds, selectedAudioIn, selectedAudioOut, selectedVideoIn]);

  /* Load media devices */
  const refreshDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
      setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
    } catch (err) {
      console.error("Device enumeration failed:", err);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [refreshDevices]);

  /* Microphone test meter */
  const startMicTest = useCallback(async () => {
    if (micStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedAudioIn ? { exact: selectedAudioIn } : undefined } });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      micAnalyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicTestLevel(avg);
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* denied */ }
  }, [selectedAudioIn]);

  const stopMicTest = useCallback(() => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    micAnalyserRef.current = null;
    setMicTestLevel(0);
  }, []);

  useEffect(() => () => stopMicTest(), [stopMicTest]);

  /* Profile save */
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName, bio, customStatus, avatarUrl, bannerUrl }),
      });
      if (res.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error || "Failed to save profile");
        setTimeout(() => setProfileError(""), 3000);
      }
    } catch (err) {
      setProfileError("Network error while saving profile");
      setTimeout(() => setProfileError(""), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected if needed
    e.target.value = "";
    setAvatarUploading(true);
    setProfileError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setAvatarUrl(data.url);
      } else {
        setProfileError(data.error || "Upload failed");
        setTimeout(() => setProfileError(""), 3000);
      }
    } catch (err) {
      setProfileError("Network error during upload");
      setTimeout(() => setProfileError(""), 3000);
    } finally {
      setAvatarUploading(false);
    }
  };

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

  const Toggle = ({ value, onChange }) => (
    <button
      className={`toggle-switch ${value ? "active" : ""}`}
      onClick={() => onChange(!value)}
      type="button"
      aria-pressed={value}
    >
      <div className="toggle-knob" />
    </button>
  );

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
        <div className="profile-banner" style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}} />
        <div className="profile-content">
          <div className="profile-avatar-wrapper">
            <Avatar name={me?.username || "User"} size={72} imageUrl={avatarUrl || me?.avatarUrl} />
            <div className="profile-status-ring">
              <StatusBadge status="online" />
            </div>
          </div>
          <div className="profile-text">
            <h3 className="profile-name">{displayName || me?.username || "User"}</h3>
            <span className="profile-tag">@{me?.username?.toLowerCase() || "user"}</span>
            {customStatus && <span className="profile-status-text">{customStatus}</span>}
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
              <div className="nav-item-icon"><Icon size={20} /></div>
              <span className="nav-item-label">{tab.label}</span>
              <ChevronRight size={16} className="nav-item-chevron" />
            </motion.button>
          );
        })}
      </div>

      {/* Active Settings Content */}
      <div className="settings-content">
        <AnimatePresence mode="wait">
          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="settings-tab">
              <h3>Account Overview</h3>
              <div className="info-card">
                <div className="info-row"><span className="info-label">Username</span><span className="info-value">{me?.username || "User"}</span></div>
                <div className="info-row"><span className="info-label">User ID</span><span className="info-value">{me?.id || "Unknown"}</span></div>
                <div className="info-row"><span className="info-label">Email</span><span className="info-value">{me?.email || "Not set"}</span></div>
                <div className="info-row"><span className="info-label">Status</span><span className="info-value status-online">Online</span></div>
              </div>
            </motion.div>
          )}

          {/* ── Profile Editor ── */}
          {activeTab === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="settings-tab">
              <h3>Profile Customization</h3>
              <p className="settings-desc">Customize your display name, bio, and avatar.</p>

              <div className="profile-editor-card">
                <label className="profile-field-label">
                  <Type size={14} /> Display Name
                </label>
                <input className="profile-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" maxLength={32} />

                <label className="profile-field-label">
                  <User size={14} /> Bio / About Me
                </label>
                <textarea className="profile-textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell others about yourself..." rows={3} maxLength={190} />
                <span className="char-count">{bio.length}/190</span>

                <label className="profile-field-label">
                  <MonitorSpeaker size={14} /> Custom Status
                </label>
                <input className="profile-input" value={customStatus} onChange={(e) => setCustomStatus(e.target.value)} placeholder="What's on your mind?" maxLength={60} />

                <label className="profile-field-label">
                  <Camera size={14} /> Profile Photo
                </label>
                <div className="avatar-picker-row">
                  <div
                    className="avatar-picker-preview"
                    onClick={() => !avatarUploading && fileInputRef.current?.click()}
                    title="Click to change photo"
                  >
                    <Avatar name={me?.username || "User"} size={64} imageUrl={avatarUrl || me?.avatarUrl} />
                    <div className="avatar-picker-overlay">
                      {avatarUploading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                          style={{ width: 22, height: 22, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%" }}
                        />
                      ) : (
                        <Camera size={20} color="#fff" />
                      )}
                    </div>
                  </div>
                  <div className="avatar-picker-info">
                    <input
                      className="profile-input"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="Paste image URL or upload..."
                    />
                    <div className="avatar-picker-actions">
                      <motion.button
                        className="avatar-action-btn primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        whileTap={{ scale: 0.96 }}
                      >
                        <Upload size={13} />
                        {avatarUploading ? "Uploading..." : "Upload Photo"}
                      </motion.button>
                      {avatarUrl && (
                        <motion.button
                          className="avatar-action-btn danger"
                          onClick={() => setAvatarUrl("")}
                          whileTap={{ scale: 0.96 }}
                          title="Remove photo"
                        >
                          <X size={13} />
                          Remove
                        </motion.button>
                      )}
                    </div>
                    <span className="avatar-upload-hint">JPG, PNG or GIF · Max 8 MB</span>
                  </div>
                </div>
                <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleAvatarUpload} />

                <label className="profile-field-label">
                  <Camera size={14} /> Banner URL
                </label>
                <input className="profile-input" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." />

                {profileError && (
                  <div className="profile-error-banner" style={{ color: "var(--danger)", fontSize: "0.9rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={16} />
                    <span>{profileError}</span>
                  </div>
                )}
                <motion.button className="settings-action-btn" onClick={handleSaveProfile} disabled={savingProfile} whileTap={{ scale: 0.98 }}>
                  {profileSaved ? <><Check size={16} /> Saved</> : savingProfile ? "Saving..." : "Save Changes"}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Appearance ── */}
          {activeTab === "appearance" && (
            <motion.div key="appearance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="settings-tab">
              <h3>Appearance</h3>
              <div className="toggle-row">
                <span><Moon size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Dark Mode</span>
                <Toggle value={darkMode} onChange={setDarkMode} />
              </div>
              <div className="toggle-row">
                <span><MonitorSpeaker size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Compact Mode</span>
                <Toggle value={compactMode} onChange={setCompactMode} />
              </div>
            </motion.div>
          )}

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <motion.div key="notifications" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="settings-tab">
              <h3>Notifications</h3>
              <div className="toggle-row">
                <span><Bell size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Message Notifications</span>
                <Toggle value={msgNotifications} onChange={setMsgNotifications} />
              </div>
              <div className="toggle-row">
                <span><Mic size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Call Notifications</span>
                <Toggle value={callNotifications} onChange={setCallNotifications} />
              </div>
            </motion.div>
          )}

          {/* ── Voice & Video ── */}
          {activeTab === "voice" && (
            <motion.div key="voice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="settings-tab">
              <h3>Voice & Video</h3>
              <p className="settings-desc">Select your audio and video devices.</p>

              <div className="device-section">
                <label className="device-label"><Mic size={14} /> Microphone (Input)</label>
                <select className="device-select" value={selectedAudioIn} onChange={(e) => setSelectedAudioIn(e.target.value)}>
                  <option value="">Default</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>

              <div className="device-section">
                <label className="device-label"><Headphones size={14} /> Speaker (Output)</label>
                <select className="device-select" value={selectedAudioOut} onChange={(e) => setSelectedAudioOut(e.target.value)}>
                  <option value="">Default</option>
                  {audioOutputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>

              <div className="device-section">
                <label className="device-label"><Camera size={14} /> Camera (Video)</label>
                <select className="device-select" value={selectedVideoIn} onChange={(e) => setSelectedVideoIn(e.target.value)}>
                  <option value="">Default</option>
                  {videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>

              <div className="device-section mic-test">
                <label className="device-label"><Mic size={14} /> Microphone Test</label>
                <div className="mic-test-bar">
                  <div className="mic-test-fill" style={{ width: `${Math.min(micTestLevel * 100 / 255, 100)}%` }} />
                </div>
                <div className="mic-test-buttons">
                  <motion.button className="settings-action-btn small" onClick={startMicTest} whileTap={{ scale: 0.97 }}>Test Mic</motion.button>
                  <motion.button className="settings-action-btn small secondary" onClick={stopMicTest} whileTap={{ scale: 0.97 }}>Stop</motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Sound ── */}
          {activeTab === "sound" && (
            <motion.div key="sound" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="settings-tab">
              <h3>Sound Effects</h3>
              <div className="toggle-row">
                <span><Bell size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Message Sounds</span>
                <Toggle value={msgSounds} onChange={setMsgSounds} />
              </div>
              <div className="toggle-row">
                <span><Mic size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Call Sounds</span>
                <Toggle value={callSounds} onChange={setCallSounds} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Logout Button */}
      <div className="user-panel-footer">
        <motion.button className="logout-btn" onClick={handleLogoutClick} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <LogOut size={18} /><span>Log Out</span>
        </motion.button>
      </div>
    </motion.aside>
  );
}
