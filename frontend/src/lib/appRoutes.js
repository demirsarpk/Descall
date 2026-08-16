const VIEW_PATHS = {
  chat: "/direct",
  groups: "/groups",
  servers: "/servers",
  friends: "/friends",
  calls: "/calls",
  activity: "/activity",
  play: "/play",
  dimaai: "/dimaai",
};

const APP_PREFIXES = ["/direct", "/groups", "/servers", "/friends", "/calls", "/activity", "/play", "/dimaai", "/settings"];

export function isAuthenticatedAppPath(pathname = "/") {
  return APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function parseAppRoute(pathname = "/") {
  const segments = pathname.split("/").filter(Boolean).map((value) => decodeURIComponent(value));
  const [section, target, extra] = segments;

  if (section === "direct") {
    return { view: "chat", username: target || null, call: extra === "call" ? segments[3] || null : null };
  }
  if (section === "groups") {
    return { view: "groups", groupId: target || null, joinCall: extra === "call" };
  }
  if (section === "servers") {
    return {
      view: "servers",
      serverId: target || null,
      channelId: extra && extra !== "call" ? extra : null,
    };
  }
  if (section === "settings") return { view: "chat", settingsTab: target || "overview" };
  if (section === "friends" || section === "calls" || section === "activity" || section === "play") {
    return { view: section, settingsTab: null };
  }
  if (section === "dimaai") {
    return { view: "dimaai", conversationId: target || null, settingsTab: null };
  }
  return { view: "chat", unknown: true };
}

export function directPath(user) {
  const username = typeof user === "string" ? user : user?.username;
  return username ? `/direct/${encodeURIComponent(username)}` : "/direct";
}

export function groupPath(group) {
  const id = typeof group === "string" ? group : group?.id;
  return id ? `/groups/${encodeURIComponent(id)}` : "/groups";
}

export function serverPath(server, channel) {
  const id = typeof server === "string" ? server : server?.id;
  if (!id) return "/servers";
  const channelId = typeof channel === "string" ? channel : channel?.id;
  if (channelId) return `/servers/${encodeURIComponent(id)}/${encodeURIComponent(channelId)}`;
  return `/servers/${encodeURIComponent(id)}`;
}

export function appPathForView(view) {
  return VIEW_PATHS[view] || "/direct";
}
