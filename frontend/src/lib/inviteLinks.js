/**
 * Detect Descall invite URLs in chat text (group / server / friend).
 */

const HOST_RE =
  /(?:^|\.)descall\.(?:com|vercel\.app)$|^des-call\.onrender\.com$|^(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;
const CODE_RE = "[A-Za-z0-9_-]{4,32}";
const VANITY_SLUG_RE = "[a-z0-9][a-z0-9-]{2,31}";
const USERNAME_RE = "[A-Za-z0-9_.-]{2,24}";

/** Full URLs + protocol-less descall.com / www.descall.com invite paths */
const URL_FIND_RE =
  /(?:https?:\/\/|(?:www\.)?descall\.(?:com|vercel\.app)\/|des-call\.onrender\.com\/)[^\s<>"')\]]+/gi;

function isDescallHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  if (!host) return false;
  if (HOST_RE.test(host)) return true;
  try {
    if (typeof window !== "undefined" && window.location?.hostname) {
      return host === String(window.location.hostname).toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return false;
}

function stripTrailingPunctuation(raw) {
  return String(raw || "").replace(/[.,;:!?'")\]]+$/g, "");
}

/**
 * @typedef {'group'|'server'|'friend'} InviteKind
 * @typedef {{ kind: InviteKind, code: string, url: string, username?: string }} DescallInviteRef
 */

/**
 * @param {string} href
 * @returns {DescallInviteRef|null}
 */
export function parseDescallInviteUrl(href) {
  let cleaned = stripTrailingPunctuation(href);
  if (!cleaned) return null;
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned.replace(/^\/\//, "")}`;
  }
  let url;
  try {
    url = new URL(cleaned);
  } catch {
    return null;
  }
  if (!/^https?:$/i.test(url.protocol)) return null;
  if (!isDescallHost(url.hostname)) return null;

  const path = url.pathname || "";

  // Server vanity: /s/:slug
  let m = path.match(new RegExp(`^/s/(${VANITY_SLUG_RE})/?$`, "i"));
  if (m) {
    const slug = m[1].toLowerCase();
    return { kind: "server", code: `vanity:${slug}`, vanitySlug: slug, url: cleaned };
  }

  // Server: /servers/join/:code  or  /invite/s/:code
  m = path.match(new RegExp(`^/servers/join/(${CODE_RE})/?$`, "i"));
  if (m) {
    return { kind: "server", code: m[1], url: cleaned };
  }
  m = path.match(new RegExp(`^/invite/s/(${CODE_RE})/?$`, "i"));
  if (m) {
    return { kind: "server", code: m[1], url: cleaned };
  }

  // Group: /invite/:code  or  /i/:code  or  ?invite= / ?i=
  m = path.match(new RegExp(`^/(?:invite|i)/(${CODE_RE})/?$`, "i"));
  if (m) {
    return { kind: "group", code: m[1], url: cleaned };
  }
  const qInvite = url.searchParams.get("invite") || url.searchParams.get("i");
  if (qInvite && new RegExp(`^${CODE_RE}$`, "i").test(qInvite)) {
    return { kind: "group", code: qInvite, url: cleaned };
  }

  // Friend: /register?ref=username  or  /?ref=
  const ref = url.searchParams.get("ref") || url.searchParams.get("inviteBy");
  if (ref && new RegExp(`^${USERNAME_RE}$`).test(ref.replace(/^@/, ""))) {
    const username = ref.replace(/^@/, "");
    return { kind: "friend", code: username.toLowerCase(), username, url: cleaned };
  }

  return null;
}

/**
 * @param {string} text
 * @returns {DescallInviteRef[]}
 */
export function extractDescallInvites(text) {
  if (!text || typeof text !== "string") return [];
  const found = [];
  const seen = new Set();
  const re = new RegExp(URL_FIND_RE.source, "gi");
  let match;
  while ((match = re.exec(text)) !== null) {
    const parsed = parseDescallInviteUrl(match[0]);
    if (!parsed) continue;
    const key = `${parsed.kind}:${parsed.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(parsed);
  }
  return found;
}

export function isDescallInviteUrl(href) {
  return Boolean(parseDescallInviteUrl(href));
}

export function isVanityServerInvite(inviteOrCode) {
  const code = typeof inviteOrCode === "string" ? inviteOrCode : inviteOrCode?.code;
  return String(code || "").toLowerCase().startsWith("vanity:");
}

export function vanitySlugFromInviteCode(code) {
  return String(code || "")
    .replace(/^vanity:/i, "")
    .toLowerCase();
}

/** In-memory preview cache so repeated links don't refetch. */
const previewCache = new Map();

export function getCachedInvitePreview(kind, code) {
  return previewCache.get(`${kind}:${code}`) || null;
}

export function setCachedInvitePreview(kind, code, data) {
  previewCache.set(`${kind}:${code}`, { data, at: Date.now() });
}
