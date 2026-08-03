/**
 * Riot / Valorant account helpers.
 * - RSO OAuth when RIOT_CLIENT_ID + RIOT_CLIENT_SECRET are set (Riot production approval required)
 * - Riot ID link (Name#TAG) via Henrik MMR API and/or Riot Account API
 */

const crypto = require("crypto");
const { VALORANT_RANKS, isValidRank } = require("./lfgConstants");

const RIOT_CLIENT_ID = process.env.RIOT_CLIENT_ID || "";
const RIOT_CLIENT_SECRET = process.env.RIOT_CLIENT_SECRET || "";
const RIOT_API_KEY = process.env.RIOT_API_KEY || "";
const HENRIK_API_KEY = process.env.HENRIK_API_KEY || "";
const RIOT_REDIRECT_URI =
  process.env.RIOT_REDIRECT_URI ||
  (process.env.PUBLIC_APP_URL
    ? `${String(process.env.PUBLIC_APP_URL).replace(/\/$/, "")}/api/riot/oauth/callback`
    : "");

/** Normalize Henrik / Riot rank strings to Descall LFG rank labels */
function normalizeRankTier(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
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
  return {
    linked: true,
    gameName: row.game_name,
    tagLine: row.tag_line,
    riotId: `${row.game_name}#${row.tag_line}`,
    region: row.region,
    rankTier: row.rank_tier || null,
    rank: row.rank_tier || null,
    rankRr: row.rank_rr ?? null,
    verified: Boolean(row.rank_verified),
    linkMethod: row.link_method,
    linkedAt: row.linked_at,
    rankUpdatedAt: row.rank_updated_at,
  };
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

/** Rank + account via Henrik (best practical Valorant rank source without VAL prod key) */
async function fetchHenrikMmr(region, gameName, tagLine) {
  const headers = {};
  if (HENRIK_API_KEY) headers.Authorization = HENRIK_API_KEY;
  const url = `https://api.henrikdev.xyz/valorant/v2/mmr/${encodeURIComponent(region)}/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const { ok, status, body } = await fetchJson(url, headers);
  if (!ok) {
    const msg = body?.errors?.[0]?.message || body?.message || `Rank lookup failed (${status})`;
    const err = new Error(msg);
    err.status = status;
    throw err;
  }
  const data = body?.data || body;
  const current = data?.current_data || {};
  const rank =
    current.currenttierpatched ||
    current.currenttier_patched ||
    data?.currenttierpatched ||
    null;
  const rr =
    typeof current.ranking_in_tier === "number"
      ? current.ranking_in_tier
      : typeof data?.ranking_in_tier === "number"
        ? data.ranking_in_tier
        : null;
  return {
    gameName: data?.name || gameName,
    tagLine: data?.tag || tagLine,
    puuid: data?.puuid || null,
    rankTier: normalizeRankTier(rank),
    rankRr: rr,
    region,
  };
}

async function fetchHenrikAccount(gameName, tagLine) {
  const headers = {};
  if (HENRIK_API_KEY) headers.Authorization = HENRIK_API_KEY;
  const url = `https://api.henrikdev.xyz/valorant/v1/account/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const { ok, body } = await fetchJson(url, headers);
  if (!ok) return null;
  const data = body?.data || body;
  return {
    puuid: data?.puuid || null,
    gameName: data?.name || gameName,
    tagLine: data?.tag || tagLine,
    region: data?.region || null,
  };
}

/**
 * Resolve + refresh Valorant card for Name#TAG
 */
async function resolveValorantLink({ gameName, tagLine, region = "eu" }) {
  let account = await lookupRiotAccount(gameName, tagLine);
  if (!account) {
    account = await fetchHenrikAccount(gameName, tagLine);
  }
  if (!account) {
    // Still try MMR — Henrik often works with just name/tag
    account = { gameName, tagLine, puuid: null };
  }

  const mmrRegion = region || account.region || "eu";
  let mmr = null;
  try {
    mmr = await fetchHenrikMmr(mmrRegion, account.gameName || gameName, account.tagLine || tagLine);
  } catch (err) {
    // Account may exist but unranked / API limited
    console.warn("[Riot] MMR lookup:", err.message);
  }

  return {
    puuid: mmr?.puuid || account.puuid || null,
    gameName: mmr?.gameName || account.gameName || gameName,
    tagLine: mmr?.tagLine || account.tagLine || tagLine,
    region: mmrRegion,
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
  parseRiotId,
  publicRiotCard,
  resolveValorantLink,
  createOAuthState,
  verifyOAuthState,
  buildRsoAuthorizeUrl,
  exchangeRsoCode,
  fetchRsoAccount,
  normalizeRankTier,
  RIOT_REDIRECT_URI,
};
