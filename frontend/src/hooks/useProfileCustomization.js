import { useState, useEffect, useCallback } from "react";
import { getToken } from "../lib/storage";
import { API_BASE_URL } from "../config/api";

const STORAGE_KEY = "descall_profile_customization";

const defaultCustomization = {
  theme: {
    primaryColor: "#6678ff",
    secondaryColor: "#7d6bff",
    accentColor: "#4ecdc4",
    backgroundStyle: "gradient", // gradient, solid, image
    customBackground: null,
    darkMode: true,
    glassEffect: true,
  },
  animations: {
    enabled: true,
    intensity: "medium", // low, medium, high
    reducedMotion: false,
    particleEffects: true,
    soundEffects: true,
  },
  layout: {
    sidebarPosition: "left", // left, right
    compactMode: false,
    fontSize: "medium", // small, medium, large
    borderRadius: "medium", // none, small, medium, large
  },
  profile: {
    customStatus: "",
    statusEmoji: "",
    bannerColor: "",
    bannerImage: null,
    showActivity: true,
    showStatusTo: "everyone", // everyone, friends, nobody
    showOnlineStatus: true,
    showUsername: true,
  },
  notifications: {
    messageNotifications: true,
    callNotifications: true,
    groupNotifications: true,
    friendRequestNotifications: true,
  },
  privacy: {
    allowMessagesFromNonFriends: false,
    onlineStatusFriendsOnly: false,
    allowProfileViewing: true,
  },
};

export function useProfileCustomization() {
  const [customization, setCustomization] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultCustomization, ...JSON.parse(stored) } : defaultCustomization;
    } catch {
      return defaultCustomization;
    }
  });

  const updateTheme = useCallback((updates) => {
    setCustomization((prev) => {
      const next = { ...prev, theme: { ...prev.theme, ...updates } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const updateAnimations = useCallback((updates) => {
    setCustomization((prev) => {
      const next = { ...prev, animations: { ...prev.animations, ...updates } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const updateLayout = useCallback((updates) => {
    setCustomization((prev) => {
      const next = { ...prev, layout: { ...prev.layout, ...updates } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const updateProfile = useCallback(async (updates) => {
    setCustomization((prev) => {
      const next = { ...prev, profile: { ...prev.profile, ...updates } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    // Also update backend if avatarUrl or bannerUrl is included
    if (updates.avatarUrl || updates.bannerUrl) {
      try {
        const token = getToken();
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            avatarUrl: updates.avatarUrl,
            bannerUrl: updates.bannerUrl,
          }),
        });

        if (!response.ok) {
          console.error("Failed to update profile on backend");
        }
      } catch (err) {
        console.error("Error updating profile on backend:", err);
      }
    }
  }, []);

  const updateNotifications = useCallback((updates) => {
    setCustomization((prev) => {
      const next = { ...prev, notifications: { ...prev.notifications, ...updates } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const updatePrivacy = useCallback((updates) => {
    setCustomization((prev) => {
      const next = { ...prev, privacy: { ...prev.privacy, ...updates } };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const resetCustomization = useCallback(() => {
    setCustomization(defaultCustomization);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultCustomization));
    } catch {}
  }, []);

  const applyThemeToCSS = useCallback(() => {
    const root = document.documentElement;
    const { theme } = customization;
    
    root.style.setProperty("--accent", theme.primaryColor);
    root.style.setProperty("--accent-2", theme.secondaryColor);
    root.style.setProperty("--ok", theme.accentColor);
    
    root.setAttribute("data-theme", theme.darkMode ? "dark" : "light");
    root.setAttribute("data-reduce-motion", customization.animations.reducedMotion);
    
    const radiusMap = { none: "0px", small: "8px", medium: "16px", large: "24px" };
    root.style.setProperty("--border-radius", radiusMap[theme.borderRadius] || "16px");
  }, [customization]);

  useEffect(() => {
    applyThemeToCSS();
  }, [applyThemeToCSS]);

  return {
    customization,
    updateTheme,
    updateAnimations,
    updateLayout,
    updateProfile,
    updateNotifications,
    updatePrivacy,
    resetCustomization,
    applyThemeToCSS,
  };
}
