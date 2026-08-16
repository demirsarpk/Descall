import {
  MessageSquare,
  Users,
  UserPlus,
  Phone,
  Zap,
  Crosshair,
  Settings,
  Plus,
  Shield,
  Server,
  Sparkles,
} from "lucide-react";

/** Shared primary destinations for the left vertical nav rail. */
export const MAIN_NAV_IDS = [
  "chat",
  "groups",
  "servers",
  "play",
  "dimaai",
  "friends",
  "activity",
  "calls",
];

/** Icon stroke used everywhere in primary navigation. */
export const NAV_ICON_STROKE = 1.75;
export const NAV_ICON_SIZE = 22;

export function buildMainNavItems(t) {
  return [
    { id: "chat", icon: MessageSquare, label: t("nav.chats"), group: "main" },
    { id: "groups", icon: Users, label: t("nav.groups"), group: "main" },
    { id: "servers", icon: Server, label: t("nav.servers"), group: "main" },
    { id: "play", icon: Crosshair, label: t("nav.play"), group: "main" },
    { id: "dimaai", icon: Sparkles, label: t("nav.dimaai"), group: "main" },
    { id: "friends", icon: UserPlus, label: t("nav.friends"), group: "main" },
    { id: "activity", icon: Zap, label: t("Activity"), group: "main" },
    { id: "calls", icon: Phone, label: t("nav.calls"), group: "main" },
  ];
}

export function buildToolNavItems(t, { isAdmin = false } = {}) {
  const items = [
    { id: "add", icon: Plus, label: t("Add New"), group: "tools", action: "add" },
    { id: "settings", icon: Settings, label: t("settings.title"), group: "account", action: "settings" },
  ];
  if (isAdmin) {
    items.push({
      id: "admin",
      icon: Shield,
      label: t("admin.title"),
      group: "account",
      action: "admin",
    });
  }
  return items;
}
