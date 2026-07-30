/** Display tag for landing page / UI (always leading `v`). */
export function formatReleaseLabel(tagName) {
  if (!tagName) return null;
  const raw = String(tagName).trim();
  if (!raw) return null;
  return raw.startsWith("v") ? raw : `v${raw}`;
}

/** Semver without `v` prefix. */
export function parseSemverFromTag(tagName) {
  if (!tagName) return null;
  return String(tagName).trim().replace(/^v/i, "") || null;
}
