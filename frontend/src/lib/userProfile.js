/**
 * Single source of truth for user profile fields (especially avatar).
 * Always use normalizeUser() when storing user objects in state or localStorage.
 */

export function normalizeUser(user) {
  if (!user) return null;
  const avatarUrl = user.avatarUrl || user.avatar_url || null;
  const avatarVersion =
    user.avatarVersion ??
    user.avatar_version ??
    user.avatarUpdatedAt ??
    user.updated_at ??
    user.updatedAt ??
    null;

  return {
    ...user,
    avatarUrl: avatarUrl || null,
    avatar_url: avatarUrl || null,
    avatarVersion,
    displayName: user.displayName || user.display_name || null,
    bio: user.bio || null,
    customStatus: user.customStatus || user.custom_status || null,
    bannerUrl: user.bannerUrl || user.banner_url || null,
  };
}

export function resolveAvatarUrl(user) {
  if (!user) return null;
  const url = user.avatarUrl || user.avatar_url || user.initiatorAvatarUrl;
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const version =
    user.avatarVersion ??
    user.avatar_version ??
    user.avatarUpdatedAt ??
    user.updated_at ??
    user.updatedAt;

  if (!version) return trimmed;

  const v = typeof version === "number" ? version : new Date(version).getTime();
  if (!v || Number.isNaN(v)) return trimmed;

  // Avoid stacking cache-busters if URL was already resolved.
  if (/[?&]v=\d+/.test(trimmed)) return trimmed;

  const sep = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${sep}v=${v}`;
}

export function resolveDisplayName(user) {
  if (!user) return "Unknown";
  return user.displayName || user.display_name || user.username || "Unknown";
}

/** First non-empty avatar URL from a list of user-like objects / strings. */
export function pickAvatarUrl(...sources) {
  for (const src of sources) {
    if (!src) continue;
    if (typeof src === "string") {
      const t = src.trim();
      if (t) return t;
      continue;
    }
    const url = src.avatarUrl || src.avatar_url || src.initiatorAvatarUrl;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return null;
}

/**
 * Merge profile shards without letting null avatar/banner/bio wipe known values.
 */
export function mergeUserProfiles(...parts) {
  const list = parts.filter(Boolean);
  if (!list.length) return null;
  const out = Object.assign({}, ...list);
  const avatarUrl = pickAvatarUrl(...list);
  if (avatarUrl) {
    out.avatarUrl = avatarUrl;
    out.avatar_url = avatarUrl;
  } else {
    out.avatarUrl = null;
    out.avatar_url = null;
  }
  const banner = list.map((p) => p.bannerUrl || p.banner_url).find((v) => typeof v === "string" && v.trim());
  if (banner) {
    out.bannerUrl = banner;
    out.banner_url = banner;
  }
  const bio = list.map((p) => p.bio).find((v) => typeof v === "string" && v.trim());
  if (bio) out.bio = bio;
  const customStatus = list
    .map((p) => p.customStatus || p.custom_status)
    .find((v) => typeof v === "string" && v.trim());
  if (customStatus) {
    out.customStatus = customStatus;
    out.custom_status = customStatus;
  }
  return normalizeUser(out);
}

export function patchUserAvatar(user, avatarUrl, avatarVersion) {
  if (!user) return user;
  // Never wipe an existing photo with a null/empty patch (stale socket payloads).
  const nextAvatar =
    avatarUrl === undefined || avatarUrl === null || avatarUrl === ""
      ? user.avatarUrl || user.avatar_url || null
      : avatarUrl;
  return normalizeUser({
    ...user,
    avatarUrl: nextAvatar,
    avatar_url: nextAvatar,
    avatarVersion: avatarVersion ?? user.avatarVersion ?? Date.now(),
    updated_at: avatarVersion ?? user.updated_at ?? new Date().toISOString(),
  });
}

export function patchUserInList(list, userId, avatarUrl, avatarVersion) {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((item) => {
    if (item?.id !== userId) return item;
    changed = true;
    return patchUserAvatar(item, avatarUrl, avatarVersion);
  });
  return changed ? next : list;
}

export function patchDmMessagesAvatar(dmByUserId, userId, avatarUrl, avatarVersion) {
  if (!dmByUserId || typeof dmByUserId !== "object") return dmByUserId;
  let any = false;
  const next = {};
  for (const [peerId, messages] of Object.entries(dmByUserId)) {
    if (!Array.isArray(messages)) {
      next[peerId] = messages;
      continue;
    }
    const patched = messages.map((m) => {
      const fromId = m.from?.id || m.sender?.id || m.sender_id;
      if (fromId !== userId) return m;
      any = true;
      return {
        ...m,
        from: m.from ? patchUserAvatar(m.from, avatarUrl, avatarVersion) : m.from,
        sender: m.sender ? patchUserAvatar(m.sender, avatarUrl, avatarVersion) : m.sender,
        avatarUrl: avatarUrl || m.avatarUrl,
      };
    });
    next[peerId] = patched;
  }
  return any ? next : dmByUserId;
}

export function patchGroupMessagesAvatar(groupMessagesById, userId, avatarUrl, avatarVersion) {
  if (!groupMessagesById || typeof groupMessagesById !== "object") return groupMessagesById;
  let any = false;
  const next = {};
  for (const [groupId, messages] of Object.entries(groupMessagesById)) {
    if (!Array.isArray(messages)) {
      next[groupId] = messages;
      continue;
    }
    const patched = messages.map((m) => {
      const fromId = m.from?.id || m.sender?.id || m.sender_id;
      if (fromId !== userId) return m;
      any = true;
      return {
        ...m,
        from: m.from ? patchUserAvatar(m.from, avatarUrl, avatarVersion) : m.from,
        sender: m.sender ? patchUserAvatar(m.sender, avatarUrl, avatarVersion) : m.sender,
        avatarUrl: avatarUrl || m.avatarUrl,
      };
    });
    next[groupId] = patched;
  }
  return any ? next : groupMessagesById;
}
