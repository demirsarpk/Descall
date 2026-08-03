/**
 * Riot / Valorant account helpers.
 * Real competitive rank is fetched via HenrikDev (requires HENRIK_API_KEY).
 * Users link with Name#TAG only — rank/nick shown only after a successful link.
 */

const crypto = require("crypto");
const { VALORANT_RANKS, isValidRank } = require("./lfgConstants");

const RIOT_CLIENT_ID = process.env.RIOT_CLIENT_ID || "";
const RIOT_CLIENT_SECRET = process.env.RIOT_CLIENT_SECRET || "";
const RIOT_API_KEY = process.env.RIOT_API_KEY || "";
const HENRIK_API_KEY = String(process.env.HENRIK_API_KEY || "").trim();
const RIOT_REDIRECT_URI =
  process.env.RIOT_REDIRECT_URI ||
  (process.env.PUBLIC_APP_URL
    ? `${String(process.env.PUBLIC_APP_URL).replace(/\/$/, "")}/api/riot/oauth/callback`
    : "");

const HENRIK_BASE = "https://api.henrikdev.xyz";
const HENRIK_REGIONS = ["eu", "na", "ap", "kr", "latam", "br"];

/** Map Descall / LFG region ids → Henrik affinity */
function toHenrikRegion(region) {
  const r = String(region || "eu").toLowerCase();
  if (r === "tr" || r === "europe" || r === "euw" || r === "eune") return "eu";
  if (HENRIK_REGIONS.includes(r)) return r;
  return "eu";
}

function henrikConfigured() {
  return Boolean(HENRIK_API_KEY);
}

function henrikHeaders() {
  // Henrik accepts the raw key in Authorization (also works as Bearer)
  return {
    Authorization: HENRIK_API_KEY,
    Accept: "application/json",
  };
}

function withApiKey(url) {
  // Twitch-bot style fallback also supported by Henrik
  if (!HENRIK_API_KEY) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}api_key=${encodeURIComponent(HENRIK_API_KEY)}`;
}

/** Normalize Henrik / Riot rank strings to Descall LFG rank labels */
function normalizeRankTier(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && raw.name) return normalizeRankTier(raw.name);
  let s = String(raw).trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (/^(unranked|unrated|none|n\/a)$/i.test(s)) return null;
  if (/^radiant$/i.test(s)) return "Radiant";
  const m = s.match(/^([A-Za-z]+)\s*(III|II|I|[1-3])$/i);
  if (m) {
    const tier = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    const divMap = { i: "1", ii: "2", iii: "3", "1": "1", "2": "2", "3": "3" };
    const div = divMap[m[2].toLowerCase()] || m[2];
    const candidate = `${tier} ${div}`;
    if (isValidRank(candidate)) return candidate;
  }
  const titled = s.replace(/\b\w/g, (c) => c.toUpperCase());
  if (isValidRank(titled)) return titled;
  return VALORANT_RANKS.find((r) => r.toLowerCase() === s.toLowerCase()) || s;
}

function rsoEnabled() {
  return Boolean(RIOT_CLIENT_ID && RIOT_CLIENT_SECRET && RIOT_REDIRECT_URI);
}

function parseRiotId(input) {
  const raw = String(input || "").trim();
  const m = raw.match(/^(.+?)#([A-Za-z0-9]{2,10})$/);
  if (!m) return null;
  return { gameName: m[1].trim(), tagLine: m[2].trim() };
}

function publicRiotCard(row) {
  if (!row) return null;
  // Only expose card when a Name#TAG (or RSO) link exists
  if (!row.game_name || !row.tag_line) return null;
  const rankTier = row.rank_tier || null;
  return {
    linked: true,
    gameName: row.game_name,
    tagLine: row.tag_line,
    riotId: `${row.game_name}#${row.tag_line}`,
    region: row.region,
    rankTier,
    rank: rankTier,
    rankRr: row.rank_rr ?? null,
    verified: Boolean(row.rank_verified),
    linkMethod: row.link_method,
    linkedAt: row.linked_at,
    rankUpdatedAt: row.rank_updated_at,
  };
}

function apiError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** Verify Name#TAG exists via Riot Account-v1 (needs RIOT_API_KEY) */
async function lookupRiotAccount(gameName, tagLine) {
  if (!RIOT_API_KEY) return null;
  const clusters = ["europe", "americas", "asia"];
  for (const cluster of clusters) {
    const url = `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    const { ok, body } = await fetchJson(url, { "X-Riot-Token": RIOT_API_KEY });
    if (ok && body?.puuid) {
      return {
        puuid: body.puuid,
        gameName: body.gameName || gameName,
        tagLine: body.tagLine || tagLine,
      };
    }
  }
  return null;
}

async function fetchHenrikAccount(gameName, tagLine) {
  if (!HENRIK_API_KEY) return null;
  const url = withApiKey(
    `${HENRIK_BASE}/valorant/v1/account/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
  const { ok, status, body } = await fetchJson(url, henrikHeaders());
  if (status === 401 || status === 403) {
    throw apiError(
      "Valorant rank API key missing/invalid. Set HENRIK_API_KEY on the server.",
      503
    );
  }
  if (status === 404 || !ok) return null;
  const data = body?.data || body;
  if (!data?.name && !data?.puuid) return null;
  return {
    puuid: data?.puuid || null,
    gameName: data?.name || gameName,
    tagLine: data?.tag || tagLine,
    region: data?.region ? toHenrikRegion(data.region) : null,
  };
}

function parseHenrikV3Mmr(body, fallbackRegion) {
  const data = body?.data || body;
  const current = data?.current || {};
  const account = data?.account || {};
  const rank =
    normalizeRankTier(current?.tier?.name) ||
    normalizeRankTier(current?.tier) ||
    null;
  const rr = typeof current?.rr === "number" ? current.rr : null;
  return {
    gameName: account?.name || null,
    tagLine: account?.tag || null,
    puuid: account?.puuid || null,
    rankTier: rank,
    rankRr: rr,
    region: fallbackRegion,
  };
}

function parseHenrikV2Mmr(body, fallbackRegion) {
  const data = body?.data || body;
  const current = data?.current_data || {};
  const rank =
    normalizeRankTier(current.currenttierpatched) ||
    normalizeRankTier(current.currenttier_patched) ||
    normalizeRankTier(data?.currenttierpatched) ||
    null;
  const rr =
    typeof current.ranking_in_tier === "number"
      ? current.ranking_in_tier
      : typeof data?.ranking_in_tier === "number"
        ? data.ranking_in_tier
        : null;
  return {
    gameName: data?.name || null,
    tagLine: data?.tag || null,
    puuid: data?.puuid || null,
    rankTier: rank,
    rankRr: rr,
    region: fallbackRegion,
  };
}

async function fetchHenrikMmr(region, gameName, tagLine) {
  if (!HENRIK_API_KEY) {
    throw apiError(
      "Valorant rank API key missing. Set HENRIK_API_KEY on the server (HenrikDev dashboard).",
      503
    );
  }
  const affinity = toHenrikRegion(region);
  const name = encodeURIComponent(gameName);
  const tag = encodeURIComponent(tagLine);

  // Prefer v3 (current competitive tier + RR)
  const v3Url = withApiKey(`${HENRIK_BASE}/valorant/v3/mmr/${affinity}/pc/${name}/${tag}`);
  const v3 = await fetchJson(v3Url, henrikHeaders());
  if (v3.status === 401 || v3.status === 403) {
    throw apiError(
      "Valorant rank API unauthorized. Check HENRIK_API_KEY on Render.",
      503
    );
  }
  if (v3.ok) {
    return parseHenrikV3Mmr(v3.body, affinity);
  }

  // Fallback v2
  const v2Url = withApiKey(`${HENRIK_BASE}/valorant/v2/mmr/${affinity}/${name}/${tag}`);
  const v2 = await fetchJson(v2Url, henrikHeaders());
  if (v2.status === 401 || v2.status === 403) {
    throw apiError(
      "Valorant rank API unauthorized. Check HENRIK_API_KEY on Render.",
      503
    );
  }
  if (v2.ok) {
    return parseHenrikV2Mmr(v2.body, affinity);
  }

  if (v3.status === 404 || v2.status === 404) {
    // Account may exist but have no MMR yet — treat as unranked, not failure
    return {
      gameName,
      tagLine,
      puuid: null,
      rankTier: null,
      rankRr: null,
      region: affinity,
    };
  }

  const msg =
    v3.body?.errors?.[0]?.message ||
    v2.body?.errors?.[0]?.message ||
    `Rank lookup failed (${v3.status || v2.status})`;
  throw apiError(msg, v3.status || v2.status || 502);
}

/**
 * Resolve real Valorant card for Name#TAG.
 * Requires HENRIK_API_KEY. Fails if the Riot ID does not exist.
 */
async function resolveValorantLink({ gameName, tagLine, region = "eu" }) {
  if (!HENRIK_API_KEY && !RIOT_API_KEY) {
    throw apiError(
      "Rank lookup is not configured. Add HENRIK_API_KEY (free at https://api.henrikdev.xyz/dashboard/) to Render env.",
      503
    );
  }

  let account = null;
  try {
    account = await fetchHenrikAccount(gameName, tagLine);
  } catch (err) {
    if (err.status === 503) throw err;
    console.warn("[Riot] Henrik account:", err.message);
  }
  if (!account) {
    account = await lookupRiotAccount(gameName, tagLine);
  }
  if (!account) {
    throw apiError(
      `Riot ID not found: ${gameName}#${tagLine}. Check spelling (Name#TAG) and try again.`,
      404
    );
  }

  const preferred = toHenrikRegion(account.region || region);
  const tryRegions = [preferred, ...HENRIK_REGIONS.filter((r) => r !== preferred)];

  let mmr = null;
  let lastErr = null;
  for (const reg of tryRegions) {
    try {
      mmr = await fetchHenrikMmr(reg, account.gameName || gameName, account.tagLine || tagLine);
      // Stop when we got a real rank, or same region returned unranked after account match
      if (mmr?.rankTier || reg === preferred) break;
    } catch (err) {
      lastErr = err;
      if (err.status === 503) throw err;
      console.warn("[Riot] MMR lookup:", reg, err.message);
    }
  }

  if (!mmr && lastErr) throw lastErr;

  return {
    puuid: mmr?.puuid || account.puuid || null,
    gameName: mmr?.gameName || account.gameName || gameName,
    tagLine: mmr?.tagLine || account.tagLine || tagLine,
    region: mmr?.region || preferred,
    rankTier: mmr?.rankTier || null,
    rankRr: mmr?.rankRr ?? null,
    verified: Boolean(account.puuid || mmr?.puuid),
  };
}

function createOAuthState(userId) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = Buffer.from(JSON.stringify({ userId, nonce, t: Date.now() })).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "descall-riot")
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

function verifyOAuthState(state) {
  const [payload, sig] = String(state || "").split(".");
  if (!payload || !sig) return null;
  const expect = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "descall-riot")
    .update(payload)
    .digest("base64url");
  if (sig !== expect) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.userId || Date.now() - (data.t || 0) > 15 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

function buildRsoAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: RIOT_CLIENT_ID,
    redirect_uri: RIOT_REDIRECT_URI,
    response_type: "code",
    scope: "openid offline_access",
    state,
  });
  return `https://auth.riotgames.com/authorize?${params}`;
}

async function exchangeRsoCode(code) {
  const basic = Buffer.from(`${RIOT_CLIENT_ID}:${RIOT_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: RIOT_REDIRECT_URI,
  });
  const res = await fetch("https://auth.riotgames.com/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error_description || json?.error || "Riot token exchange failed");
  }
  return json;
}

async function fetchRsoAccount(accessToken) {
  const clusters = ["europe", "americas", "asia"];
  for (const cluster of clusters) {
    const { ok, body } = await fetchJson(
      `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/me`,
      { Authorization: `Bearer ${accessToken}` }
    );
    if (ok && body?.puuid) {
      return {
        puuid: body.puuid,
        gameName: body.gameName,
        tagLine: body.tagLine,
      };
    }
  }
  throw new Error("Could not load Riot account from RSO token");
}

module.exports = {
  rsoEnabled,
  henrikConfigured,
  parseRiotId,
  publicRiotCard,
  resolveValorantLink,
  createOAuthState,
  verifyOAuthState,
  buildRsoAuthorizeUrl,
  exchangeRsoCode,
  fetchRsoAccount,
  normalizeRankTier,
  toHenrikRegion,
  RIOT_REDIRECT_URI,
};
