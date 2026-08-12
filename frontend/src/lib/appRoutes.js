const VIEW_PATHS = {
  chat: "/direct",
  groups: "/groups",
  servers: "/servers",
  friends: "/friends",
  calls: "/calls",
  activity: "/activity",
  play: "/play",
};

const APP_PREFIXES = ["/direct", "/groups", "/servers", "/friends", "/calls", "/activity", "/play", "/settings"];

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
    return { view: "servers", serverId: target || null };
  }
  if (section === "settings") return { view: "chat", settingsTab: target || "overview" };
  if (section === "friends" || section === "calls" || section === "activity" || section === "play") {
    return { view: section, settingsTab: null };
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

export function serverPath(server) {
  const id = typeof server === "string" ? server : server?.id;
  return id ? `/servers/${encodeURIComponent(id)}` : "/servers";
}

export function appPathForView(view) {
  return VIEW_PATHS[view] || "/direct";
}
