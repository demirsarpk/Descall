import { useState, useEffect, useRef, useCallback, forwardRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Mic, Headphones, Bell, User, LogOut, Moon, Sun,
  ChevronRight, ChevronLeft, Palette, Volume2, Camera,
  Type, Upload, Check, MonitorSpeaker, AlertTriangle,
  Copy, Image as ImageIcon, RefreshCw, Globe, Shield,
  ShoppingBag, Mail, Monitor, CheckCircle2, UserX, Sparkles,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import StatusBadge from "../ui/StatusBadge";
import { getToken, setUser } from "../../lib/storage";
import { API_BASE_URL } from "../../config/api";
import { normalizeUser } from "../../lib/userProfile";
import { cssUrl } from "../../lib/cssUrl";
import { getMe } from "../../api/auth";
import {
  setEmail as apiSetEmail,
  resendEmailCode,
  verifyEmailCode,
  enable2fa,
  disable2fa,
  getSessions,
  revokeSession,
  revokeOtherSessions,
} from "../../api/security";
import { unblockUser, getBlockedUsers } from "../../api/friends";
import { setSoundEnabled, getAudioSettings } from "../../lib/audioManager";
import { useMobile } from "../../hooks/useMobile";
import { useLocale } from "../../context/LocaleContext";
import { detectDefaultLocale } from "../../i18n/detect";
import RiotLinkCard from "../settings/RiotLinkCard";
import ValorantBadge from "../social/ValorantBadge";
import AdminBadge from "../social/AdminBadge";
import ShopPanel from "../settings/ShopPanel";
import { getShopCatalog, getShopInventory, equipShopItem } from "../../api/shop";

/* ─── Helpers ─── */
const SETTINGS_KEY = "descall_user_settings";
const LEGACY_SETTINGS_KEY = "descall_settings";

const loadSettings = () => {
  try {
    const primary = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    if (Object.keys(primary).length) return primary;
    return JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveSettings = (obj) => {
  const json = JSON.stringify(obj);
  localStorage.setItem(SETTINGS_KEY, json);
  // Keep legacy key in sync for boot-theme + older readers
  localStorage.setItem(LEGACY_SETTINGS_KEY, json);
};

const ACCENT_SWATCHES = [
  { id: "blurple", hex: "#5865F2" },
  { id: "indigo", hex: "#4752C4" },
  { id: "green", hex: "#23A55A" },
  { id: "teal", hex: "#1ABC9C" },
  { id: "fuchsia", hex: "#EB459E" },
  { id: "gold", hex: "#F0B232" },
  { id: "red", hex: "#ED4245" },
];

function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(88, 101, 242, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyAppearanceSettings({ accentColor, chatFontSize, uiDensity, bubbleStyle } = {}) {
  const root = document.documentElement;
  if (accentColor) {
    root.style.setProperty("--primary", accentColor);
    root.style.setProperty("--primary-2", accentColor);
    root.style.setProperty("--primary-soft", hexToRgba(accentColor, 0.12));
    root.style.setProperty("--primary-glow", hexToRgba(accentColor, 0.35));
    root.style.setProperty("--shadow-glow-primary", `0 0 16px ${hexToRgba(accentColor, 0.24)}`);
    root.style.setProperty("--accent", accentColor);
  }
  if (chatFontSize) {
    root.style.setProperty("--chat-font-size", `${chatFontSize}px`);
  }
  if (uiDensity) {
    root.setAttribute("data-density", uiDensity);
  }
  if (bubbleStyle) {
    root.setAttribute("data-bubble", bubbleStyle);
  }
}

function Toggle({ value, onChange, label }) {
  return (
    <button
      className={`us-toggle ${value ? "active" : ""}`}
      onClick={() => onChange(!value)}
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
    >
      <span className="us-toggle-knob" />
    </button>
  );
}

function SettingRow({ icon: Icon, title, description, children }) {
  return (
    <div className="us-row">
      <div className="us-row-text">
        {Icon && (
          <span className="us-row-icon" aria-hidden>
            <Icon size={16} />
          </span>
        )}
        <div className="us-row-copy">
          <span className="us-row-title">{title}</span>
          {description && <span className="us-row-desc">{description}</span>}
        </div>
      </div>
      <div className="us-row-control">{children}</div>
    </div>
  );
}

const NAV_GROUPS_DEF = [
  {
    labelKey: "settings.account",
    items: [
      { id: "overview", labelKey: "settings.myAccount", icon: User, hintKey: "settings.accountHint" },
      { id: "profile", labelKey: "settings.profile", icon: Type, hintKey: "settings.profileHint" },
      { id: "security", labelKey: "settings.security", icon: Shield, hintKey: "settings.securityHint" },
    ],
  },
  {
    labelKey: "settings.app",
    items: [
      { id: "appearance", labelKey: "settings.appearance", icon: Palette, hintKey: "settings.appearanceHint" },
      { id: "notifications", labelKey: "settings.notifications", icon: Bell, hintKey: "settings.notificationsHint" },
      { id: "language", labelKey: "settings.language", icon: Globe, hintKey: "settings.languageHint" },
    ],
  },
  {
    labelKey: "settings.media",
    items: [
      { id: "voice", labelKey: "settings.voiceVideo", icon: Mic, hintKey: "settings.voiceHint" },
      { id: "sound", labelKey: "settings.soundEffects", icon: Volume2, hintKey: "settings.soundHint" },
    ],
  },
  {
    labelKey: "settings.personalization",
    items: [
      { id: "shop", labelKey: "settings.shop", icon: ShoppingBag, hintKey: "settings.shopHint" },
    ],
  },
];

const TAB_TITLE_KEYS = {
  overview: "settings.myAccount",
  profile: "settings.profile",
  security: "settings.security",
  appearance: "settings.appearance",
  notifications: "settings.notifications",
  language: "settings.language",
  voice: "settings.voiceVideo",
  sound: "settings.soundEffects",
  shop: "settings.shop",
};

const UserPanel = forwardRef(function UserPanel({
  me,
  onClose,
  onLogout,
  onProfileUpdated,
  myStatus = "online",
  onStatusChange,
  initialTab = "overview",
  onTabChange,
}, ref) {
  const { isMobile } = useMobile();
  const { t, locale, setLocale, locales } = useLocale();
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileDetail, setMobileDetail] = useState(false);
  const stored = loadSettings();

  const navGroups = useMemo(
    () =>
      NAV_GROUPS_DEF.map((g) => ({
        label: t(g.labelKey),
        items: g.items.map((item) => ({
          ...item,
          label: t(item.labelKey),
          hint: t(item.hintKey),
        })),
      })),
    [t]
  );

  const tabTitles = useMemo(() => {
    const out = {};
    for (const [id, key] of Object.entries(TAB_TITLE_KEYS)) out[id] = t(key);
    return out;
  }, [t]);

  const deviceDefault = useMemo(() => detectDefaultLocale(), []);

  useEffect(() => {
    if (initialTab && TAB_TITLE_KEYS[initialTab]) setActiveTab(initialTab);
  }, [initialTab]);

  /* ── Profile editor ── */
  const [displayName, setDisplayName] = useState(me?.displayName || me?.username || "");
  const [bio, setBio] = useState(me?.bio || "");
  const [customStatus, setCustomStatus] = useState(me?.customStatus || "");
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl || me?.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(me?.bannerUrl || me?.banner_url || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const fileInputRef = useRef(null);

  /* ── Security: email verification, 2FA, sessions, blocked users ── */
  const [emailDraft, setEmailDraft] = useState(me?.email || "");
  const [emailVerified, setEmailVerified] = useState(Boolean(me?.emailVerified));
  const [emailCode, setEmailCode] = useState("");
  const [emailStage, setEmailStage] = useState(me?.email && !me?.emailVerified ? "code" : "idle");
  const [emailNotice, setEmailNotice] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [twoFactorOn, setTwoFactorOn] = useState(Boolean(me?.twoFactorEnabled));
  const [disable2faPassword, setDisable2faPassword] = useState("");
  const [show2faPasswordPrompt, setShow2faPasswordPrompt] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionNotice, setSessionNotice] = useState("");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  useEffect(() => {
    setEmailDraft(me?.email || "");
    setEmailVerified(Boolean(me?.emailVerified));
    setTwoFactorOn(Boolean(me?.twoFactorEnabled));
  }, [me?.email, me?.emailVerified, me?.twoFactorEnabled]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { sessions: list } = await getSessions();
      setSessions(list || []);
    } catch {
      /* best-effort */
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
      /* best-effort */
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "security") {
      loadSessions();
      loadBlocked();
    }
  }, [activeTab, loadSessions, loadBlocked]);

  const refreshMeFromServer = useCallback(async () => {
    try {
      const token = getToken();
      const { user } = await getMe(token);
      const normalized = normalizeUser(user);
      setUser(normalized);
      onProfileUpdated?.(normalized);
      return normalized;
    } catch {
      return null;
    }
  }, [onProfileUpdated]);

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
      await refreshMeFromServer();
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
        await refreshMeFromServer();
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
      await refreshMeFromServer();
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
      /* best-effort */
    }
  };

  /* ── Shop: equipped cosmetics ── */
  const equipped = useMemo(
    () => ({
      bannerId: me?.equippedBanner?.id || null,
      avatarFrameId: me?.equippedAvatarFrame?.id || null,
      backgroundId: me?.equippedBackground?.id || null,
      themeId: me?.equippedTheme?.id || null,
    }),
    [me?.equippedBanner?.id, me?.equippedAvatarFrame?.id, me?.equippedBackground?.id, me?.equippedTheme?.id]
  );

  const handleEquippedChange = useCallback(() => {
    // Re-fetch /auth/me so the resolved item (name, asset_url) is available
    // app-wide immediately — nav rail, message avatars, profile modal, etc.
    refreshMeFromServer();
  }, [refreshMeFromServer]);

  /* ── Appearance ── */
  const [darkMode, setDarkMode] = useState(stored.darkMode !== false);
  const [accentColor, setAccentColor] = useState(stored.accentColor || "#5865F2");
  const [chatFontSize, setChatFontSize] = useState(stored.chatFontSize || 14);
  const [uiDensity, setUiDensity] = useState(stored.uiDensity || "comfortable");
  const [bubbleStyle, setBubbleStyle] = useState(stored.bubbleStyle || "modern");
  const [ownedThemes, setOwnedThemes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ items }, { inventory }] = await Promise.all([getShopCatalog(), getShopInventory()]);
        if (cancelled) return;
        const ownedIds = new Set((inventory || []).map((i) => i.itemId));
        setOwnedThemes((items || []).filter((i) => i.category === "theme" && ownedIds.has(i.id)));
      } catch {
        /* best-effort — Appearance tab still works with Dark/Light only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A purchased premium theme always wins over the plain Dark/Light choice —
  // picking Dark or Light explicitly clears it (see handlePickBaseTheme).
  const equippedThemeKey = me?.equippedTheme?.theme_key || null;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", equippedThemeKey || (darkMode ? "dark" : "light"));
  }, [darkMode, equippedThemeKey]);

  const handlePickBaseTheme = useCallback(
    async (wantDark) => {
      setDarkMode(wantDark);
      if (equippedThemeKey) {
        try {
          await equipShopItem("theme", null);
          await refreshMeFromServer();
        } catch {
          /* best-effort */
        }
      }
    },
    [equippedThemeKey, refreshMeFromServer]
  );

  const handlePickPremiumTheme = useCallback(
    async (themeItem) => {
      try {
        await equipShopItem("theme", themeItem.id);
        document.documentElement.setAttribute("data-theme", themeItem.theme_key);
        await refreshMeFromServer();
      } catch {
        /* best-effort */
      }
    },
    [refreshMeFromServer]
  );

  useEffect(() => {
    applyAppearanceSettings({ accentColor, chatFontSize, uiDensity, bubbleStyle });
  }, [accentColor, chatFontSize, uiDensity, bubbleStyle]);

  /* ── Notifications ── */
  const [msgNotifications, setMsgNotifications] = useState(stored.msgNotifications !== false);
  const [callNotifications, setCallNotifications] = useState(stored.callNotifications !== false);

  /* ── Sound ── */
  const audioDefaults = getAudioSettings?.() || {};
  const [msgSounds, setMsgSounds] = useState(
    stored.msgSounds !== undefined ? stored.msgSounds !== false : audioDefaults.message !== false
  );
  const [callSounds, setCallSounds] = useState(
    stored.callSounds !== undefined ? stored.callSounds !== false : audioDefaults.incomingCall !== false
  );

  /* ── Voice & Video ── */
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [videoInputs, setVideoInputs] = useState([]);
  const [selectedAudioIn, setSelectedAudioIn] = useState(stored.selectedAudioIn || "");
  const [selectedAudioOut, setSelectedAudioOut] = useState(stored.selectedAudioOut || "");
  const [selectedVideoIn, setSelectedVideoIn] = useState(stored.selectedVideoIn || "");
  const [micTestLevel, setMicTestLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);
  const micAnalyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const micRafRef = useRef(null);

  useEffect(() => {
    saveSettings({
      darkMode,
      accentColor,
      chatFontSize,
      uiDensity,
      bubbleStyle,
      msgNotifications,
      callNotifications,
      msgSounds,
      callSounds,
      selectedAudioIn,
      selectedAudioOut,
      selectedVideoIn,
      language: locale,
    });
  }, [
    darkMode,
    accentColor,
    chatFontSize,
    uiDensity,
    bubbleStyle,
    msgNotifications,
    callNotifications,
    msgSounds,
    callSounds,
    selectedAudioIn,
    selectedAudioOut,
    selectedVideoIn,
    locale,
  ]);

  const handleMsgSounds = (v) => {
    setMsgSounds(v);
    try {
      setSoundEnabled("message", v);
      setSoundEnabled("notification", v);
    } catch { /* audio not ready */ }
  };

  const handleCallSounds = (v) => {
    setCallSounds(v);
    try {
      setSoundEnabled("incomingCall", v);
      setSoundEnabled("outgoingCall", v);
      setSoundEnabled("callStart", v);
    } catch { /* audio not ready */ }
  };

  const refreshDevices = useCallback(async () => {
    try {
      // Unlock device labels when possible; ignore if no mic/camera is available.
      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          /* permission denied or no input device — still enumerate */
        }
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
      setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
      setVideoInputs(devices.filter((d) => d.kind === "videoinput"));
    } catch (err) {
      console.warn("Device enumeration failed:", err?.message || err);
    }
  }, []);

  const startMicTest = useCallback(async () => {
    if (micStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: selectedAudioIn ? { exact: selectedAudioIn } : undefined },
      });
      micStreamRef.current = stream;
      setMicTesting(true);
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
    } catch {
      setMicTesting(false);
    }
  }, [selectedAudioIn]);

  const stopMicTest = useCallback(() => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    micAnalyserRef.current = null;
    setMicTestLevel(0);
    setMicTesting(false);
  }, []);

  useEffect(() => () => stopMicTest(), [stopMicTest]);

  /* Only probe media devices when the Voice tab is open */
  useEffect(() => {
    if (activeTab !== "voice") {
      stopMicTest();
      return undefined;
    }
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refreshDevices);
  }, [activeTab, refreshDevices, stopMicTest]);

  useEffect(() => {
    if (!me) return;
    setDisplayName(me.displayName || me.display_name || me.username || "");
    setBio(me.bio || "");
    setCustomStatus(me.customStatus || me.custom_status || "");
    setAvatarUrl(me.avatarUrl || me.avatar_url || "");
    setBannerUrl(me.bannerUrl || me.banner_url || "");
  }, [me?.id, me?.avatarUrl, me?.avatar_url, me?.displayName, me?.display_name, me?.updated_at]);

  // An equipped shop banner always takes precedence over a manually-set URL —
  // matches how the rest of the app (UserProfileModal, message list) renders it.
  const effectiveBannerUrl = me?.equippedBanner?.asset_url || bannerUrl;

  const applyProfileLocally = (user) => {
    const normalized = normalizeUser(user);
    if (!normalized) return;
    setUser(normalized);
    onProfileUpdated?.(normalized);
    return normalized;
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          displayName: (displayName || "").trim() || null,
          bio,
          customStatus,
          avatarUrl,
          bannerUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const savedName = (displayName || "").trim() || null;
        const updated = applyProfileLocally(
          data.user || {
            ...me,
            displayName: savedName,
            display_name: savedName,
            bio,
            customStatus,
            avatarUrl,
            bannerUrl,
            updated_at: new Date().toISOString(),
          }
        );
        if (updated?.avatarUrl) setAvatarUrl(updated.avatarUrl);
        if (updated) {
          setDisplayName(updated.displayName || updated.username || "");
        }
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error || t("Failed to save profile"));
        setTimeout(() => setProfileError(""), 3000);
      }
    } catch {
      setProfileError(t("Network error while saving profile"));
      setTimeout(() => setProfileError(""), 3000);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setProfileError(t("Avatar must be JPG, PNG, WebP, or GIF."));
      setTimeout(() => setProfileError(""), 3000);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setProfileError(t("Avatar must be 8 MB or smaller."));
      setTimeout(() => setProfileError(""), 3000);
      return;
    }
    setAvatarUploading(true);
    setProfileError("");
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/media/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.avatarUrl) {
        setAvatarUrl(data.avatarUrl);
        if (data.user) applyProfileLocally(data.user);
        else {
          applyProfileLocally({
            ...me,
            avatarUrl: data.avatarUrl,
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        setProfileError(data.error || "Upload failed");
        setTimeout(() => setProfileError(""), 3000);
      }
    } catch {
      setProfileError("Network error during upload");
      setTimeout(() => setProfileError(""), 3000);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogoutClick = () => {
    if (window.confirm(t("Are you sure you want to log out?"))) onLogout?.();
  };

  const copyUserId = async () => {
    if (!me?.id) return;
    try {
      await navigator.clipboard.writeText(String(me.id));
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1600);
    } catch { /* ignore */ }
  };

  const openTab = (id) => {
    setActiveTab(id);
    onTabChange?.(id);
    if (isMobile) setMobileDetail(true);
  };

  const backToMenu = () => setMobileDetail(false);

  const showMenu = !isMobile || !mobileDetail;
  const showDetail = !isMobile || mobileDetail;

  /* ─── Tab content ─── */
  const renderTab = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="us-tab">
            <div className="us-hero">
            <div
              className="us-hero-banner"
              style={
                effectiveBannerUrl
                  ? { backgroundImage: cssUrl(effectiveBannerUrl) }
                  : undefined
              }
            />
              <div className="us-hero-body">
                <div className="us-hero-avatar">
                  <Avatar
                    name={me?.username || "User"}
                    size={72}
                    user={{ ...me, avatarUrl: avatarUrl || me?.avatarUrl }}
                    animate="always"
                  />
                  <span className="us-hero-status">
                    <StatusBadge status={myStatus === "invisible" ? "offline" : myStatus} />
                  </span>
                </div>
                <div className="us-hero-meta">
                  <h3 style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap" }}>
                    {displayName || me?.username || "User"}
                  </h3>
                  <span className="us-muted">@{me?.username?.toLowerCase() || "user"}</span>
                  <AdminBadge user={me} variant="chip" />
                  {customStatus && <span className="us-status-pill">{customStatus}</span>}
                  {me?.valorant?.linked && (
                    <ValorantBadge valorant={me.valorant} compact />
                  )}
                </div>
              </div>
            </div>

            <RiotLinkCard />

            <section className="us-section">
              <h4 className="us-section-label">{t("Account details")}</h4>
              <div className="us-card">
                <div className="us-info-row">
                  <span className="us-muted">{t("Username")}</span>
                  <span className="us-info-value">{me?.username || "User"}</span>
                </div>
                <div className="us-info-row">
                  <span className="us-muted">{t("Email")}</span>
                  <span className="us-info-value">{me?.email || t("Not set")}</span>
                </div>
                <div className="us-info-row">
                  <span className="us-muted">{t("User ID")}</span>
                  <button type="button" className="us-copy-btn" onClick={copyUserId} title={t("Copy ID")}>
                    <span className="us-info-value mono">{me?.id || "—"}</span>
                    {copiedId ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="us-info-row">
                  <span className="us-muted">{t("Status")}</span>
                  <span className="us-online-dot">{t("Online")}</span>
                </div>
              </div>
            </section>

            {isMobile && (
              <section className="us-section">
                <button type="button" className="us-danger-btn" onClick={handleLogoutClick}>
                  <LogOut size={16} />
                  {t("Log Out")}
                </button>
              </section>
            )}
          </div>
        );

      case "profile":
        return (
          <div className="us-tab">
            <p className="us-lead">{t("Update how others see you across Descall.")}</p>

            <div
              className="us-profile-preview"
              style={
                effectiveBannerUrl
                  ? { backgroundImage: cssUrl(effectiveBannerUrl) }
                  : undefined
              }
            >
              <div className="us-profile-preview-fade" />
              <Avatar
                name={me?.username || "User"}
                size={56}
                user={{ ...me, avatarUrl: avatarUrl || me?.avatarUrl }}
                animate="always"
              />
              <div>
                <strong>{displayName || me?.username || "User"}</strong>
                <span>@{me?.username?.toLowerCase() || "user"}</span>
              </div>
            </div>

            <section className="us-section">
              <h4 className="us-section-label">{t("Identity")}</h4>
              <div className="us-card us-form">
                <label className="us-field">
                  <span><Type size={13} /> {t("Display name")}</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("Your display name")}
                    maxLength={32}
                  />
                </label>
                <label className="us-field">
                  <span><User size={13} /> {t("Bio")}</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t("Tell others about yourself…")}
                    rows={3}
                    maxLength={190}
                  />
                  <em className="us-char">{bio.length}/190</em>
                </label>
                <label className="us-field">
                  <span><MonitorSpeaker size={13} /> {t("Custom status")}</span>
                  <input
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder={t("What's on your mind?")}
                    maxLength={60}
                  />
                </label>
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Photos")}</h4>
              <div className="us-card us-form">
                <div className="us-avatar-block">
                  <button
                    type="button"
                    className="us-avatar-preview"
                    onClick={() => !avatarUploading && fileInputRef.current?.click()}
                    disabled={avatarUploading}
                  >
                    <Avatar
                      name={me?.username || "User"}
                      size={72}
                      user={{ ...me, avatarUrl: avatarUrl || me?.avatarUrl }}
                      animate="always"
                    />
                    <span className="us-avatar-overlay">
                      {avatarUploading ? <RefreshCw size={18} className="us-spin" /> : <Camera size={18} />}
                    </span>
                  </button>
                  <div className="us-avatar-actions">
                    <input
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder={t("Paste image or GIF URL…")}
                    />
                    <div className="us-btn-row">
                      <button
                        type="button"
                        className="us-btn primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                      >
                        <Upload size={14} />
                        {avatarUploading ? t("Uploading…") : t("Upload")}
                      </button>
                      {avatarUrl && (
                        <button type="button" className="us-btn ghost-danger" onClick={() => setAvatarUrl("")}>
                          <X size={14} /> {t("Remove")}
                        </button>
                      )}
                    </div>
                    <span className="us-hint">{t("JPG, PNG, WebP or GIF · Max 8 MB · GIFs animate on hover / while speaking")}</span>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  ref={fileInputRef}
                  className="us-hidden"
                  onChange={handleAvatarUpload}
                />

                <label className="us-field">
                  <span><ImageIcon size={13} /> {t("Banner URL")}</span>
                  <input
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
              </div>
            </section>

            {profileError && (
              <div className="us-alert danger">
                <AlertTriangle size={15} />
                <span>{profileError}</span>
              </div>
            )}

            <div className="us-sticky-actions">
              <button
                type="button"
                className={`us-btn primary wide ${profileSaved ? "success" : ""}`}
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {profileSaved ? <><Check size={16} /> {t("Saved")}</> : savingProfile ? t("Saving…") : t("Save changes")}
              </button>
            </div>
          </div>
        );

      case "security":
        return (
          <div className="us-tab">
            <p className="us-lead">{t("Protect your account with email verification and two-factor sign-in.")}</p>

            <section className="us-section">
              <h4 className="us-section-label">{t("Email address")}</h4>
              <div className="us-card us-form">
                <SettingRow
                  icon={Mail}
                  title={t("Email address")}
                  description={
                    emailVerified
                      ? t("Verified — used for sign-in codes and account alerts.")
                      : t("Verify your email to enable two-factor authentication.")
                  }
                >
                  {emailVerified && (
                    <span className="us-verified-pill">
                      <CheckCircle2 size={13} /> {t("Verified")}
                    </span>
                  )}
                </SettingRow>

                {!emailVerified && (
                  <div className="us-email-verify-flow">
                    <input
                      type="email"
                      className="us-inline-input"
                      placeholder={t("you@example.com")}
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      disabled={emailStage === "code"}
                    />
                    {emailStage !== "code" ? (
                      <button
                        type="button"
                        className="us-btn primary"
                        onClick={handleSendEmailCode}
                        disabled={emailBusy || !emailDraft.trim()}
                      >
                        {emailBusy ? t("Sending…") : t("Send code")}
                      </button>
                    ) : (
                      <>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          className="us-inline-input us-code-input"
                          placeholder="123456"
                          value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                        />
                        <button
                          type="button"
                          className="us-btn primary"
                          onClick={handleVerifyEmailCode}
                          disabled={emailBusy || emailCode.length !== 6}
                        >
                          {emailBusy ? t("Verifying…") : t("Verify")}
                        </button>
                        <button type="button" className="us-link-btn" onClick={handleResendEmailCode} disabled={emailBusy}>
                          {t("Resend code")}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {emailNotice && <p className="us-inline-notice">{emailNotice}</p>}
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Two-Factor Authentication")}</h4>
              <div className="us-card stack">
                <SettingRow
                  icon={Shield}
                  title={t("Two-Factor Authentication")}
                  description={
                    emailVerified
                      ? t("Get a sign-in code emailed to you on every new login.")
                      : t("Verify your email above to unlock this.")
                  }
                >
                  <Toggle
                    value={twoFactorOn}
                    onChange={handleToggle2fa}
                    label={t("Two-Factor Authentication")}
                  />
                </SettingRow>

                <AnimatePresence>
                  {show2faPasswordPrompt && (
                    <motion.div
                      className="us-email-verify-flow"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}
                    >
                      <p className="us-inline-notice">{t("Enter your password to turn off two-factor authentication.")}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="password"
                          className="us-inline-input"
                          placeholder={t("Password")}
                          value={disable2faPassword}
                          onChange={(e) => setDisable2faPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="us-btn primary"
                          onClick={confirmDisable2fa}
                          disabled={twoFaBusy || !disable2faPassword}
                        >
                          {t("Confirm")}
                        </button>
                        <button
                          type="button"
                          className="us-link-btn"
                          onClick={() => { setShow2faPasswordPrompt(false); setDisable2faPassword(""); }}
                        >
                          {t("Cancel")}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            <section className="us-section">
              <div className="us-section-label-row">
                <h4 className="us-section-label">{t("Active sessions")}</h4>
                {sessions.length > 1 && (
                  <button type="button" className="us-link-btn" onClick={handleRevokeOthers}>
                    <LogOut size={12} /> {t("Sign out all other sessions")}
                  </button>
                )}
              </div>
              {sessionNotice && <p className="us-inline-notice">{sessionNotice}</p>}
              <div className="us-card stack">
                {sessionsLoading ? (
                  <p className="us-muted" style={{ padding: "8px 4px" }}>{t("Loading…")}</p>
                ) : sessions.length === 0 ? (
                  <p className="us-muted" style={{ padding: "8px 4px" }}>{t("No active sessions found.")}</p>
                ) : (
                  sessions.map((session) => (
                    <div className="us-list-row" key={session.id}>
                      <span className="us-row-icon"><Monitor size={16} /></span>
                      <div className="us-row-copy" style={{ flex: 1 }}>
                        <span className="us-row-title">
                          {session.device}
                          {session.current && <em className="us-current-tag"> · {t("This device")}</em>}
                        </span>
                        <span className="us-row-desc">
                          {session.ip} • {t("Last active")}{" "}
                          {session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : ""}
                        </span>
                      </div>
                      {!session.current && (
                        <button type="button" className="us-btn ghost sm" onClick={() => handleRevokeSession(session.id)}>
                          {t("End session")}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Blocked users")} ({blockedUsers.length})</h4>
              <div className="us-card stack">
                {blockedLoading ? (
                  <p className="us-muted" style={{ padding: "8px 4px" }}>{t("Loading…")}</p>
                ) : blockedUsers.length === 0 ? (
                  <p className="us-muted" style={{ padding: "8px 4px" }}>{t("No blocked users")}</p>
                ) : (
                  blockedUsers.map((user) => (
                    <div className="us-list-row" key={user.id}>
                      <Avatar name={user.username} size={32} user={user} />
                      <span className="us-row-title" style={{ flex: 1 }}>{user.displayName || user.username}</span>
                      <button type="button" className="us-btn ghost sm" onClick={() => handleUnblock(user.id)}>
                        <UserX size={13} /> {t("Unblock")}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        );

      case "shop":
        return (
          <div className="us-tab">
            <ShopPanel
              equipped={equipped}
              onEquippedChange={handleEquippedChange}
              balance={me?.descoinBalance || 0}
            />
          </div>
        );

      case "appearance":
        return (
          <div className="us-tab">
            <p className="us-lead">{t("Choose how Descall looks on this device.")}</p>
            <section className="us-section">
              <h4 className="us-section-label">{t("Theme")}</h4>
              <div className="us-theme-grid">
                <button
                  type="button"
                  className={`us-theme-card dark ${darkMode && !equippedThemeKey ? "selected" : ""}`}
                  onClick={() => handlePickBaseTheme(true)}
                >
                  <div className="us-theme-swatch dark" />
                  <div className="us-theme-meta">
                    <Moon size={15} />
                    <span>{t("Dark")}</span>
                  </div>
                  {darkMode && !equippedThemeKey && <Check size={14} className="us-theme-check" />}
                </button>
                <button
                  type="button"
                  className={`us-theme-card light ${!darkMode && !equippedThemeKey ? "selected" : ""}`}
                  onClick={() => handlePickBaseTheme(false)}
                >
                  <div className="us-theme-swatch light" />
                  <div className="us-theme-meta">
                    <Sun size={15} />
                    <span>{t("Light")}</span>
                  </div>
                  {!darkMode && !equippedThemeKey && <Check size={14} className="us-theme-check" />}
                </button>
                {ownedThemes.map((themeItem) => {
                  const selected = equippedThemeKey === themeItem.theme_key;
                  return (
                    <button
                      type="button"
                      key={themeItem.id}
                      className={`us-theme-card premium theme-${themeItem.theme_key} ${selected ? "selected" : ""}`}
                      onClick={() => handlePickPremiumTheme(themeItem)}
                    >
                      <div className={`us-theme-swatch theme-${themeItem.theme_key}`} />
                      <div className="us-theme-meta">
                        <Sparkles size={15} />
                        <span>{themeItem.name}</span>
                      </div>
                      {selected && <Check size={14} className="us-theme-check" />}
                    </button>
                  );
                })}
                {!ownedThemes.length && (
                  <button
                    type="button"
                    className="us-theme-card us-theme-card-shop-link"
                    onClick={() => setActiveTab("shop")}
                  >
                    <div className="us-theme-meta">
                      <ShoppingBag size={15} />
                      <span>{t("Get more in Shop")}</span>
                    </div>
                  </button>
                )}
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Accent color")}</h4>
              <div className="us-accent-grid">
                {ACCENT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    className={`us-accent-swatch ${accentColor.toLowerCase() === swatch.hex.toLowerCase() ? "selected" : ""}`}
                    style={{ background: swatch.hex, color: swatch.hex }}
                    aria-label={swatch.id}
                    onClick={() => setAccentColor(swatch.hex)}
                  />
                ))}
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Chat font size")}</h4>
              <div className="us-font-size-row">
                <Type size={14} />
                <input
                  type="range"
                  min={12}
                  max={18}
                  step={1}
                  value={chatFontSize}
                  onChange={(e) => setChatFontSize(Number(e.target.value))}
                  aria-label={t("Chat font size")}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)", width: 36 }}>{chatFontSize}px</span>
              </div>
              <div className="us-font-preview" style={{ marginTop: 10 }}>
                {t("The quick brown fox jumps over the lazy dog")}
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Density")}</h4>
              <div className="us-segmented">
                {[
                  { id: "compact", label: t("Compact") },
                  { id: "comfortable", label: t("Comfortable") },
                  { id: "spacious", label: t("Spacious") },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`us-segment ${uiDensity === opt.id ? "selected" : ""}`}
                    onClick={() => setUiDensity(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Message bubbles")}</h4>
              <div className="us-segmented">
                {[
                  { id: "modern", label: t("Modern") },
                  { id: "classic", label: t("Classic") },
                  { id: "minimal", label: t("Minimal") },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`us-segment ${bubbleStyle === opt.id ? "selected" : ""}`}
                    onClick={() => setBubbleStyle(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className={`us-bubble-preview bubble-${bubbleStyle}`}>
                <div className="us-bubble-demo other">{t("Hey — how’s it going?")}</div>
                <div className="us-bubble-demo own">{t("Pretty good! You?")}</div>
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Status")}</h4>
              <div className="us-card stack">
                {["online", "idle", "dnd", "invisible"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`status-picker-item ${myStatus === key ? "active" : ""}`}
                    onClick={() => onStatusChange?.(key)}
                    style={{ position: "relative" }}
                  >
                    <span
                      className="status-picker-dot"
                      style={{
                        background:
                          key === "online"
                            ? "var(--success)"
                            : key === "idle"
                            ? "var(--warning)"
                            : key === "dnd"
                            ? "var(--danger)"
                            : "var(--text-muted)",
                      }}
                    />
                    {key === "online"
                      ? t("Online")
                      : key === "idle"
                      ? t("Idle")
                      : key === "dnd"
                      ? t("Do Not Disturb")
                      : t("Invisible")}
                    {myStatus === key && <Check size={14} style={{ marginLeft: "auto" }} />}
                  </button>
                ))}
              </div>
            </section>
          </div>
        );

      case "notifications":
        return (
          <div className="us-tab">
            <p className="us-lead">{t("Control desktop and browser alerts.")}</p>
            <section className="us-section">
              <div className="us-card stack">
                <SettingRow
                  icon={Bell}
                  title={t("Message notifications")}
                  description={t("DMs, group messages, and mentions")}
                >
                  <Toggle
                    value={msgNotifications}
                    onChange={setMsgNotifications}
                    label={t("Message notifications")}
                  />
                </SettingRow>
                <SettingRow
                  icon={Mic}
                  title={t("Call notifications")}
                  description={t("Incoming voice and video calls")}
                >
                  <Toggle
                    value={callNotifications}
                    onChange={setCallNotifications}
                    label={t("Call notifications")}
                  />
                </SettingRow>
              </div>
            </section>
          </div>
        );

      case "language":
        return (
          <div className="us-tab">
            <p className="us-lead">{t("settings.languageDesc")}</p>
            <section className="us-section">
              <h4 className="us-section-label">{t("settings.appLanguage")}</h4>
              <div className="us-theme-grid us-lang-grid">
                {locales.map((opt) => {
                  const selected = locale === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`us-theme-card ${selected ? "selected" : ""}`}
                      onClick={() => setLocale(opt.id)}
                    >
                      <div className="us-theme-meta" style={{ gap: 10 }}>
                        <Globe size={16} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                          <span style={{ fontWeight: 700 }}>{t(opt.labelKey)}</span>
                          <span style={{ fontSize: 12, opacity: 0.65 }}>{opt.nativeLabel}</span>
                        </div>
                      </div>
                      {selected && <Check size={14} className="us-theme-check" />}
                    </button>
                  );
                })}
              </div>
              <p className="us-row-desc" style={{ marginTop: 14 }}>
                {t("settings.autoDetectHint")}{" "}
                ({t("Detected from your device")}: {deviceDefault === "tr" ? t("settings.turkish") : t("settings.english")})
              </p>
              <p className="us-row-desc" style={{ marginTop: 8 }}>
                {t("settings.appliesInstantly")}
              </p>
            </section>
          </div>
        );

      case "voice":
        return (
          <div className="us-tab">
            <p className="us-lead">{t("Pick the devices used for calls on this browser.")}</p>
            <section className="us-section">
              <div className="us-card us-form">
                <label className="us-field">
                  <span><Mic size={13} /> {t("Microphone")}</span>
                  <select value={selectedAudioIn} onChange={(e) => setSelectedAudioIn(e.target.value)}>
                    <option value="">{t("System default")}</option>
                    {audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="us-field">
                  <span><Headphones size={13} /> {t("Speaker")}</span>
                  <select value={selectedAudioOut} onChange={(e) => setSelectedAudioOut(e.target.value)}>
                    <option value="">{t("System default")}</option>
                    {audioOutputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Speaker ${d.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="us-field">
                  <span><Camera size={13} /> {t("Camera")}</span>
                  <select value={selectedVideoIn} onChange={(e) => setSelectedVideoIn(e.target.value)}>
                    <option value="">{t("System default")}</option>
                    {videoInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="us-btn ghost" onClick={refreshDevices}>
                  <RefreshCw size={14} /> {t("Refresh devices")}
                </button>
              </div>
            </section>

            <section className="us-section">
              <h4 className="us-section-label">{t("Microphone test")}</h4>
              <div className="us-card us-mic-test">
                <div className="us-mic-bar">
                  <div
                    className="us-mic-fill"
                    style={{ width: `${Math.min((micTestLevel * 100) / 255, 100)}%` }}
                  />
                </div>
                <div className="us-btn-row">
                  {!micTesting ? (
                    <button type="button" className="us-btn primary" onClick={startMicTest}>
                      <Mic size={14} /> {t("Test mic")}
                    </button>
                  ) : (
                    <button type="button" className="us-btn ghost" onClick={stopMicTest}>
                      {t("Stop")}
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>
        );

      case "sound":
        return (
          <div className="us-tab">
            <p className="us-lead">{t("Choose which in-app sounds play.")}</p>
            <section className="us-section">
              <div className="us-card stack">
                <SettingRow
                  icon={Bell}
                  title={t("Message sounds")}
                  description={t("Play a sound when a new message arrives")}
                >
                  <Toggle value={msgSounds} onChange={handleMsgSounds} label={t("Message sounds")} />
                </SettingRow>
                <SettingRow
                  icon={Volume2}
                  title={t("Call sounds")}
                  description={t("Ring and call connection sounds")}
                >
                  <Toggle value={callSounds} onChange={handleCallSounds} label={t("Call sounds")} />
                </SettingRow>
              </div>
            </section>
          </div>
        );

      default:
        return null;
    }
  };

  const panelRef = useRef(null);
  const handleShellClick = (e) => {
    // Close only when the click lands outside the dialog panel
    if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
  };

  const shellVariants = isMobile
    ? {
        // Mobile sheet: dim backdrop in parallel with the slide-up panel
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
        },
        exit: {
          opacity: 0,
          transition: { duration: 0.18, ease: [0.4, 0, 1, 1], delay: 0.04 },
        },
      }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            duration: 0.2,
            ease: [0.22, 1, 0.36, 1],
            when: "beforeChildren",
          },
        },
        exit: {
          opacity: 0,
          transition: {
            duration: 0.18,
            ease: [0.4, 0, 1, 1],
            when: "afterChildren",
          },
        },
      };

  // Mobile: full-screen sheet from the bottom (clearly visible).
  // Desktop: centered card scale + rise.
  const panelVariants = isMobile
    ? {
        hidden: { y: "100%" },
        visible: {
          y: 0,
          transition: { type: "spring", stiffness: 420, damping: 36, mass: 0.9 },
        },
        exit: {
          y: "100%",
          transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
        },
      }
    : {
        hidden: { opacity: 0, scale: 0.92, y: 24 },
        visible: {
          opacity: 1,
          scale: 1,
          y: 0,
          transition: { type: "spring", stiffness: 380, damping: 30, mass: 0.85 },
        },
        exit: {
          opacity: 0,
          scale: 0.96,
          y: 14,
          transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
        },
      };

  return (
    <motion.div
      ref={ref}
      className={`user-settings-shell ${isMobile ? "is-mobile" : "is-desktop"}`}
      variants={shellVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={handleShellClick}
    >
    <motion.div
      ref={panelRef}
      className={`user-settings ${isMobile ? "is-mobile" : "is-desktop"}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      variants={panelVariants}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sidebar / mobile menu */}
      <aside className={`us-sidebar ${showMenu ? "visible" : "hidden"}`}>
        <div className="us-sidebar-top">
          <div className="us-sidebar-brand">
            <div>
              <h2>{t("settings.title")}</h2>
              <p>{t("Manage your Descall account")}</p>
            </div>
            {isMobile && (
              <button type="button" className="us-icon-btn" onClick={onClose} aria-label={t("Close")}>
                <X size={20} />
              </button>
            )}
          </div>

          <button type="button" className="us-mini-profile" onClick={() => openTab("overview")}>
            <Avatar
              name={me?.username || t("User")}
              size={40}
              user={{ ...me, avatarUrl: avatarUrl || me?.avatarUrl }}
            />
            <div className="us-mini-meta">
              <strong style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap" }}>
                {displayName || me?.username || t("User")}
                <AdminBadge user={me} variant="inline" />
              </strong>
              <span>@{me?.username?.toLowerCase() || "user"}</span>
            </div>
            {isMobile && <ChevronRight size={16} className="us-chevron" />}
          </button>
        </div>

        <nav className="us-nav" aria-label={t("Settings sections")}>
          {navGroups.map((group) => (
            <div key={group.label} className="us-nav-group">
              <div className="us-nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id && (!isMobile || mobileDetail);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`us-nav-item ${active ? "active" : ""}`}
                    onClick={() => openTab(item.id)}
                  >
                    <span className="us-nav-ico">
                      <Icon size={18} />
                    </span>
                    <span className="us-nav-copy">
                      <span className="us-nav-label">{item.label}</span>
                      {isMobile && <span className="us-nav-hint">{item.hint}</span>}
                    </span>
                    {isMobile && <ChevronRight size={16} className="us-chevron" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="us-sidebar-foot">
          <button type="button" className="us-logout" onClick={handleLogoutClick}>
            <LogOut size={16} />
            {t("settings.logOut")}
          </button>
        </div>
      </aside>

      {/* Detail pane */}
      <section className={`us-main ${showDetail ? "visible" : "hidden"}`}>
        <header className="us-main-header">
          {isMobile ? (
            <button type="button" className="us-icon-btn" onClick={backToMenu} aria-label={t("Back")}>
              <ChevronLeft size={22} />
            </button>
          ) : (
            <div className="us-main-heading">
              <h3>{tabTitles[activeTab]}</h3>
            </div>
          )}
          {isMobile && <h3 className="us-mobile-title">{tabTitles[activeTab]}</h3>}
          <button type="button" className="us-icon-btn" onClick={onClose} aria-label={t("Close settings")}>
            <X size={20} />
          </button>
        </header>

        <div className="us-main-body">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="us-main-scroll"
            >
              {!isMobile && activeTab !== "overview" && (
                <h3 className="us-page-title">{tabTitles[activeTab]}</h3>
              )}
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </motion.div>
    </motion.div>
  );
});

export default UserPanel;
