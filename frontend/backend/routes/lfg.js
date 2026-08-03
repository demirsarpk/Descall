const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { socketToUser } = require("../runtime/sharedState");
const {
  VALORANT_RANKS,
  VALORANT_MODES,
  VALORANT_REGIONS,
  VALORANT_ROLES,
  rankIndex,
  isValidRank,
  publicLobby,
} = require("../lib/lfgConstants");

const router = express.Router();
const LOBBY_TTL_MINUTES = 45;
const MAX_PARTY = 5;

function getUserSocketId(userId) {
  for (const [socketId, id] of socketToUser.entries()) {
    if (id === userId) return socketId;
  }
  return null;
}

function emitLfg(io, event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

async function fetchMembers(lobbyId) {
  const { data: rows } = await supabase
    .from("lfg_lobby_members")
    .select("user_id, rank_snapshot, role, joined_at")
    .eq("lobby_id", lobbyId)
    .order("joined_at", { ascending: true });
  if (!rows?.length) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: users } = await supabase
    .from("users")
    .select("id, username, avatar_url, display_name")
    .in("id", ids);
  const byId = Object.fromEntries((users || []).map((u) => [u.id, u]));

  return rows.map((r) => ({
    userId: r.user_id,
    rank: r.rank_snapshot,
    role: r.role,
    joinedAt: r.joined_at,
    username: byId[r.user_id]?.username || "Player",
    displayName: byId[r.user_id]?.display_name || null,
    avatarUrl: byId[r.user_id]?.avatar_url || null,
  }));
}

async function isLobbyMember(lobbyId, userId) {
  const { data } = await supabase
    .from("lfg_lobby_members")
    .select("user_id")
    .eq("lobby_id", lobbyId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

async function expireIfNeeded(lobby) {
  if (!lobby) return lobby;
  if (lobby.status !== "open") return lobby;
  if (lobby.expires_at && new Date(lobby.expires_at) < new Date()) {
    await supabase
      .from("lfg_lobbies")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", lobby.id)
      .eq("status", "open");
    return { ...lobby, status: "closed" };
  }
  return lobby;
}

// GET /lfg/meta
router.get("/meta", requireAuth, (_req, res) => {
  res.json({
    ranks: VALORANT_RANKS,
    modes: VALORANT_MODES,
    regions: VALORANT_REGIONS,
    roles: VALORANT_ROLES,
    maxParty: MAX_PARTY,
  });
});

// GET /lfg/lobbies
router.get("/lobbies", requireAuth, async (req, res) => {
  try {
    const mode = String(req.query.mode || "").trim();
    const region = String(req.query.region || "").trim();
    const mic = req.query.mic;
    const myRank = String(req.query.myRank || "").trim();

    // Close expired in bulk (best-effort)
    await supabase
      .from("lfg_lobbies")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("status", "open")
      .lt("expires_at", new Date().toISOString());

    let query = supabase
      .from("lfg_lobbies")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(80);

    if (mode) query = query.eq("mode", mode);
    if (region) query = query.eq("region", region);
    if (mic === "1" || mic === "true") query = query.eq("mic_required", true);

    const { data, error } = await query;
    if (error) {
      console.error("[LFG] list:", error);
      return res.status(500).json({
        error: error.message?.includes("lfg_lobbies")
          ? "LFG tables missing — run lfgMigration.sql"
          : "Failed to list lobbies",
      });
    }

    let lobbies = data || [];
    const myIdx = isValidRank(myRank) ? rankIndex(myRank) : -1;
    if (myIdx >= 0) {
      lobbies = lobbies.filter(
        (l) => myIdx >= (l.rank_min_index ?? 0) && myIdx <= (l.rank_max_index ?? 99)
      );
    }

    // Attach host usernames
    const hostIds = [...new Set(lobbies.map((l) => l.host_id).filter(Boolean))];
    let hosts = {};
    if (hostIds.length) {
      const { data: users } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .in("id", hostIds);
      hosts = Object.fromEntries((users || []).map((u) => [u.id, u]));
    }

    return res.json({
      lobbies: lobbies.map((row) => ({
        ...publicLobby(row, { includePartyCode: false }),
        hostUsername: hosts[row.host_id]?.username || "Host",
        hostAvatarUrl: hosts[row.host_id]?.avatar_url || null,
      })),
    });
  } catch (err) {
    console.error("[LFG] list error:", err);
    return res.status(500).json({ error: "Failed to list lobbies" });
  }
});

// GET /lfg/lobbies/:id
router.get("/lobbies/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { data: lobby, error } = await supabase
      .from("lfg_lobbies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !lobby) return res.status(404).json({ error: "Lobby not found" });

    const fresh = await expireIfNeeded(lobby);
    const member = await isLobbyMember(id, userId);
    const members = await fetchMembers(id);

    return res.json({
      lobby: publicLobby(fresh, { includePartyCode: member, members }),
      isMember: member,
      isHost: fresh.host_id === userId,
    });
  } catch (err) {
    console.error("[LFG] get error:", err);
    return res.status(500).json({ error: "Failed to load lobby" });
  }
});

// POST /lfg/lobbies — create lobby + Descall group
router.post("/lobbies", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      mode = "competitive",
      region = "eu",
      hostRank,
      rankMin,
      rankMax,
      partySizeCurrent = 1,
      partySizeMax = 5,
      needRoles = [],
      micRequired = false,
      partyCode = "",
      note = "",
    } = req.body || {};

    if (!VALORANT_MODES.some((m) => m.id === mode)) {
      return res.status(400).json({ error: "Invalid mode" });
    }
    if (!VALORANT_REGIONS.some((r) => r.id === region)) {
      return res.status(400).json({ error: "Invalid region" });
    }
    if (!isValidRank(hostRank) || !isValidRank(rankMin) || !isValidRank(rankMax)) {
      return res.status(400).json({ error: "Invalid rank selection" });
    }

    const minIdx = rankIndex(rankMin);
    const maxIdx = rankIndex(rankMax);
    const hostIdx = rankIndex(hostRank);
    if (minIdx > maxIdx) {
      return res.status(400).json({ error: "rankMin cannot be above rankMax" });
    }
    if (hostIdx < minIdx || hostIdx > maxIdx) {
      return res.status(400).json({ error: "Your rank must be inside the lobby range" });
    }

    const sizeNow = Math.min(MAX_PARTY, Math.max(1, Number(partySizeCurrent) || 1));
    const sizeMax = Math.min(MAX_PARTY, Math.max(sizeNow, Number(partySizeMax) || 5));
    const roles = Array.isArray(needRoles)
      ? needRoles.filter((r) => VALORANT_ROLES.includes(r)).slice(0, 5)
      : [];
    const code = String(partyCode || "").trim().slice(0, 32);
    const cleanNote = String(note || "").trim().slice(0, 160);

    const modeLabel = VALORANT_MODES.find((m) => m.id === mode)?.label || mode;
    const groupName = `VAL ${modeLabel} · ${hostRank}`.slice(0, 50);

    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({ name: groupName, created_by: userId })
      .select("id, name, avatar_url, created_by, created_at")
      .single();
    if (groupError || !group) {
      console.error("[LFG] group create:", groupError);
      return res.status(500).json({ error: "Failed to create lobby group" });
    }

    const { error: gmError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: userId });
    if (gmError) {
      await supabase.from("groups").delete().eq("id", group.id);
      return res.status(500).json({ error: "Failed to add host to group" });
    }

    const expiresAt = new Date(Date.now() + LOBBY_TTL_MINUTES * 60 * 1000).toISOString();
    const { data: lobby, error: lobbyError } = await supabase
      .from("lfg_lobbies")
      .insert({
        host_id: userId,
        group_id: group.id,
        game: "valorant",
        mode,
        region,
        party_size_current: sizeNow,
        party_size_max: sizeMax,
        host_rank: hostRank,
        host_rank_index: hostIdx,
        rank_min: rankMin,
        rank_max: rankMax,
        rank_min_index: minIdx,
        rank_max_index: maxIdx,
        need_roles: roles,
        mic_required: Boolean(micRequired),
        party_code: code || null,
        note: cleanNote || null,
        status: "open",
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (lobbyError || !lobby) {
      console.error("[LFG] lobby create:", lobbyError);
      await supabase.from("groups").delete().eq("id", group.id);
      return res.status(500).json({
        error: lobbyError?.message?.includes("lfg_lobbies")
          ? "LFG tables missing — run lfgMigration.sql"
          : "Failed to create lobby",
      });
    }

    await supabase.from("lfg_lobby_members").insert({
      lobby_id: lobby.id,
      user_id: userId,
      rank_snapshot: hostRank,
      role: null,
    });

    const members = await fetchMembers(lobby.id);
    const payload = publicLobby(lobby, { includePartyCode: true, members });

    const io = req.app.get("io");
    emitLfg(io, "lfg:lobby:created", {
      lobby: { ...payload, partyCode: undefined, hasPartyCode: Boolean(code) },
    });

    // Join socket room for host if connected
    const sockId = getUserSocketId(userId);
    if (sockId && io) {
      const sock = io.sockets.sockets.get(sockId);
      sock?.join(`group:${group.id}`);
      sock?.join(`lfg:${lobby.id}`);
      sock?.emit("group:invited", {
        group: { ...group, memberCount: 1, members: [] },
      });
    }

    return res.status(201).json({
      lobby: payload,
      group: { ...group, memberCount: 1 },
      isHost: true,
      isMember: true,
    });
  } catch (err) {
    console.error("[LFG] create error:", err);
    return res.status(500).json({ error: "Failed to create lobby" });
  }
});

// POST /lfg/lobbies/:id/join
router.post("/lobbies/:id/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { myRank, role } = req.body || {};

    const { data: lobby, error } = await supabase
      .from("lfg_lobbies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !lobby) return res.status(404).json({ error: "Lobby not found" });

    const fresh = await expireIfNeeded(lobby);
    if (fresh.status !== "open") {
      return res.status(410).json({ error: "Lobby is closed or expired" });
    }
    if ((fresh.party_size_current || 0) >= (fresh.party_size_max || MAX_PARTY)) {
      return res.status(400).json({ error: "Lobby is full" });
    }

    if (await isLobbyMember(id, userId)) {
      const members = await fetchMembers(id);
      const { data: group } = await supabase
        .from("groups")
        .select("id, name, avatar_url, created_by, created_at")
        .eq("id", fresh.group_id)
        .maybeSingle();
      return res.json({
        lobby: publicLobby(fresh, { includePartyCode: true, members }),
        group,
        alreadyMember: true,
        isHost: fresh.host_id === userId,
        isMember: true,
      });
    }

    if (!isValidRank(myRank)) {
      return res.status(400).json({ error: "Select your rank to join" });
    }
    const myIdx = rankIndex(myRank);
    if (myIdx < (fresh.rank_min_index ?? 0) || myIdx > (fresh.rank_max_index ?? 99)) {
      return res.status(403).json({
        error: `Your rank must be between ${fresh.rank_min} and ${fresh.rank_max}`,
      });
    }

    if (!fresh.group_id) {
      return res.status(500).json({ error: "Lobby group missing" });
    }

    const { error: gmError } = await supabase
      .from("group_members")
      .insert({ group_id: fresh.group_id, user_id: userId });
    if (gmError && !String(gmError.message || "").includes("duplicate")) {
      // maybe already in group from before
      console.warn("[LFG] group_members insert:", gmError.message);
    }

    const { error: lmError } = await supabase.from("lfg_lobby_members").insert({
      lobby_id: id,
      user_id: userId,
      rank_snapshot: myRank,
      role: VALORANT_ROLES.includes(role) ? role : null,
    });
    if (lmError) {
      console.error("[LFG] member insert:", lmError);
      return res.status(500).json({ error: "Failed to join lobby" });
    }

    const nextSize = (fresh.party_size_current || 1) + 1;
    const nextStatus = nextSize >= (fresh.party_size_max || MAX_PARTY) ? "full" : "open";
    const { data: updated } = await supabase
      .from("lfg_lobbies")
      .update({
        party_size_current: nextSize,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    const members = await fetchMembers(id);
    const { data: group } = await supabase
      .from("groups")
      .select("id, name, avatar_url, created_by, created_at")
      .eq("id", fresh.group_id)
      .maybeSingle();

    const io = req.app.get("io");
    const sockId = getUserSocketId(userId);
    if (sockId && io && group) {
      const sock = io.sockets.sockets.get(sockId);
      sock?.join(`group:${group.id}`);
      sock?.join(`lfg:${id}`);
      sock?.emit("group:invited", {
        group: { ...group, memberCount: nextSize },
      });
    }
    emitLfg(io, "lfg:lobby:updated", {
      lobby: publicLobby(updated || fresh, { includePartyCode: false }),
    });
    io?.to(`lfg:${id}`).emit("lfg:member:joined", {
      lobbyId: id,
      userId,
      username: req.user.username,
      members,
    });

    return res.json({
      lobby: publicLobby(updated || fresh, { includePartyCode: true, members }),
      group: group ? { ...group, memberCount: nextSize } : null,
      isHost: false,
      isMember: true,
    });
  } catch (err) {
    console.error("[LFG] join error:", err);
    return res.status(500).json({ error: "Failed to join lobby" });
  }
});

// POST /lfg/lobbies/:id/leave
router.post("/lobbies/:id/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { data: lobby } = await supabase
      .from("lfg_lobbies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!lobby) return res.status(404).json({ error: "Lobby not found" });

    if (lobby.host_id === userId) {
      await supabase
        .from("lfg_lobbies")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", id);
      const io = req.app.get("io");
      emitLfg(io, "lfg:lobby:closed", { lobbyId: id });
      return res.json({ success: true, closed: true });
    }

    await supabase
      .from("lfg_lobby_members")
      .delete()
      .eq("lobby_id", id)
      .eq("user_id", userId);

    if (lobby.group_id) {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", lobby.group_id)
        .eq("user_id", userId);
    }

    const nextSize = Math.max(0, (lobby.party_size_current || 1) - 1);
    const { data: updated } = await supabase
      .from("lfg_lobbies")
      .update({
        party_size_current: nextSize,
        status: lobby.status === "full" ? "open" : lobby.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    const io = req.app.get("io");
    emitLfg(io, "lfg:lobby:updated", {
      lobby: publicLobby(updated || lobby, { includePartyCode: false }),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[LFG] leave error:", err);
    return res.status(500).json({ error: "Failed to leave lobby" });
  }
});

// PATCH /lfg/lobbies/:id — host updates party code / note / status
router.patch("/lobbies/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { partyCode, note, status } = req.body || {};

    const { data: lobby } = await supabase
      .from("lfg_lobbies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!lobby) return res.status(404).json({ error: "Lobby not found" });
    if (lobby.host_id !== userId) {
      return res.status(403).json({ error: "Only the host can update this lobby" });
    }

    const patch = { updated_at: new Date().toISOString() };
    if (partyCode !== undefined) {
      patch.party_code = String(partyCode || "").trim().slice(0, 32) || null;
    }
    if (note !== undefined) {
      patch.note = String(note || "").trim().slice(0, 160) || null;
    }
    if (status && ["open", "full", "in_game", "closed"].includes(status)) {
      patch.status = status;
    }

    const { data: updated, error } = await supabase
      .from("lfg_lobbies")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: "Failed to update lobby" });

    const members = await fetchMembers(id);
    const io = req.app.get("io");
    emitLfg(io, "lfg:lobby:updated", {
      lobby: publicLobby(updated, { includePartyCode: false }),
    });
    io?.to(`lfg:${id}`).emit("lfg:lobby:partycode", {
      lobbyId: id,
      hasPartyCode: Boolean(updated.party_code),
    });

    return res.json({
      lobby: publicLobby(updated, { includePartyCode: true, members }),
    });
  } catch (err) {
    console.error("[LFG] patch error:", err);
    return res.status(500).json({ error: "Failed to update lobby" });
  }
});

// POST /lfg/reports
router.post("/reports", requireAuth, async (req, res) => {
  try {
    const { lobbyId, targetId, reason } = req.body || {};
    const clean = String(reason || "").trim().slice(0, 400);
    if (!clean) return res.status(400).json({ error: "Reason required" });
    await supabase.from("lfg_reports").insert({
      reporter_id: req.user.id,
      target_id: targetId || null,
      lobby_id: lobbyId || null,
      reason: clean,
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to submit report" });
  }
});

module.exports = router;
