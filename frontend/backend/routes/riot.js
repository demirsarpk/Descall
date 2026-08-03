const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const {
  rsoEnabled,
  parseRiotId,
  publicRiotCard,
  resolveValorantLink,
  createOAuthState,
  verifyOAuthState,
  buildRsoAuthorizeUrl,
  exchangeRsoCode,
  fetchRsoAccount,
} = require("../lib/riotLink");

const router = express.Router();

const VALID_REGIONS = new Set(["eu", "na", "ap", "kr", "latam", "br"]);

async function getLink(userId) {
  const { data } = await supabase
    .from("user_riot_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

async function upsertLink(userId, fields) {
  const row = {
    user_id: userId,
    puuid: fields.puuid || null,
    game_name: fields.gameName,
    tag_line: fields.tagLine,
    region: fields.region || "eu",
    rank_tier: fields.rankTier || null,
    rank_rr: fields.rankRr ?? null,
    rank_verified: Boolean(fields.verified),
    link_method: fields.linkMethod || "riot_id",
    card_public: fields.cardPublic !== false,
    access_token: fields.accessToken || null,
    refresh_token: fields.refreshToken || null,
    token_expires_at: fields.tokenExpiresAt || null,
    rank_updated_at: fields.rankTier ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_riot_accounts")
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    const err = new Error(
      error.message?.includes("user_riot_accounts")
        ? "Riot link table missing — run 20260803_riot_account_link.sql"
        : error.message || "Failed to save Riot link"
    );
    err.code = error.code;
    throw err;
  }
  return data;
}

function appOrigin(req) {
  return (
    process.env.PUBLIC_APP_URL ||
    req.get("origin") ||
    `${req.protocol}://${req.get("host")}` ||
    "https://des-call.onrender.com"
  ).replace(/\/$/, "");
}

// GET /riot/status
router.get("/status", requireAuth, async (req, res) => {
  try {
    const link = await getLink(req.user.id);
    return res.json({
      rsoEnabled: rsoEnabled(),
      linked: Boolean(link),
      valorant: publicRiotCard(link),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to load Riot status" });
  }
});

// GET /riot/users/:userId — public card for profiles
router.get("/users/:userId", requireAuth, async (req, res) => {
  try {
    const { data } = await supabase
      .from("user_riot_accounts")
      .select("*")
      .eq("user_id", req.params.userId)
      .maybeSingle();
    if (!data || data.card_public === false) {
      return res.json({ valorant: null });
    }
    return res.json({ valorant: publicRiotCard(data) });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load Valorant card" });
  }
});

// POST /riot/link — link by Name#TAG (works without RSO approval)
router.post("/link", requireAuth, async (req, res) => {
  try {
    const { riotId, region = "eu" } = req.body || {};
    const parsed = parseRiotId(riotId);
    if (!parsed) {
      return res.status(400).json({ error: "Use Riot ID format: Name#TAG" });
    }
    const reg = String(region || "eu").toLowerCase();
    if (!VALID_REGIONS.has(reg)) {
      return res.status(400).json({ error: "Invalid region" });
    }

    // Unique name#tag across users
    const { data: taken } = await supabase
      .from("user_riot_accounts")
      .select("user_id, game_name, tag_line")
      .ilike("game_name", parsed.gameName)
      .ilike("tag_line", parsed.tagLine)
      .maybeSingle();
    if (taken && taken.user_id !== req.user.id) {
      return res.status(409).json({ error: "This Riot ID is already linked to another Descall account" });
    }

    const resolved = await resolveValorantLink({
      gameName: parsed.gameName,
      tagLine: parsed.tagLine,
      region: reg,
    });

    const saved = await upsertLink(req.user.id, {
      ...resolved,
      linkMethod: "riot_id",
      cardPublic: true,
    });

    return res.json({
      success: true,
      valorant: publicRiotCard(saved),
    });
  } catch (err) {
    console.error("[Riot] link:", err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to link Riot account" });
  }
});

// POST /riot/refresh — refresh rank for linked account
router.post("/refresh", requireAuth, async (req, res) => {
  try {
    const link = await getLink(req.user.id);
    if (!link) return res.status(404).json({ error: "No Riot account linked" });

    const resolved = await resolveValorantLink({
      gameName: link.game_name,
      tagLine: link.tag_line,
      region: link.region || "eu",
    });

    const saved = await upsertLink(req.user.id, {
      ...resolved,
      linkMethod: link.link_method || "riot_id",
      accessToken: link.access_token,
      refreshToken: link.refresh_token,
      tokenExpiresAt: link.token_expires_at,
      cardPublic: link.card_public !== false,
    });

    return res.json({ success: true, valorant: publicRiotCard(saved) });
  } catch (err) {
    console.error("[Riot] refresh:", err);
    return res.status(500).json({ error: err.message || "Failed to refresh rank" });
  }
});

// DELETE /riot/link
router.delete("/link", requireAuth, async (req, res) => {
  try {
    await supabase.from("user_riot_accounts").delete().eq("user_id", req.user.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to unlink" });
  }
});

// GET /riot/oauth/start
router.get("/oauth/start", requireAuth, (req, res) => {
  if (!rsoEnabled()) {
    return res.status(503).json({
      error:
        "Riot Sign-On is not configured yet. Link with Name#TAG for now, or set RIOT_CLIENT_ID / RIOT_CLIENT_SECRET after Riot production approval.",
      rsoEnabled: false,
    });
  }
  const state = createOAuthState(req.user.id);
  // Prefer JSON { url } for SPA; also support redirect
  if (req.query.redirect === "1") {
    return res.redirect(buildRsoAuthorizeUrl(state));
  }
  return res.json({ url: buildRsoAuthorizeUrl(state), rsoEnabled: true });
});

// GET /riot/oauth/callback — browser lands here after Riot login
router.get("/oauth/callback", async (req, res) => {
  const origin = appOrigin(req);
  try {
    const { code, state, error, error_description: errDesc } = req.query;
    if (error) {
      return res.redirect(`${origin}/?riot_link=error&reason=${encodeURIComponent(errDesc || error)}`);
    }
    const parsed = verifyOAuthState(state);
    if (!parsed?.userId || !code) {
      return res.redirect(`${origin}/?riot_link=error&reason=invalid_state`);
    }

    const tokens = await exchangeRsoCode(String(code));
    const account = await fetchRsoAccount(tokens.access_token);

    let mmr = null;
    try {
      mmr = await resolveValorantLink({
        gameName: account.gameName,
        tagLine: account.tagLine,
        region: "eu",
      });
    } catch {
      mmr = {
        gameName: account.gameName,
        tagLine: account.tagLine,
        puuid: account.puuid,
        region: "eu",
        rankTier: null,
        rankRr: null,
        verified: true,
      };
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
      : null;

    await upsertLink(parsed.userId, {
      puuid: account.puuid || mmr.puuid,
      gameName: account.gameName || mmr.gameName,
      tagLine: account.tagLine || mmr.tagLine,
      region: mmr.region || "eu",
      rankTier: mmr.rankTier,
      rankRr: mmr.rankRr,
      verified: true,
      linkMethod: "rso",
      accessToken: tokens.access_token || null,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: expiresAt,
      cardPublic: true,
    });

    return res.redirect(`${origin}/?riot_link=success`);
  } catch (err) {
    console.error("[Riot] OAuth callback:", err);
    return res.redirect(
      `${origin}/?riot_link=error&reason=${encodeURIComponent(err.message || "oauth_failed")}`
    );
  }
});

module.exports = router;
