/**
 * Single source of truth for user profile fields (especially avatar + display name).
 * Always use normalizeUser() when storing user objects in state or localStorage.
 */

function cleanDisplayName(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

/** True when the user is Descall staff (DB flag or legacy username "admin"). */
export function isUserAdmin(user) {
  if (!user) return false;
  if (user.is_admin === true || user.isAdmin === true) return true;
  if (user.role === "admin") return true;
  return user.username === "admin";
}

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
  const displayName = cleanDisplayName(user.displayName ?? user.display_name ?? null);
  const admin = isUserAdmin(user);

  return {
    ...user,
    avatarUrl: avatarUrl || null,
    avatar_url: avatarUrl || null,
    avatarVersion,
    displayName,
    display_name: displayName,
    bio: user.bio || null,
    customStatus: user.customStatus || user.custom_status || null,
    bannerUrl: user.bannerUrl || user.banner_url || null,
    is_admin: admin,
    isAdmin: admin,
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
  return (
    cleanDisplayName(user.displayName ?? user.display_name) ||
    user.username ||
    "Unknown"
  );
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
 * Merge profile shards without letting null avatar/banner/bio/displayName wipe known values.
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
  const displayName = list
    .map((p) => cleanDisplayName(p.displayName ?? p.display_name))
    .find((v) => v);
  if (displayName) {
    out.displayName = displayName;
    out.display_name = displayName;
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
  if (list.some((p) => isUserAdmin(p))) {
    out.is_admin = true;
    out.isAdmin = true;
  }
  // Prefer the richest equipped cosmetic shard (profile/API > friends > message)
  for (const key of [
    "equippedAvatarFrame",
    "equippedBanner",
    "equippedBackground",
    "equippedTheme",
    "equippedBadge",
    "equippedTitle",
    "equippedNameEffect",
    "equippedAvatarEffect",
    "equippedChatBubble",
    "equippedPresenceFlare",
    "equippedProfileAura",
    "equippedSoundPack",
    "equippedTypingFlare",
    "equippedReactionBurst",
    "equippedCallOverlay",
  ]) {
    const hit = [...list].reverse().find((p) => p[key]);
    if (hit?.[key]) out[key] = hit[key];
  }
  return normalizeUser(out);
}

/** Apply a partial profile patch without wiping unspecified fields. */
export function patchUserProfile(user, patch = {}) {
  if (!user) return user;
  const next = { ...user };

  if ("avatarUrl" in patch || "avatar_url" in patch) {
    const a = patch.avatarUrl ?? patch.avatar_url;
    if (a) {
      next.avatarUrl = a;
      next.avatar_url = a;
    }
  }

  if ("displayName" in patch || "display_name" in patch) {
    const d = cleanDisplayName(patch.displayName ?? patch.display_name);
    next.displayName = d;
    next.display_name = d;
  }

  if ("bio" in patch && patch.bio !== undefined) next.bio = patch.bio;
  if ("customStatus" in patch || "custom_status" in patch) {
    next.customStatus = patch.customStatus ?? patch.custom_status ?? null;
    next.custom_status = next.customStatus;
  }
  if ("bannerUrl" in patch || "banner_url" in patch) {
    const b = patch.bannerUrl ?? patch.banner_url;
    if (b) {
      next.bannerUrl = b;
      next.banner_url = b;
    }
  }

  if ("is_admin" in patch || "isAdmin" in patch) {
    const admin = Boolean(patch.is_admin ?? patch.isAdmin);
    next.is_admin = admin;
    next.isAdmin = admin;
  }

  for (const key of [
    "equippedAvatarFrame",
    "equippedBanner",
    "equippedBackground",
    "equippedTheme",
    "equippedBadge",
    "equippedTitle",
    "equippedNameEffect",
    "equippedAvatarEffect",
    "equippedChatBubble",
    "equippedPresenceFlare",
    "equippedProfileAura",
    "equippedSoundPack",
    "equippedTypingFlare",
    "equippedReactionBurst",
    "equippedCallOverlay",
  ]) {
    if (key in patch && patch[key] !== undefined) {
      next[key] = patch[key];
    }
  }

  const version =
    patch.avatarVersion ?? patch.updated_at ?? patch.updatedAt ?? user.avatarVersion ?? Date.now();
  next.avatarVersion = version;
  next.updated_at =
    typeof version === "number" ? new Date(version).toISOString() : version || user.updated_at;

  return normalizeUser(next);
}

export function patchUserAvatar(user, avatarUrl, avatarVersion) {
  if (!user) return user;
  // Never wipe an existing photo with a null/empty patch (stale socket payloads).
  const nextAvatar =
    avatarUrl === undefined || avatarUrl === null || avatarUrl === ""
      ? user.avatarUrl || user.avatar_url || null
      : avatarUrl;
  return patchUserProfile(user, {
    avatarUrl: nextAvatar,
    avatarVersion: avatarVersion ?? user.avatarVersion ?? Date.now(),
    updated_at: avatarVersion ?? user.updated_at ?? new Date().toISOString(),
  });
}

/** Equipped shop cosmetics used on call tiles (frame, name effect, badge…). */
export function pickEquippedCosmetics(user) {
  if (!user) return {};
  const out = {};
  for (const key of [
    "equippedAvatarFrame",
    "equippedBadge",
    "equippedTitle",
    "equippedNameEffect",
    "equippedAvatarEffect",
    "equippedPresenceFlare",
    "equippedCallOverlay",
  ]) {
    if (user[key]) out[key] = user[key];
  }
  return out;
}

export function patchUserInList(list, userId, patchOrAvatarUrl, avatarVersion) {
  if (!Array.isArray(list)) return list;
  const patch =
    patchOrAvatarUrl && typeof patchOrAvatarUrl === "object" && !Array.isArray(patchOrAvatarUrl)
      ? patchOrAvatarUrl
      : { avatarUrl: patchOrAvatarUrl, avatarVersion };
  let changed = false;
  const next = list.map((item) => {
    if (item?.id !== userId) return item;
    changed = true;
    return patchUserProfile(item, patch);
  });
  return changed ? next : list;
}

function patchMessageUserFields(message, userId, patch) {
  const fromId = message.from?.id || message.sender?.id || message.sender_id;
  if (fromId !== userId) return message;
  const from = message.from ? patchUserProfile(message.from, patch) : message.from;
  const sender = message.sender ? patchUserProfile(message.sender, patch) : message.sender;
  return {
    ...message,
    from,
    sender,
    username: resolveDisplayName(from || sender) || message.username,
    displayName: from?.displayName || sender?.displayName || message.displayName,
    avatarUrl: from?.avatarUrl || sender?.avatarUrl || message.avatarUrl,
  };
}

export function patchDmMessagesAvatar(dmByUserId, userId, patchOrAvatarUrl, avatarVersion) {
  if (!dmByUserId || typeof dmByUserId !== "object") return dmByUserId;
  const patch =
    patchOrAvatarUrl && typeof patchOrAvatarUrl === "object" && !Array.isArray(patchOrAvatarUrl)
      ? patchOrAvatarUrl
      : { avatarUrl: patchOrAvatarUrl, avatarVersion };
  let any = false;
  const next = {};
  for (const [peerId, messages] of Object.entries(dmByUserId)) {
    if (!Array.isArray(messages)) {
      next[peerId] = messages;
      continue;
    }
    const patched = messages.map((m) => {
      const out = patchMessageUserFields(m, userId, patch);
      if (out !== m) any = true;
      return out;
    });
    next[peerId] = patched;
  }
  return any ? next : dmByUserId;
}

export function patchGroupMessagesAvatar(groupMessagesById, userId, patchOrAvatarUrl, avatarVersion) {
  if (!groupMessagesById || typeof groupMessagesById !== "object") return groupMessagesById;
  const patch =
    patchOrAvatarUrl && typeof patchOrAvatarUrl === "object" && !Array.isArray(patchOrAvatarUrl)
      ? patchOrAvatarUrl
      : { avatarUrl: patchOrAvatarUrl, avatarVersion };
  let any = false;
  const next = {};
  for (const [groupId, messages] of Object.entries(groupMessagesById)) {
    if (!Array.isArray(messages)) {
      next[groupId] = messages;
      continue;
    }
    const patched = messages.map((m) => {
      const out = patchMessageUserFields(m, userId, patch);
      if (out !== m) any = true;
      return out;
    });
    next[groupId] = patched;
  }
  return any ? next : groupMessagesById;
}
