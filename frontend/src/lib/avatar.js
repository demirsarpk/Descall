/**
 * Normalize avatar URL from user objects that may use camelCase or snake_case.
 */
export function resolveAvatarUrl(user) {
  if (!user) return null;
  const url = user.avatarUrl || user.avatar_url || user.initiatorAvatarUrl;
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDisplayName(user) {
  if (!user) return "Unknown";
  return user.displayName || user.display_name || user.username || "Unknown";
}
