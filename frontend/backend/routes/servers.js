"use strict";

/**
 * Descall Servers API — Steps 1–9
 * Create / list / get / delete / leave + channel CRUD + text chat + roles +
 * permission gates + member kick + invites / public discovery + bans / audit log.
 * Ownership limit: max 10 servers owned per user (membership unlimited).
 */

const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const {
  EVERYONE_DEFAULT,
  toPgBigint,
  fromPgBigint,
  Permissions,
  hasPermission,
  resolveMemberPermissions,
  resolveChannelPermissions,
  permissionsToFlags,
  assertHierarchy,
  assertCanManageRole,
  getMemberHighestPosition,
} = require("../lib/serverPermissions");
const {
  applyServerTimeout,
  clearServerTimeout,
  updateMemberNickname,
} = require("../lib/slashCommands");

const router = express.Router();

const MAX_OWNED_SERVERS = 10;
const MAX_CHANNELS_PER_SERVER = 500;
const MAX_ROLES_PER_SERVER = 50;
const NAME_MIN = 2;
const NAME_MAX = 100;
const CHANNEL_NAME_MIN = 1;
const CHANNEL_NAME_MAX = 100;
const CHANNEL_TYPES = new Set(["text", "voice", "stage", "category"]);
const ROLE_NAME_MIN = 1;
const ROLE_NAME_MAX = 100;
const INVITE_CODE_LENGTH = 8;
const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Permission keys editable in the role UI. */
const EDITABLE_PERMISSION_KEYS = [
  "VIEW_CHANNEL",
  "SEND_MESSAGES",
  "MANAGE_MESSAGES",
  "MANAGE_CHANNELS",
  "MANAGE_GUILD",
  "MANAGE_ROLES",
  "USE_APPLICATION_COMMANDS",
  "CREATE_INSTANT_INVITE",
  "KICK_MEMBERS",
  "BAN_MEMBERS",
  "MODERATE_MEMBERS",
  "CHANGE_NICKNAME",
  "MANAGE_NICKNAMES",
  "VIEW_AUDIT_LOG",
  "MENTION_EVERYONE",
  "ATTACH_FILES",
  "EMBED_LINKS",
  "ADD_REACTIONS",
  "READ_MESSAGE_HISTORY",
  "CONNECT",
  "SPEAK",
  "REQUEST_TO_SPEAK",
  "PRIORITY_SPEAKER",
  "STREAM",
  "MUTE_MEMBERS",
  "DEAFEN_MEMBERS",
  "MOVE_MEMBERS",
  "ADMINISTRATOR",
];

/** Channel overwrite keys by channel type (Discord-like subset). */
const CHANNEL_OVERRIDE_KEYS = {
  text: [
    "VIEW_CHANNEL",
    "SEND_MESSAGES",
    "MANAGE_MESSAGES",
    "CREATE_INSTANT_INVITE",
    "MENTION_EVERYONE",
    "ATTACH_FILES",
    "EMBED_LINKS",
    "ADD_REACTIONS",
    "READ_MESSAGE_HISTORY",
  ],
  voice: [
    "VIEW_CHANNEL",
    "CONNECT",
    "SPEAK",
    "STREAM",
    "MUTE_MEMBERS",
    "MOVE_MEMBERS",
    "CREATE_INSTANT_INVITE",
  ],
  stage: [
    "VIEW_CHANNEL",
    "CONNECT",
    "REQUEST_TO_SPEAK",
    "PRIORITY_SPEAKER",
    "SPEAK",
    "STREAM",
    "MUTE_MEMBERS",
    "MOVE_MEMBERS",
    "CREATE_INSTANT_INVITE",
  ],
  category: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "SEND_MESSAGES", "CREATE_INSTANT_INVITE"],
};

async function filterChannelsForMember(serverId, userId, channels) {
  const base = await resolveMemberPermissions(supabase, serverId, userId);
  if (!base.isMember) return [];
  if (base.isOwner || hasPermission(base.bits, Permissions.ADMINISTRATOR)) {
    return channels;
  }
  const out = [];
  for (const ch of channels || []) {
    if (ch.type === "category") {
      out.push(ch);
      continue;
    }
    const resolved = await resolveChannelPermissions(supabase, serverId, userId, ch.id);
    if (hasPermission(resolved.bits, Permissions.VIEW_CHANNEL)) out.push(ch);
  }
  const visibleNonCat = new Set(out.filter((c) => c.type !== "category").map((c) => c.id));
  const hasVisibleChild = (catId) =>
    (channels || []).some((c) => c.parent_id === catId && visibleNonCat.has(c.id));
  return out.filter((c) => c.type !== "category" || hasVisibleChild(c.id));
}

function parseAllowDenyFlags(raw, allowedKeys) {
  const keys = allowedKeys || EDITABLE_PERMISSION_KEYS;
  let allow = 0n;
  let deny = 0n;
  if (!raw || typeof raw !== "object") return { allow, deny };
  for (const key of keys) {
    if (!Permissions[key]) continue;
    const v = raw[key];
    if (v === true || v === "allow") allow |= Permissions[key];
    else if (v === false || v === "deny") deny |= Permissions[key];
  }
  // Discord: a bit cannot be both allow and deny
  const both = allow & deny;
  allow &= ~both;
  deny &= ~both;
  return { allow, deny };
}

function generateInviteCode() {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CHARS.charAt(Math.floor(Math.random() * INVITE_CHARS.length));
  }
  return code;
}

function publicInviteUrl(req, code) {
  const origin =
    process.env.PUBLIC_APP_URL ||
    process.env.APP_ORIGIN ||
    `${req.protocol}://${req.get("host")}`;
  return `${String(origin).replace(/\/$/, "")}/servers/join/${code}`;
}

function publicInvite(row, req) {
  if (!row) return null;
  return {
    code: row.code,
    serverId: row.server_id,
    creatorId: row.creator_id,
    channelId: row.channel_id || null,
    maxUses: row.max_uses,
    uses: row.uses || 0,
    maxAgeSeconds: row.max_age_seconds,
    temporary: Boolean(row.temporary),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    url: publicInviteUrl(req, row.code),
  };
}

function isInviteExpired(invite) {
  if (!invite) return true;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return true;
  if (invite.max_uses != null && (invite.uses || 0) >= invite.max_uses) return true;
  return false;
}

function parsePermissionsInput(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    // { VIEW_CHANNEL: true, ... }
    let bits = 0n;
    for (const key of EDITABLE_PERMISSION_KEYS) {
      if (raw[key] && Permissions[key] != null) bits |= Permissions[key];
    }
    return bits;
  }
  try {
    return fromPgBigint(raw);
  } catch {
    return null;
  }
}

function clampColor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(0xffffff, Math.floor(n)));
}

function cleanName(raw) {
  return String(raw || "").trim().replace(/\s+/g, " ");
}

/** Discord-like channel names: text is slug-ish; voice/category keep spaces. */
function cleanChannelName(raw, type) {
  let name = String(raw || "").trim();
  if (type === "text") {
    name = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  } else {
    name = name.replace(/\s+/g, " ");
  }
  return name.slice(0, CHANNEL_NAME_MAX);
}

async function requireServerOwner(serverId, userId) {
  const membership = await getMembership(serverId, userId);
  if (!membership) {
    const err = new Error("You are not a member of this server.");
    err.status = 403;
    throw err;
  }
  const { data: server, error } = await supabase
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .maybeSingle();
  if (error) throw error;
  if (!server) {
    const err = new Error("Server not found.");
    err.status = 404;
    throw err;
  }
  if (server.owner_id !== userId) {
    const err = new Error("Only the server owner can do this.");
    err.status = 403;
    err.code = "OWNER_REQUIRED";
    throw err;
  }
  return { server, membership, permissions: null, isOwner: true };
}

/**
 * Require membership + a permission bit (owner always passes).
 * @param {bigint|string} flag — Permissions.* bit or key name
 */
async function requireServerPermission(serverId, userId, flag) {
  const resolved = await resolveMemberPermissions(supabase, serverId, userId);
  if (!resolved.isMember) {
    const err = new Error("You are not a member of this server.");
    err.status = 403;
    throw err;
  }
  if (!hasPermission(resolved.bits, flag)) {
    const err = new Error("Missing permission.");
    err.status = 403;
    err.code = "MISSING_PERMISSION";
    err.permission = typeof flag === "string" ? flag : null;
    throw err;
  }
  const { data: server, error } = await supabase
    .from("servers")
    .select("*")
    .eq("id", serverId)
    .maybeSingle();
  if (error) throw error;
  if (!server) {
    const err = new Error("Server not found.");
    err.status = 404;
    throw err;
  }
  return {
    server,
    permissions: resolved.bits,
    isOwner: resolved.isOwner,
  };
}

async function buildMyPermissionsPayload(serverId, userId) {
  const [resolved, highestPosition] = await Promise.all([
    resolveMemberPermissions(supabase, serverId, userId),
    getMemberHighestPosition(supabase, serverId, userId),
  ]);
  return {
    bits: toPgBigint(resolved.bits),
    flags: permissionsToFlags(resolved.bits),
    isOwner: resolved.isOwner,
    highestPosition,
  };
}

async function nextChannelPosition(serverId) {
  const { data, error } = await supabase
    .from("server_channels")
    .select("position")
    .eq("server_id", serverId)
    .order("position", { ascending: false })
    .limit(1);
  if (error) throw error;
  const top = data?.[0]?.position;
  return typeof top === "number" ? top + 1 : 0;
}

async function assertValidParent(serverId, parentId, channelType) {
  if (!parentId) return null;
  if (channelType === "category") {
    const err = new Error("Categories cannot be nested.");
    err.status = 400;
    throw err;
  }
  const { data: parent, error } = await supabase
    .from("server_channels")
    .select("*")
    .eq("id", parentId)
    .eq("server_id", serverId)
    .maybeSingle();
  if (error) throw error;
  if (!parent) {
    const err = new Error("Parent category not found.");
    err.status = 400;
    throw err;
  }
  if (parent.type !== "category") {
    const err = new Error("Parent must be a category.");
    err.status = 400;
    throw err;
  }
  return parent;
}

function publicServer(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    iconUrl: row.icon_url || null,
    bannerUrl: row.banner_url || null,
    splashUrl: row.splash_url || null,
    description: row.description || null,
    ownerId: row.owner_id,
    vanitySlug: row.vanity_slug || null,
    isPublic: Boolean(row.is_public),
    communityEnabled: Boolean(row.community_enabled),
    rulesChannelId: row.rules_channel_id || null,
    rulesText: row.rules_text || null,
    verificationLevel: row.verification_level || "none",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extra,
  };
}

function publicChannel(row) {
  if (!row) return null;
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    type: row.type,
    topic: row.topic || null,
    position: row.position ?? 0,
    parentId: row.parent_id || null,
    slowmodeSeconds: row.slowmode_seconds ?? 0,
    nsfw: Boolean(row.nsfw),
    createdAt: row.created_at,
  };
}

function publicRole(row) {
  if (!row) return null;
  return {
    id: row.id,
    serverId: row.server_id,
    name: row.name,
    color: row.color ?? 0,
    position: row.position ?? 0,
    permissions: String(row.permissions ?? "0"),
    hoist: Boolean(row.hoist),
    mentionable: Boolean(row.mentionable),
    isEveryone: Boolean(row.is_everyone),
    iconUrl: row.icon_url || null,
    createdAt: row.created_at,
  };
}

async function countOwnedServers(userId) {
  const { count, error } = await supabase
    .from("servers")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if (error) throw error;
  return count || 0;
}

async function getMembership(serverId, userId) {
  const { data, error } = await supabase
    .from("server_members")
    .select("server_id, user_id, nickname, list_position, joined_at, timeout_until, timeout_reason, timed_out_by, notification_level, rules_accepted_at")
    .eq("server_id", serverId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadServerBundle(serverId) {
  const [{ data: server, error: sErr }, { data: channels, error: cErr }, { data: roles, error: rErr }] =
    await Promise.all([
      supabase.from("servers").select("*").eq("id", serverId).maybeSingle(),
      supabase
        .from("server_channels")
        .select("*")
        .eq("server_id", serverId)
        .order("position", { ascending: true }),
      supabase
        .from("server_roles")
        .select("*")
        .eq("server_id", serverId)
        .order("position", { ascending: false }),
    ]);
  if (sErr) throw sErr;
  if (cErr) throw cErr;
  if (rErr) throw rErr;
  if (!server) return null;

  const { count: memberCount, error: mErr } = await supabase
    .from("server_members")
    .select("user_id", { count: "exact", head: true })
    .eq("server_id", serverId);
  if (mErr) throw mErr;

  return {
    server,
    channels: channels || [],
    roles: roles || [],
    memberCount: memberCount || 0,
  };
}

async function writeAudit({ serverId, actorId, action, targetType, targetId, changes, reason }) {
  const { error } = await supabase.from("server_audit_logs").insert({
    server_id: serverId,
    actor_id: actorId || null,
    action,
    target_type: targetType || null,
    target_id: targetId ? String(targetId) : null,
    changes: changes || null,
    reason: reason || null,
  });
  if (error) {
    console.warn("[SERVERS] audit log insert failed:", error.message);
  }
}

async function deleteServerCascade(serverId) {
  // FK cascades handle children; delete server row.
  const { error } = await supabase.from("servers").delete().eq("id", serverId);
  if (error) throw error;
}

/**
 * Live-notify a kicked/banned user + other server members.
 * Also drops them from server voice rooms.
 */
function notifyServerMemberRemoved(req, {
  serverId,
  serverName,
  targetUserId,
  action,
  reason,
  actorId,
}) {
  const io = req.app?.get?.("io");
  if (!io || !serverId || !targetUserId) return;

  const payload = {
    serverId,
    serverName: serverName || null,
    userId: targetUserId,
    action: action === "ban" ? "ban" : "kick",
    reason: reason || null,
    actorId: actorId || null,
  };

  io.to(`user:${targetUserId}`).emit("server:member:removed", payload);
  io.to(`server:${serverId}`).emit("server:member:removed", payload);

  try {
    const userRoom = io.sockets?.adapter?.rooms?.get(`user:${targetUserId}`);
    if (userRoom) {
      for (const sockId of userRoom) {
        const sock = io.sockets.sockets.get(sockId);
        if (!sock) continue;
        sock.leave(`server:${serverId}`);
        for (const roomName of [...sock.rooms]) {
          if (typeof roomName === "string" && roomName.startsWith("server-channel:")) {
            sock.leave(roomName);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[SERVERS] leave rooms after remove failed:", err?.message || err);
  }

  try {
    const { removeUserFromAllServerVoice } = require("../socket/serverVoiceHandlers");
    removeUserFromAllServerVoice(io, targetUserId);
  } catch (err) {
    console.warn("[SERVERS] voice cleanup after remove failed:", err?.message || err);
  }
}

/**
 * GET /servers/my
 * Servers the user is a member of (owned + joined), ordered by list_position.
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: memberships, error } = await supabase
      .from("server_members")
      .select(
        "server_id, nickname, list_position, joined_at, notification_level, rules_accepted_at, timeout_until, timeout_reason"
      )
      .eq("user_id", userId)
      .order("list_position", { ascending: true });
    if (error) throw error;

    const ids = (memberships || []).map((m) => m.server_id);
    if (ids.length === 0) {
      return res.json({ servers: [], ownedCount: 0, maxOwned: MAX_OWNED_SERVERS });
    }

    const { data: servers, error: sErr } = await supabase.from("servers").select("*").in("id", ids);
    if (sErr) throw sErr;

    const byId = new Map((servers || []).map((s) => [s.id, s]));
    const ownedCount = (servers || []).filter((s) => s.owner_id === userId).length;

    // Member counts (best-effort batch)
    const counts = new Map();
    await Promise.all(
      ids.map(async (id) => {
        const { count } = await supabase
          .from("server_members")
          .select("user_id", { count: "exact", head: true })
          .eq("server_id", id);
        counts.set(id, count || 0);
      })
    );

    const { data: channels } = await supabase
      .from("server_channels")
      .select("*")
      .in("server_id", ids)
      .order("position", { ascending: true });

    const channelsByServer = new Map();
    for (const ch of channels || []) {
      if (!channelsByServer.has(ch.server_id)) channelsByServer.set(ch.server_id, []);
      channelsByServer.get(ch.server_id).push(publicChannel(ch));
    }

    const list = (memberships || [])
      .map((m) => {
        const row = byId.get(m.server_id);
        if (!row) return null;
        const level = String(m.notification_level || "all").toLowerCase();
        return publicServer(row, {
          nickname: m.nickname || null,
          listPosition: m.list_position ?? 0,
          joinedAt: m.joined_at,
          notificationLevel: ["all", "mentions", "muted"].includes(level) ? level : "all",
          rulesAcceptedAt: m.rules_accepted_at || null,
          timeoutUntil: m.timeout_until || null,
          timeoutReason: m.timeout_reason || null,
          isOwner: row.owner_id === userId,
          memberCount: counts.get(row.id) || 0,
          channels: channelsByServer.get(row.id) || [],
        });
      })
      .filter(Boolean);

    return res.json({
      servers: list,
      ownedCount,
      maxOwned: MAX_OWNED_SERVERS,
    });
  } catch (err) {
    console.error("[SERVERS] GET /my error:", err);
    return res.status(500).json({ error: "Failed to load servers." });
  }
});

/**
 * POST /servers
 * Create a server. Enforces max 10 owned servers.
 * Seeds @everyone role + #general text + General voice channel.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const name = cleanName(req.body?.name);
    const iconUrl = req.body?.iconUrl ? String(req.body.iconUrl).trim().slice(0, 500) : null;
    const description = req.body?.description
      ? String(req.body.description).trim().slice(0, 500)
      : null;

    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      return res.status(400).json({ error: `Server name must be ${NAME_MIN}–${NAME_MAX} characters.` });
    }

    const owned = await countOwnedServers(userId);
    if (owned >= MAX_OWNED_SERVERS) {
      return res.status(400).json({
        error: `You can own at most ${MAX_OWNED_SERVERS} servers.`,
        code: "MAX_OWNED_SERVERS",
        ownedCount: owned,
        maxOwned: MAX_OWNED_SERVERS,
      });
    }

    const { data: server, error: sErr } = await supabase
      .from("servers")
      .insert({
        name,
        icon_url: iconUrl,
        description,
        owner_id: userId,
        is_public: false,
      })
      .select("*")
      .single();
    if (sErr) throw sErr;

    // Member row
    const { count: existingPos } = await supabase
      .from("server_members")
      .select("server_id", { count: "exact", head: true })
      .eq("user_id", userId);
    const listPosition = existingPos || 0;

    const { error: mErr } = await supabase.from("server_members").insert({
      server_id: server.id,
      user_id: userId,
      list_position: listPosition,
    });
    if (mErr) {
      await deleteServerCascade(server.id);
      throw mErr;
    }

    // @everyone role (position 0)
    const { data: everyoneRole, error: rErr } = await supabase
      .from("server_roles")
      .insert({
        server_id: server.id,
        name: "@everyone",
        color: 0,
        position: 0,
        permissions: toPgBigint(EVERYONE_DEFAULT),
        hoist: false,
        mentionable: false,
        is_everyone: true,
      })
      .select("*")
      .single();
    if (rErr) {
      await deleteServerCascade(server.id);
      throw rErr;
    }

    // Default channels: category + text + voice (Discord-like starter)
    const { data: category, error: catErr } = await supabase
      .from("server_channels")
      .insert({
        server_id: server.id,
        name: "Text Channels",
        type: "category",
        position: 0,
      })
      .select("*")
      .single();
    if (catErr) {
      await deleteServerCascade(server.id);
      throw catErr;
    }

    const { data: general, error: gErr } = await supabase
      .from("server_channels")
      .insert({
        server_id: server.id,
        name: "general",
        type: "text",
        position: 1,
        parent_id: category.id,
      })
      .select("*")
      .single();
    if (gErr) {
      await deleteServerCascade(server.id);
      throw gErr;
    }

    const { data: voiceCat, error: vCatErr } = await supabase
      .from("server_channels")
      .insert({
        server_id: server.id,
        name: "Voice Channels",
        type: "category",
        position: 2,
      })
      .select("*")
      .single();
    if (vCatErr) {
      await deleteServerCascade(server.id);
      throw vCatErr;
    }

    const { data: generalVoice, error: vErr } = await supabase
      .from("server_channels")
      .insert({
        server_id: server.id,
        name: "General",
        type: "voice",
        position: 3,
        parent_id: voiceCat.id,
      })
      .select("*")
      .single();
    if (vErr) {
      await deleteServerCascade(server.id);
      throw vErr;
    }

    await writeAudit({
      serverId: server.id,
      actorId: userId,
      action: "SERVER_CREATE",
      targetType: "server",
      targetId: server.id,
      changes: { name },
    });

    return res.status(201).json({
      server: publicServer(server, {
        isOwner: true,
        memberCount: 1,
        nickname: null,
        listPosition,
        channels: [category, general, voiceCat, generalVoice].map(publicChannel),
        roles: [publicRole(everyoneRole)],
        myPermissions: await buildMyPermissionsPayload(server.id, userId),
      }),
      ownedCount: owned + 1,
      maxOwned: MAX_OWNED_SERVERS,
    });
  } catch (err) {
    console.error("[SERVERS] POST / error:", err);
    return res.status(500).json({ error: "Failed to create server." });
  }
});

/**
 * GET /servers/discover — public servers directory (is_public = true)
 */
router.get("/discover", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 24));
    const q = String(req.query.q || "").trim().slice(0, 80);

    let query = supabase
      .from("servers")
      .select(
        "id, name, icon_url, banner_url, splash_url, description, owner_id, vanity_slug, is_public, community_enabled, rules_text, verification_level, created_at"
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (q) {
      query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    const ids = (rows || []).map((r) => r.id);
    let counts = new Map();
    if (ids.length) {
      const { data: members } = await supabase
        .from("server_members")
        .select("server_id")
        .in("server_id", ids);
      counts = (members || []).reduce((map, m) => {
        map.set(m.server_id, (map.get(m.server_id) || 0) + 1);
        return map;
      }, new Map());
    }

    const { data: myMemberships } = await supabase
      .from("server_members")
      .select("server_id")
      .eq("user_id", req.user.id)
      .in("server_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const joined = new Set((myMemberships || []).map((m) => m.server_id));

    return res.json({
      servers: (rows || []).map((row) =>
        publicServer(row, {
          memberCount: counts.get(row.id) || 1,
          isMember: joined.has(row.id),
          isOwner: row.owner_id === req.user.id,
        })
      ),
    });
  } catch (err) {
    console.error("[SERVERS] GET /discover error:", err);
    return res.status(500).json({ error: "Failed to load public servers." });
  }
});

/**
 * GET /servers/invites/:code — public invite preview (auth optional but requireAuth for consistency)
 */
router.get("/invites/:code", requireAuth, async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();
    if (!code) return res.status(400).json({ error: "Invite code is required." });

    const { data: invite, error } = await supabase
      .from("server_invites")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!invite) return res.status(404).json({ error: "Invite invalid or expired.", code: "INVITE_INVALID" });

    if (isInviteExpired(invite)) {
      await supabase.from("server_invites").delete().eq("code", code);
      return res.status(410).json({ error: "Invite invalid or expired.", code: "INVITE_EXPIRED" });
    }

    const { data: server } = await supabase
      .from("servers")
      .select(
        "id, name, icon_url, banner_url, splash_url, description, owner_id, is_public, community_enabled, rules_text, verification_level"
      )
      .eq("id", invite.server_id)
      .maybeSingle();
    if (!server) {
      return res.status(404).json({ error: "Invite invalid or expired.", code: "INVITE_INVALID" });
    }

    const { count } = await supabase
      .from("server_members")
      .select("user_id", { count: "exact", head: true })
      .eq("server_id", server.id);

    const membership = await getMembership(server.id, req.user.id);

    return res.json({
      invite: publicInvite(invite, req),
      server: publicServer(server, {
        memberCount: count || 1,
        isMember: Boolean(membership),
        isOwner: server.owner_id === req.user.id,
        rulesAcceptedAt: membership?.rules_accepted_at || null,
        needsRulesAccept:
          Boolean(server.community_enabled) &&
          Boolean(server.rules_text) &&
          !membership?.rules_accepted_at,
      }),
    });
  } catch (err) {
    console.error("[SERVERS] GET /invites/:code error:", err);
    return res.status(500).json({ error: "Failed to load invite." });
  }
});

/**
 * POST /servers/invites/:code/join — redeem invite
 */
router.post("/invites/:code/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const code = String(req.params.code || "").trim();
    if (!code) return res.status(400).json({ error: "Invite code is required." });

    const { data: invite, error } = await supabase
      .from("server_invites")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    if (!invite) return res.status(404).json({ error: "Invite invalid or expired.", code: "INVITE_INVALID" });
    if (isInviteExpired(invite)) {
      await supabase.from("server_invites").delete().eq("code", code);
      return res.status(410).json({ error: "Invite invalid or expired.", code: "INVITE_EXPIRED" });
    }

    const { data: ban } = await supabase
      .from("server_bans")
      .select("user_id")
      .eq("server_id", invite.server_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (ban) {
      return res.status(403).json({ error: "You are banned from this server.", code: "BANNED" });
    }

    const existing = await getMembership(invite.server_id, userId);
    if (existing) {
      const bundle = await loadServerBundle(invite.server_id);
      const myPermissions = await buildMyPermissionsPayload(invite.server_id, userId);
      return res.json({
        alreadyMember: true,
        server: publicServer(bundle.server, {
          isOwner: bundle.server.owner_id === userId,
          memberCount: bundle.memberCount,
          nickname: existing.nickname || null,
          listPosition: existing.list_position ?? 0,
          joinedAt: existing.joined_at,
          channels: bundle.channels.map(publicChannel),
          roles: bundle.roles.map(publicRole),
          myPermissions,
        }),
      });
    }

    const { count: existingPos } = await supabase
      .from("server_members")
      .select("server_id", { count: "exact", head: true })
      .eq("user_id", userId);
    const listPosition = existingPos || 0;

    const { error: joinErr } = await supabase.from("server_members").insert({
      server_id: invite.server_id,
      user_id: userId,
      list_position: listPosition,
    });
    if (joinErr) throw joinErr;

    const nextUses = (invite.uses || 0) + 1;
    if (invite.max_uses != null && nextUses >= invite.max_uses) {
      await supabase.from("server_invites").delete().eq("code", code);
    } else {
      await supabase.from("server_invites").update({ uses: nextUses }).eq("code", code);
    }

    await writeAudit({
      serverId: invite.server_id,
      actorId: userId,
      action: "MEMBER_JOIN",
      targetType: "member",
      targetId: userId,
      changes: { via: "invite", code },
    });

    const bundle = await loadServerBundle(invite.server_id);
    const myPermissions = await buildMyPermissionsPayload(invite.server_id, userId);

    return res.status(201).json({
      alreadyMember: false,
      server: publicServer(bundle.server, {
        isOwner: false,
        memberCount: bundle.memberCount,
        nickname: null,
        listPosition,
        channels: bundle.channels.map(publicChannel),
        roles: bundle.roles.map(publicRole),
        myPermissions,
      }),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] POST /invites/:code/join error:", err);
    return res.status(status).json({ error: err.message || "Failed to join server.", code: err.code });
  }
});

/**
 * POST /servers/discover/:id/join — join a public server without invite
 */
router.post("/discover/:id/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const serverId = req.params.id;

    const { data: server, error } = await supabase
      .from("servers")
      .select("*")
      .eq("id", serverId)
      .maybeSingle();
    if (error) throw error;
    if (!server || !server.is_public) {
      return res.status(404).json({ error: "Public server not found." });
    }

    const { data: ban } = await supabase
      .from("server_bans")
      .select("user_id")
      .eq("server_id", serverId)
      .eq("user_id", userId)
      .maybeSingle();
    if (ban) {
      return res.status(403).json({ error: "You are banned from this server.", code: "BANNED" });
    }

    const existing = await getMembership(serverId, userId);
    if (existing) {
      const bundle = await loadServerBundle(serverId);
      const myPermissions = await buildMyPermissionsPayload(serverId, userId);
      return res.json({
        alreadyMember: true,
        server: publicServer(bundle.server, {
          isOwner: bundle.server.owner_id === userId,
          memberCount: bundle.memberCount,
          nickname: existing.nickname || null,
          listPosition: existing.list_position ?? 0,
          channels: bundle.channels.map(publicChannel),
          roles: bundle.roles.map(publicRole),
          myPermissions,
        }),
      });
    }

    const { count: existingPos } = await supabase
      .from("server_members")
      .select("server_id", { count: "exact", head: true })
      .eq("user_id", userId);

    const { error: joinErr } = await supabase.from("server_members").insert({
      server_id: serverId,
      user_id: userId,
      list_position: existingPos || 0,
    });
    if (joinErr) throw joinErr;

    await writeAudit({
      serverId,
      actorId: userId,
      action: "MEMBER_JOIN",
      targetType: "member",
      targetId: userId,
      changes: { via: "discover" },
    });

    const bundle = await loadServerBundle(serverId);
    const myPermissions = await buildMyPermissionsPayload(serverId, userId);
    return res.status(201).json({
      alreadyMember: false,
      server: publicServer(bundle.server, {
        isOwner: false,
        memberCount: bundle.memberCount,
        channels: bundle.channels.map(publicChannel),
        roles: bundle.roles.map(publicRole),
        myPermissions,
      }),
    });
  } catch (err) {
    console.error("[SERVERS] POST /discover/:id/join error:", err);
    return res.status(500).json({ error: "Failed to join public server." });
  }
});

/**
 * GET /servers/:id
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await getMembership(serverId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this server." });
    }

    const bundle = await loadServerBundle(serverId);
    if (!bundle) return res.status(404).json({ error: "Server not found." });

    const myPermissions = await buildMyPermissionsPayload(serverId, req.user.id);
    const visibleChannels = await filterChannelsForMember(
      serverId,
      req.user.id,
      bundle.channels
    );

    const level = String(membership.notification_level || "all").toLowerCase();
    return res.json({
      server: publicServer(bundle.server, {
        isOwner: bundle.server.owner_id === req.user.id,
        memberCount: bundle.memberCount,
        nickname: membership.nickname || null,
        listPosition: membership.list_position ?? 0,
        joinedAt: membership.joined_at,
        notificationLevel: ["all", "mentions", "muted"].includes(level) ? level : "all",
        rulesAcceptedAt: membership.rules_accepted_at || null,
        timeoutUntil: membership.timeout_until || null,
        timeoutReason: membership.timeout_reason || null,
        channels: visibleChannels.map(publicChannel),
        roles: bundle.roles.map(publicRole),
        myPermissions,
      }),
    });
  } catch (err) {
    console.error("[SERVERS] GET /:id error:", err);
    return res.status(500).json({ error: "Failed to load server." });
  }
});

/**
 * DELETE /servers/:id
 * Owner only. Requires confirmName matching the server name.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const confirmName = cleanName(req.body?.confirmName || req.query?.confirmName);

    const { data: server, error } = await supabase
      .from("servers")
      .select("*")
      .eq("id", serverId)
      .maybeSingle();
    if (error) throw error;
    if (!server) return res.status(404).json({ error: "Server not found." });
    if (server.owner_id !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can delete this server." });
    }
    if (!confirmName || confirmName.toLowerCase() !== String(server.name).toLowerCase()) {
      return res.status(400).json({
        error: "Type the server name to confirm deletion.",
        code: "CONFIRM_NAME_REQUIRED",
      });
    }

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "SERVER_DELETE",
      targetType: "server",
      targetId: serverId,
      changes: { name: server.name },
    });

    await deleteServerCascade(serverId);
    return res.json({ message: "Server deleted.", serverId });
  } catch (err) {
    console.error("[SERVERS] DELETE /:id error:", err);
    return res.status(500).json({ error: "Failed to delete server." });
  }
});

/**
 * POST /servers/:id/leave
 * Non-owner leaves. Owner leave deletes the server (no transfer).
 * Owner must pass confirmName when leaving (= delete).
 */
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const userId = req.user.id;
    const confirmName = cleanName(req.body?.confirmName);

    const membership = await getMembership(serverId, userId);
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this server." });
    }

    const { data: server, error } = await supabase
      .from("servers")
      .select("*")
      .eq("id", serverId)
      .maybeSingle();
    if (error) throw error;
    if (!server) return res.status(404).json({ error: "Server not found." });

    if (server.owner_id === userId) {
      if (!confirmName || confirmName.toLowerCase() !== String(server.name).toLowerCase()) {
        return res.status(400).json({
          error: "Owner leave deletes the server. Type the server name to confirm.",
          code: "CONFIRM_NAME_REQUIRED",
          deletesServer: true,
        });
      }
      await writeAudit({
        serverId,
        actorId: userId,
        action: "SERVER_DELETE",
        targetType: "server",
        targetId: serverId,
        changes: { name: server.name, via: "owner_leave" },
      });
      await deleteServerCascade(serverId);
      return res.json({ message: "Server deleted.", deleted: true, serverId });
    }

    const { error: delErr } = await supabase
      .from("server_members")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", userId);
    if (delErr) throw delErr;

    // Clean member role assignments
    await supabase
      .from("server_member_roles")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", userId);

    await writeAudit({
      serverId,
      actorId: userId,
      action: "MEMBER_LEAVE",
      targetType: "member",
      targetId: userId,
    });

    return res.json({ message: "Left server.", deleted: false, serverId });
  } catch (err) {
    console.error("[SERVERS] POST /:id/leave error:", err);
    return res.status(500).json({ error: "Failed to leave server." });
  }
});

/**
 * GET /servers/:id/channels/:channelId/messages
 * VIEW_CHANNEL-gated history for text channels.
 */
router.get("/:id/channels/:channelId/messages", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const channelId = req.params.channelId;
    const { before, limit = 50 } = req.query;

    const { data: channel, error: cErr } = await supabase
      .from("server_channels")
      .select("id, server_id, type")
      .eq("id", channelId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!channel) return res.status(404).json({ error: "Channel not found." });
    if (channel.type !== "text") {
      return res.status(400).json({ error: "Only text channels have message history.", code: "NOT_TEXT_CHANNEL" });
    }

    const channelPerms = await resolveChannelPermissions(
      supabase,
      serverId,
      req.user.id,
      channelId
    );
    if (!channelPerms.isMember) {
      return res.status(403).json({ error: "You are not a member of this server." });
    }
    if (!hasPermission(channelPerms.bits, Permissions.VIEW_CHANNEL)) {
      return res.status(403).json({ error: "Missing permission.", code: "MISSING_PERMISSION" });
    }
    if (!hasPermission(channelPerms.bits, Permissions.READ_MESSAGE_HISTORY)) {
      return res.json({ messages: [] });
    }

    let query = supabase
      .from("server_messages")
      .select(
        `
        *,
        sender:sender_id (id, username, display_name, avatar_url)
      `
      )
      .eq("channel_id", channelId)
      .eq("server_id", serverId)
      .order("created_at", { ascending: false })
      .limit(Math.min(100, Math.max(1, parseInt(limit, 10) || 50)));

    if (before) query = query.lt("created_at", before);

    const { data: messages, error } = await query;
    if (error) throw error;

    const senderIds = [...new Set((messages || []).map((m) => m.sender_id || m.sender?.id).filter(Boolean))];
    try {
      const { ensureCosmeticsCached, getCachedPublicUser, cacheUserProfile } = require("../lib/userProfile");
      for (const m of messages || []) {
        if (m.sender) cacheUserProfile({ ...m.sender, avatar_url: m.sender.avatar_url || m.sender.avatarUrl });
      }
      await ensureCosmeticsCached(senderIds);
      for (const m of messages || []) {
        const pub = getCachedPublicUser(m.sender_id || m.sender?.id);
        if (pub && m.sender) {
          m.sender = {
            ...m.sender,
            ...pub,
            id: m.sender.id || pub.id,
            username: m.sender.username || pub.username,
          };
          m.from = m.sender;
        }
      }
    } catch (err) {
      console.warn("[SERVERS] cosmetics enrich failed:", err?.message || err);
    }

    return res.json({ messages: (messages || []).reverse() });
  } catch (err) {
    console.error("[SERVERS] GET channel messages error:", err);
    return res.status(500).json({ error: "Failed to load messages." });
  }
});

/**
 * GET /servers/:id/members — basic member list (skeleton for later UI)
 */
router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await getMembership(serverId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this server." });
    }

    const { data: members, error } = await supabase
      .from("server_members")
      .select("user_id, nickname, joined_at, list_position, timeout_until, timeout_reason, timed_out_by")
      .eq("server_id", serverId)
      .order("joined_at", { ascending: true });
    if (error) throw error;

    const userIds = (members || []).map((m) => m.user_id);
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    if (uErr) throw uErr;

    const { data: server } = await supabase
      .from("servers")
      .select("owner_id")
      .eq("id", serverId)
      .maybeSingle();

    const { data: memberRoles } = await supabase
      .from("server_member_roles")
      .select("user_id, role_id")
      .eq("server_id", serverId);

    const { data: roles } = await supabase
      .from("server_roles")
      .select("id, position")
      .eq("server_id", serverId);
    const rolePos = new Map((roles || []).map((r) => [String(r.id), Number(r.position) || 0]));

    const rolesByUser = new Map();
    for (const row of memberRoles || []) {
      if (!rolesByUser.has(row.user_id)) rolesByUser.set(row.user_id, []);
      rolesByUser.get(row.user_id).push(row.role_id);
    }

    const byId = new Map((users || []).map((u) => [u.id, u]));
    const list = (members || []).map((m) => {
      const u = byId.get(m.user_id) || {};
      const roleIds = rolesByUser.get(m.user_id) || [];
      const highestPosition = roleIds.reduce(
        (top, roleId) => Math.max(top, rolePos.get(String(roleId)) || 0),
        0
      );
      return {
        userId: m.user_id,
        username: u.username || null,
        displayName: u.display_name || null,
        avatarUrl: u.avatar_url || null,
        nickname: m.nickname || null,
        joinedAt: m.joined_at,
        timeoutUntil: m.timeout_until || null,
        timeoutReason: m.timeout_reason || null,
        timedOutBy: m.timed_out_by || null,
        isOwner: server?.owner_id === m.user_id,
        highestPosition,
        roleIds,
      };
    });

    return res.json({ members: list });
  } catch (err) {
    console.error("[SERVERS] GET /:id/members error:", err);
    return res.status(500).json({ error: "Failed to load members." });
  }
});

/**
 * GET /servers/:id/roles
 */
router.get("/:id/roles", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await getMembership(serverId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this server." });
    }
    const { data: roles, error } = await supabase
      .from("server_roles")
      .select("*")
      .eq("server_id", serverId)
      .order("position", { ascending: false });
    if (error) throw error;
    return res.json({
      roles: (roles || []).map(publicRole),
      editablePermissions: EDITABLE_PERMISSION_KEYS,
    });
  } catch (err) {
    console.error("[SERVERS] GET /:id/roles error:", err);
    return res.status(500).json({ error: "Failed to load roles." });
  }
});

/**
 * POST /servers/:id/roles — create role (owner only)
 */
router.post("/:id/roles", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const actorPerms = await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

    const name = cleanName(req.body?.name);
    if (name.length < ROLE_NAME_MIN || name.length > ROLE_NAME_MAX) {
      return res.status(400).json({ error: `Role name must be ${ROLE_NAME_MIN}–${ROLE_NAME_MAX} characters.` });
    }
    if (name.toLowerCase() === "@everyone") {
      return res.status(400).json({ error: "Cannot create another @everyone role." });
    }

    const { count, error: countErr } = await supabase
      .from("server_roles")
      .select("id", { count: "exact", head: true })
      .eq("server_id", serverId);
    if (countErr) throw countErr;
    if ((count || 0) >= MAX_ROLES_PER_SERVER) {
      return res.status(400).json({
        error: `Servers can have at most ${MAX_ROLES_PER_SERVER} roles.`,
        code: "MAX_ROLES",
      });
    }

    const { data: top } = await supabase
      .from("server_roles")
      .select("position")
      .eq("server_id", serverId)
      .order("position", { ascending: false })
      .limit(1);
    let position =
      typeof req.body?.position === "number" && Number.isFinite(req.body.position)
        ? Math.max(0, Math.floor(req.body.position))
        : (top?.[0]?.position ?? 0) + 1;
    if (!actorPerms.isOwner) {
      const actorPos = await getMemberHighestPosition(supabase, serverId, req.user.id);
      if (actorPos <= 0) {
        return res.status(403).json({ error: "You need a higher role to create roles.", code: "HIERARCHY" });
      }
      position = Math.min(position, actorPos - 1);
    }

    const color = clampColor(req.body?.color ?? 0x5865f2);
    const perms = parsePermissionsInput(req.body?.permissions);
    const permissions = toPgBigint(perms != null ? perms : EVERYONE_DEFAULT);

    const { data: role, error } = await supabase
      .from("server_roles")
      .insert({
        server_id: serverId,
        name,
        color,
        position,
        permissions,
        hoist: Boolean(req.body?.hoist),
        mentionable: Boolean(req.body?.mentionable),
        is_everyone: false,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "ROLE_CREATE",
      targetType: "role",
      targetId: role.id,
      changes: { name, color, position },
    });

    return res.status(201).json({ role: publicRole(role) });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] POST /:id/roles error:", err);
    return res.status(status).json({ error: err.message || "Failed to create role.", code: err.code });
  }
});

/**
 * PATCH /servers/:id/roles/:roleId
 */
router.patch("/:id/roles/:roleId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const roleId = req.params.roleId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

    const { data: existing, error: findErr } = await supabase
      .from("server_roles")
      .select("*")
      .eq("id", roleId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "Role not found." });
    await assertCanManageRole(supabase, serverId, req.user.id, existing);

    const patch = {};
    if (req.body?.name != null) {
      if (existing.is_everyone) {
        return res.status(400).json({ error: "@everyone cannot be renamed.", code: "EVERYONE_LOCKED" });
      }
      const name = cleanName(req.body.name);
      if (name.length < ROLE_NAME_MIN || name.length > ROLE_NAME_MAX) {
        return res.status(400).json({ error: "Invalid role name." });
      }
      patch.name = name;
    }
    if (req.body?.color !== undefined) patch.color = clampColor(req.body.color);
    if (typeof req.body?.position === "number" && Number.isFinite(req.body.position)) {
      patch.position = Math.max(0, Math.floor(req.body.position));
    }
    if (req.body?.hoist !== undefined) patch.hoist = Boolean(req.body.hoist);
    if (req.body?.mentionable !== undefined) patch.mentionable = Boolean(req.body.mentionable);
    if (req.body?.permissions !== undefined) {
      const perms = parsePermissionsInput(req.body.permissions);
      if (perms == null) return res.status(400).json({ error: "Invalid permissions." });
      patch.permissions = toPgBigint(perms);
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }
    if (patch.position != null) {
      await assertCanManageRole(supabase, serverId, req.user.id, {
        ...existing,
        position: patch.position,
      });
    }

    const { data: role, error } = await supabase
      .from("server_roles")
      .update(patch)
      .eq("id", roleId)
      .eq("server_id", serverId)
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "ROLE_UPDATE",
      targetType: "role",
      targetId: roleId,
      changes: patch,
    });

    return res.json({ role: publicRole(role) });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PATCH /:id/roles/:roleId error:", err);
    return res.status(status).json({ error: err.message || "Failed to update role.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/roles/:roleId — @everyone protected
 */
router.delete("/:id/roles/:roleId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const roleId = req.params.roleId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

    const { data: existing, error: findErr } = await supabase
      .from("server_roles")
      .select("*")
      .eq("id", roleId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "Role not found." });
    if (existing.is_everyone) {
      return res.status(400).json({ error: "@everyone cannot be deleted.", code: "EVERYONE_LOCKED" });
    }
    await assertCanManageRole(supabase, serverId, req.user.id, existing);

    const { error } = await supabase
      .from("server_roles")
      .delete()
      .eq("id", roleId)
      .eq("server_id", serverId);
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "ROLE_DELETE",
      targetType: "role",
      targetId: roleId,
      changes: { name: existing.name },
    });

    return res.json({ message: "Role deleted.", roleId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] DELETE /:id/roles/:roleId error:", err);
    return res.status(status).json({ error: err.message || "Failed to delete role.", code: err.code });
  }
});

/**
 * PUT /servers/:id/members/:userId/roles/:roleId — assign role
 */
router.put("/:id/members/:userId/roles/:roleId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const userId = req.params.userId;
    const roleId = req.params.roleId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

    const targetMembership = await getMembership(serverId, userId);
    if (!targetMembership) {
      return res.status(404).json({ error: "Member not found in this server." });
    }

    const { data: role, error: rErr } = await supabase
      .from("server_roles")
      .select("*")
      .eq("id", roleId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!role) return res.status(404).json({ error: "Role not found." });
    if (role.is_everyone) {
      return res.status(400).json({ error: "@everyone is automatic and cannot be assigned." });
    }
    await assertCanManageRole(supabase, serverId, req.user.id, role);
    await assertHierarchy(supabase, serverId, req.user.id, userId);

    const { error } = await supabase.from("server_member_roles").upsert(
      { server_id: serverId, user_id: userId, role_id: roleId },
      { onConflict: "server_id,user_id,role_id" }
    );
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "MEMBER_ROLE_ADD",
      targetType: "member",
      targetId: userId,
      changes: { roleId, roleName: role.name },
    });

    return res.json({ message: "Role assigned.", userId, roleId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PUT member role error:", err);
    return res.status(status).json({ error: err.message || "Failed to assign role.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/members/:userId/roles/:roleId — remove role
 */
router.delete("/:id/members/:userId/roles/:roleId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const userId = req.params.userId;
    const roleId = req.params.roleId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

    const { data: role } = await supabase
      .from("server_roles")
      .select("id, name, is_everyone, position")
      .eq("id", roleId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (!role) return res.status(404).json({ error: "Role not found." });
    if (role.is_everyone) {
      return res.status(400).json({ error: "@everyone cannot be removed." });
    }
    await assertCanManageRole(supabase, serverId, req.user.id, role);
    await assertHierarchy(supabase, serverId, req.user.id, userId);

    const { error } = await supabase
      .from("server_member_roles")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", userId)
      .eq("role_id", roleId);
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "MEMBER_ROLE_REMOVE",
      targetType: "member",
      targetId: userId,
      changes: { roleId, roleName: role.name },
    });

    return res.json({ message: "Role removed.", userId, roleId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] DELETE member role error:", err);
    return res.status(status).json({ error: err.message || "Failed to remove role.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/members/:userId — kick member (KICK_MEMBERS)
 * Cannot kick the owner or yourself (use leave).
 */
router.delete("/:id/members/:userId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;
    const { server } = await requireServerPermission(serverId, req.user.id, Permissions.KICK_MEMBERS);

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: "Use leave to remove yourself.", code: "USE_LEAVE" });
    }
    if (server.owner_id === targetUserId) {
      return res.status(403).json({ error: "Cannot kick the server owner.", code: "CANNOT_KICK_OWNER" });
    }

    const targetMembership = await getMembership(serverId, targetUserId);
    if (!targetMembership) {
      return res.status(404).json({ error: "Member not found in this server." });
    }
    await assertHierarchy(supabase, serverId, req.user.id, targetUserId);

    const { error: delErr } = await supabase
      .from("server_members")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", targetUserId);
    if (delErr) throw delErr;

    await supabase
      .from("server_member_roles")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", targetUserId);

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "MEMBER_KICK",
      targetType: "member",
      targetId: targetUserId,
      reason: req.body?.reason ? String(req.body.reason).slice(0, 200) : null,
    });

    notifyServerMemberRemoved(req, {
      serverId,
      serverName: server.name,
      targetUserId,
      action: "kick",
      reason: req.body?.reason ? String(req.body.reason).slice(0, 200) : null,
      actorId: req.user.id,
    });

    return res.json({ message: "Member kicked.", userId: targetUserId, serverId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] DELETE member kick error:", err);
    return res.status(status).json({ error: err.message || "Failed to kick member.", code: err.code });
  }
});

/**
 * PATCH /servers/:id/members/:userId/nickname
 * Self requires CHANGE_NICKNAME. Managing others requires MANAGE_NICKNAMES + hierarchy.
 */
router.patch("/:id/members/:userId/nickname", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;
    const isSelf = String(targetUserId) === String(req.user.id);
    const nicknameRaw = req.body?.nickname;
    const nickname =
      nicknameRaw == null || String(nicknameRaw).trim() === ""
        ? null
        : String(nicknameRaw).trim().replace(/\s+/g, " ").slice(0, 32);

    const targetMembership = await getMembership(serverId, targetUserId);
    if (!targetMembership) {
      return res.status(404).json({ error: "Member not found in this server." });
    }

    if (isSelf) {
      await requireServerPermission(serverId, req.user.id, Permissions.CHANGE_NICKNAME);
    } else {
      await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_NICKNAMES);
      await assertHierarchy(supabase, serverId, req.user.id, targetUserId);
    }

    const member = await updateMemberNickname({
      serverId,
      actorId: req.user.id,
      targetUserId,
      nickname,
    });

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: isSelf ? "MEMBER_NICKNAME_SELF" : "MEMBER_NICKNAME_UPDATE",
      targetType: "member",
      targetId: targetUserId,
      changes: { nickname },
    });

    return res.json({
      member: {
        serverId: member.server_id,
        userId: member.user_id,
        nickname: member.nickname || null,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PATCH nickname error:", err);
    return res.status(status).json({ error: err.message || "Failed to update nickname.", code: err.code });
  }
});

/**
 * POST /servers/:id/members/:userId/timeout
 * Body: { until?: ISO timestamp, durationSeconds?: number, reason?: string }
 */
router.post("/:id/members/:userId/timeout", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;
    await requireServerPermission(serverId, req.user.id, Permissions.MODERATE_MEMBERS);

    if (String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ error: "You cannot timeout yourself.", code: "CANNOT_TIMEOUT_SELF" });
    }
    const targetMembership = await getMembership(serverId, targetUserId);
    if (!targetMembership) {
      return res.status(404).json({ error: "Member not found in this server." });
    }

    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 512) : null;
    const timeout = await applyServerTimeout({
      serverId,
      actorId: req.user.id,
      targetUserId,
      until: req.body?.until,
      durationSeconds: req.body?.durationSeconds,
      reason,
    });

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "MEMBER_TIMEOUT",
      targetType: "member",
      targetId: targetUserId,
      reason,
      changes: { until: timeout.until },
    });

    return res.json({
      timeout: {
        userId: targetUserId,
        until: timeout.until,
        reason: timeout.reason,
        timedOutBy: timeout.timedOutBy,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] POST timeout error:", err);
    return res.status(status).json({ error: err.message || "Failed to timeout member.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/members/:userId/timeout — clear active timeout.
 */
router.delete("/:id/members/:userId/timeout", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;
    await requireServerPermission(serverId, req.user.id, Permissions.MODERATE_MEMBERS);

    if (String(targetUserId) === String(req.user.id)) {
      return res.status(400).json({ error: "You cannot remove your own timeout.", code: "CANNOT_TIMEOUT_SELF" });
    }
    const targetMembership = await getMembership(serverId, targetUserId);
    if (!targetMembership) {
      return res.status(404).json({ error: "Member not found in this server." });
    }

    await clearServerTimeout({ serverId, actorId: req.user.id, targetUserId });
    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "MEMBER_TIMEOUT_CLEAR",
      targetType: "member",
      targetId: targetUserId,
    });

    return res.json({ message: "Timeout removed.", userId: targetUserId, serverId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] DELETE timeout error:", err);
    return res.status(status).json({ error: err.message || "Failed to remove timeout.", code: err.code });
  }
});

/**
 * PATCH /servers/:id/me/settings — per-server notification level (All / Mentions / Nothing).
 */
router.patch("/:id/me/settings", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await getMembership(serverId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this server.", code: "NOT_MEMBER" });
    }
    const level = String(req.body?.notificationLevel || "").toLowerCase();
    if (!["all", "mentions", "muted"].includes(level)) {
      return res.status(400).json({
        error: "notificationLevel must be all, mentions, or muted.",
        code: "INVALID_NOTIFICATION_LEVEL",
      });
    }
    const { data: updated, error } = await supabase
      .from("server_members")
      .update({ notification_level: level })
      .eq("server_id", serverId)
      .eq("user_id", req.user.id)
      .select("notification_level, rules_accepted_at")
      .single();
    if (error) throw error;
    return res.json({
      serverId,
      notificationLevel: updated?.notification_level || level,
      rulesAcceptedAt: updated?.rules_accepted_at || null,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PATCH me/settings error:", err);
    return res.status(status).json({ error: err.message || "Failed to update settings." });
  }
});

/**
 * POST /servers/:id/accept-rules — community onboarding / rules screen accept.
 */
router.post("/:id/accept-rules", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const membership = await getMembership(serverId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this server.", code: "NOT_MEMBER" });
    }
    const { data: server, error: sErr } = await supabase
      .from("servers")
      .select("id, community_enabled, rules_text")
      .eq("id", serverId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!server) return res.status(404).json({ error: "Server not found." });

    const acceptedAt = membership.rules_accepted_at || new Date().toISOString();
    if (!membership.rules_accepted_at) {
      const { error } = await supabase
        .from("server_members")
        .update({ rules_accepted_at: acceptedAt })
        .eq("server_id", serverId)
        .eq("user_id", req.user.id);
      if (error) throw error;
    }

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "RULES_ACCEPT",
      targetType: "member",
      targetId: req.user.id,
    });

    return res.json({
      serverId,
      rulesAcceptedAt: acceptedAt,
      communityEnabled: Boolean(server.community_enabled),
      hasRules: Boolean(server.rules_text),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] POST accept-rules error:", err);
    return res.status(status).json({ error: err.message || "Failed to accept rules." });
  }
});

/**
 * GET /servers/:id/bans — list bans (BAN_MEMBERS)
 */
router.get("/:id/bans", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    await requireServerPermission(serverId, req.user.id, Permissions.BAN_MEMBERS);

    const { data: bans, error } = await supabase
      .from("server_bans")
      .select("server_id, user_id, moderator_id, reason, created_at")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const userIds = [
      ...new Set(
        (bans || []).flatMap((b) => [b.user_id, b.moderator_id].filter(Boolean))
      ),
    ];
    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((users || []).map((u) => [u.id, u]));

    return res.json({
      bans: (bans || []).map((b) => {
        const user = byId.get(b.user_id) || {};
        const mod = byId.get(b.moderator_id) || {};
        return {
          userId: b.user_id,
          username: user.username || null,
          displayName: user.display_name || null,
          avatarUrl: user.avatar_url || null,
          reason: b.reason || null,
          createdAt: b.created_at,
          moderatorId: b.moderator_id || null,
          moderatorUsername: mod.username || null,
          moderatorDisplayName: mod.display_name || null,
        };
      }),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] GET /:id/bans error:", err);
    return res.status(status).json({ error: err.message || "Failed to list bans.", code: err.code });
  }
});

/**
 * PUT /servers/:id/bans/:userId — ban member (BAN_MEMBERS)
 * Removes membership + roles and blocks rejoin.
 */
router.put("/:id/bans/:userId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;
    const { server } = await requireServerPermission(serverId, req.user.id, Permissions.BAN_MEMBERS);
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 200) : null;

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: "You cannot ban yourself.", code: "CANNOT_BAN_SELF" });
    }
    if (server.owner_id === targetUserId) {
      return res.status(403).json({ error: "Cannot ban the server owner.", code: "CANNOT_BAN_OWNER" });
    }
    const targetMembership = await getMembership(serverId, targetUserId);
    if (targetMembership) {
      await assertHierarchy(supabase, serverId, req.user.id, targetUserId);
    }

    const { error: banErr } = await supabase.from("server_bans").upsert(
      {
        server_id: serverId,
        user_id: targetUserId,
        moderator_id: req.user.id,
        reason,
        created_at: new Date().toISOString(),
      },
      { onConflict: "server_id,user_id" }
    );
    if (banErr) throw banErr;

    await supabase.from("server_members").delete().eq("server_id", serverId).eq("user_id", targetUserId);
    await supabase
      .from("server_member_roles")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", targetUserId);

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "MEMBER_BAN",
      targetType: "member",
      targetId: targetUserId,
      reason,
    });

    notifyServerMemberRemoved(req, {
      serverId,
      serverName: server.name,
      targetUserId,
      action: "ban",
      reason,
      actorId: req.user.id,
    });

    return res.json({ message: "Member banned.", userId: targetUserId, serverId, reason });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PUT ban error:", err);
    return res.status(status).json({ error: err.message || "Failed to ban member.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/bans/:userId — unban (BAN_MEMBERS)
 */
router.delete("/:id/bans/:userId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const targetUserId = req.params.userId;
    await requireServerPermission(serverId, req.user.id, Permissions.BAN_MEMBERS);

    const { data: existing } = await supabase
      .from("server_bans")
      .select("user_id")
      .eq("server_id", serverId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!existing) {
      return res.status(404).json({ error: "Ban not found." });
    }

    const { error } = await supabase
      .from("server_bans")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", targetUserId);
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "MEMBER_UNBAN",
      targetType: "member",
      targetId: targetUserId,
    });

    return res.json({ message: "Member unbanned.", userId: targetUserId, serverId });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] DELETE ban error:", err);
    return res.status(status).json({ error: err.message || "Failed to unban member.", code: err.code });
  }
});

/**
 * GET /servers/:id/audit-logs — recent audit entries (VIEW_AUDIT_LOG)
 */
router.get("/:id/audit-logs", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    await requireServerPermission(serverId, req.user.id, Permissions.VIEW_AUDIT_LOG);

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const { data: rows, error } = await supabase
      .from("server_audit_logs")
      .select("id, server_id, actor_id, action, target_type, target_id, changes, reason, created_at")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const actorIds = [...new Set((rows || []).map((r) => r.actor_id).filter(Boolean))];
    const { data: users } = await supabase
      .from("users")
      .select("id, username, display_name, avatar_url")
      .in("id", actorIds.length ? actorIds : ["00000000-0000-0000-0000-000000000000"]);
    const byId = new Map((users || []).map((u) => [u.id, u]));

    return res.json({
      logs: (rows || []).map((r) => {
        const actor = byId.get(r.actor_id) || {};
        return {
          id: r.id,
          action: r.action,
          targetType: r.target_type,
          targetId: r.target_id,
          changes: r.changes,
          reason: r.reason,
          createdAt: r.created_at,
          actorId: r.actor_id,
          actorUsername: actor.username || null,
          actorDisplayName: actor.display_name || null,
          actorAvatarUrl: actor.avatar_url || null,
        };
      }),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] GET audit-logs error:", err);
    return res.status(status).json({ error: err.message || "Failed to load audit log.", code: err.code });
  }
});

/**
 * POST /servers/:id/channels
 * Create text | voice | category. Owner or MANAGE_CHANNELS.
 */
router.post("/:id/channels", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const type = String(req.body?.type || "text").toLowerCase();
    if (!CHANNEL_TYPES.has(type)) {
      return res.status(400).json({ error: "Channel type must be text, voice, stage, or category." });
    }

    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_CHANNELS);

    const name = cleanChannelName(req.body?.name, type);
    if (name.length < CHANNEL_NAME_MIN) {
      return res.status(400).json({
        error: `Channel name must be ${CHANNEL_NAME_MIN}–${CHANNEL_NAME_MAX} characters.`,
      });
    }

    const { count, error: countErr } = await supabase
      .from("server_channels")
      .select("id", { count: "exact", head: true })
      .eq("server_id", serverId);
    if (countErr) throw countErr;
    if ((count || 0) >= MAX_CHANNELS_PER_SERVER) {
      return res.status(400).json({
        error: `Servers can have at most ${MAX_CHANNELS_PER_SERVER} channels.`,
        code: "MAX_CHANNELS",
      });
    }

    const parentId = req.body?.parentId || null;
    await assertValidParent(serverId, parentId, type);

    const topic =
      type === "text" && req.body?.topic != null
        ? String(req.body.topic).trim().slice(0, 1024) || null
        : null;
    const slowmodeSeconds =
      type === "text" && typeof req.body?.slowmodeSeconds === "number"
        ? Math.max(0, Math.min(21600, Math.floor(req.body.slowmodeSeconds)))
        : 0;

    const position =
      typeof req.body?.position === "number" && Number.isFinite(req.body.position)
        ? Math.max(0, Math.floor(req.body.position))
        : await nextChannelPosition(serverId);

    const { data: channel, error } = await supabase
      .from("server_channels")
      .insert({
        server_id: serverId,
        name,
        type,
        topic,
        position,
        parent_id: type === "category" ? null : parentId,
        slowmode_seconds: slowmodeSeconds,
        nsfw: false,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "CHANNEL_CREATE",
      targetType: "channel",
      targetId: channel.id,
      changes: { name, type, parentId: channel.parent_id },
    });

    return res.status(201).json({ channel: publicChannel(channel) });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] POST /:id/channels error:", err);
    return res.status(status).json({ error: err.message || "Failed to create channel.", code: err.code });
  }
});

/**
 * PATCH /servers/:id/channels/:channelId
 * Rename / topic / parent / position. Owner only.
 */
router.patch("/:id/channels/:channelId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const channelId = req.params.channelId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_CHANNELS);

    const { data: existing, error: findErr } = await supabase
      .from("server_channels")
      .select("*")
      .eq("id", channelId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "Channel not found." });

    const patch = {};
    if (req.body?.name != null) {
      const name = cleanChannelName(req.body.name, existing.type);
      if (name.length < CHANNEL_NAME_MIN) {
        return res.status(400).json({ error: "Channel name is required." });
      }
      patch.name = name;
    }
    if (req.body?.topic !== undefined && existing.type === "text") {
      patch.topic = req.body.topic == null ? null : String(req.body.topic).trim().slice(0, 1024) || null;
    }
    if (req.body?.parentId !== undefined) {
      const parentId = req.body.parentId || null;
      await assertValidParent(serverId, parentId, existing.type);
      patch.parent_id = existing.type === "category" ? null : parentId;
    }
    if (typeof req.body?.position === "number" && Number.isFinite(req.body.position)) {
      patch.position = Math.max(0, Math.floor(req.body.position));
    }
    if (req.body?.nsfw !== undefined && existing.type === "text") {
      patch.nsfw = Boolean(req.body.nsfw);
    }
    if (typeof req.body?.slowmodeSeconds === "number" && existing.type === "text") {
      patch.slowmode_seconds = Math.max(0, Math.min(21600, Math.floor(req.body.slowmodeSeconds)));
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const { data: channel, error } = await supabase
      .from("server_channels")
      .update(patch)
      .eq("id", channelId)
      .eq("server_id", serverId)
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "CHANNEL_UPDATE",
      targetType: "channel",
      targetId: channelId,
      changes: patch,
    });

    return res.json({ channel: publicChannel(channel) });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PATCH /:id/channels/:channelId error:", err);
    return res.status(status).json({ error: err.message || "Failed to update channel.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/channels/:channelId
 * Categories: children are unparented (ON DELETE SET NULL), then category removed.
 */
router.delete("/:id/channels/:channelId", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const channelId = req.params.channelId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_CHANNELS);

    const { data: existing, error: findErr } = await supabase
      .from("server_channels")
      .select("*")
      .eq("id", channelId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "Channel not found." });

    if (existing.type === "category") {
      await supabase
        .from("server_channels")
        .update({ parent_id: null })
        .eq("server_id", serverId)
        .eq("parent_id", channelId);
    }

    const { error } = await supabase
      .from("server_channels")
      .delete()
      .eq("id", channelId)
      .eq("server_id", serverId);
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "CHANNEL_DELETE",
      targetType: "channel",
      targetId: channelId,
      changes: { name: existing.name, type: existing.type },
    });

    return res.json({ message: "Channel deleted.", channelId, type: existing.type });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] DELETE /:id/channels/:channelId error:", err);
    return res.status(status).json({ error: err.message || "Failed to delete channel.", code: err.code });
  }
});

/**
 * GET /servers/:id/channels/:channelId/overrides
 */
router.get("/:id/channels/:channelId/overrides", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const channelId = req.params.channelId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

    const { data: channel, error: cErr } = await supabase
      .from("server_channels")
      .select("id, server_id, type, name")
      .eq("id", channelId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!channel) return res.status(404).json({ error: "Channel not found." });

    const { data: rows, error } = await supabase
      .from("server_channel_overrides")
      .select("*")
      .eq("channel_id", channelId);
    if (error) throw error;

    const overrides = (rows || []).map((row) => ({
      id: row.id,
      channelId: row.channel_id,
      targetType: row.target_type,
      targetId: row.target_id,
      allow: permissionsToFlags(fromPgBigint(row.allow_permissions)),
      deny: permissionsToFlags(fromPgBigint(row.deny_permissions)),
      allowBits: String(fromPgBigint(row.allow_permissions)),
      denyBits: String(fromPgBigint(row.deny_permissions)),
    }));

    return res.json({
      channelId,
      channelType: channel.type,
      editableKeys: CHANNEL_OVERRIDE_KEYS[channel.type] || CHANNEL_OVERRIDE_KEYS.text,
      overrides,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] GET overrides error:", err);
    return res.status(status).json({ error: err.message || "Failed to load overrides.", code: err.code });
  }
});

/**
 * PUT /servers/:id/channels/:channelId/overrides
 * Body: { targetType: 'role'|'member', targetId, permissions: { VIEW_CHANNEL: 'allow'|'deny'|'inherit'|true|false|null } }
 */
router.put("/:id/channels/:channelId/overrides", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const channelId = req.params.channelId;
    await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

    const targetType = req.body?.targetType === "member" ? "member" : "role";
    const targetId = String(req.body?.targetId || "").trim();
    if (!targetId) return res.status(400).json({ error: "targetId is required." });

    const { data: channel, error: cErr } = await supabase
      .from("server_channels")
      .select("id, server_id, type, name")
      .eq("id", channelId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!channel) return res.status(404).json({ error: "Channel not found." });

    if (targetType === "role") {
      const { data: role } = await supabase
        .from("server_roles")
        .select("id")
        .eq("id", targetId)
        .eq("server_id", serverId)
        .maybeSingle();
      if (!role) return res.status(404).json({ error: "Role not found." });
    } else {
      const mem = await getMembership(serverId, targetId);
      if (!mem) return res.status(404).json({ error: "Member not found." });
    }

    const keys = CHANNEL_OVERRIDE_KEYS[channel.type] || CHANNEL_OVERRIDE_KEYS.text;
    const { allow, deny } = parseAllowDenyFlags(req.body?.permissions || req.body?.flags, keys);

    if (allow === 0n && deny === 0n) {
      await supabase
        .from("server_channel_overrides")
        .delete()
        .eq("channel_id", channelId)
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      await writeAudit({
        serverId,
        actorId: req.user.id,
        action: "CHANNEL_OVERRIDE_CLEAR",
        targetType: "channel",
        targetId: channelId,
        changes: { targetType, targetId },
      });
      return res.json({ cleared: true, channelId, targetType, targetId });
    }

    const { data: row, error } = await supabase
      .from("server_channel_overrides")
      .upsert(
        {
          channel_id: channelId,
          target_type: targetType,
          target_id: targetId,
          allow_permissions: toPgBigint(allow),
          deny_permissions: toPgBigint(deny),
        },
        { onConflict: "channel_id,target_type,target_id" }
      )
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "CHANNEL_OVERRIDE_SET",
      targetType: "channel",
      targetId: channelId,
      changes: {
        targetType,
        targetId,
        allow: String(allow),
        deny: String(deny),
      },
    });

    return res.json({
      override: {
        id: row.id,
        channelId: row.channel_id,
        targetType: row.target_type,
        targetId: row.target_id,
        allow: permissionsToFlags(fromPgBigint(row.allow_permissions)),
        deny: permissionsToFlags(fromPgBigint(row.deny_permissions)),
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PUT overrides error:", err);
    return res.status(status).json({ error: err.message || "Failed to save override.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/channels/:channelId/overrides/:targetType/:targetId
 */
router.delete(
  "/:id/channels/:channelId/overrides/:targetType/:targetId",
  requireAuth,
  async (req, res) => {
    try {
      const serverId = req.params.id;
      const channelId = req.params.channelId;
      const targetType = req.params.targetType === "member" ? "member" : "role";
      const targetId = req.params.targetId;
      await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_ROLES);

      const { error } = await supabase
        .from("server_channel_overrides")
        .delete()
        .eq("channel_id", channelId)
        .eq("target_type", targetType)
        .eq("target_id", targetId);
      if (error) throw error;

      await writeAudit({
        serverId,
        actorId: req.user.id,
        action: "CHANNEL_OVERRIDE_DELETE",
        targetType: "channel",
        targetId: channelId,
        changes: { targetType, targetId },
      });

      return res.json({ deleted: true });
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error("[SERVERS] DELETE overrides error:", err);
      return res
        .status(status)
        .json({ error: err.message || "Failed to delete override.", code: err.code });
    }
  }
);

/**
 * PATCH /servers/:id — owner or MANAGE_GUILD settings (name / icon / description / is_public)
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    let server;
    try {
      ({ server } = await requireServerOwner(serverId, req.user.id));
    } catch (ownerErr) {
      if (ownerErr.status !== 403) throw ownerErr;
      ({ server } = await requireServerPermission(serverId, req.user.id, Permissions.MANAGE_GUILD));
    }
    const patch = {};

    if (req.body?.name != null) {
      const name = cleanName(req.body.name);
      if (name.length < NAME_MIN || name.length > NAME_MAX) {
        return res.status(400).json({
          error: `Server name must be ${NAME_MIN}–${NAME_MAX} characters.`,
        });
      }
      patch.name = name;
    }
    if (req.body?.iconUrl !== undefined) {
      patch.icon_url = req.body.iconUrl ? String(req.body.iconUrl).trim().slice(0, 500) : null;
    }
    if (req.body?.description !== undefined) {
      patch.description = req.body.description
        ? String(req.body.description).trim().slice(0, 500)
        : null;
    }
    if (req.body?.isPublic !== undefined) {
      patch.is_public = Boolean(req.body.isPublic);
    }
    if (req.body?.communityEnabled !== undefined) {
      patch.community_enabled = Boolean(req.body.communityEnabled);
    }
    if (req.body?.rulesChannelId !== undefined) {
      patch.rules_channel_id = req.body.rulesChannelId || null;
    }
    if (req.body?.rulesText !== undefined) {
      patch.rules_text = req.body.rulesText
        ? String(req.body.rulesText).trim().slice(0, 4000)
        : null;
    }
    if (req.body?.splashUrl !== undefined) {
      patch.splash_url = req.body.splashUrl ? String(req.body.splashUrl).trim().slice(0, 500) : null;
    }
    if (req.body?.verificationLevel !== undefined) {
      const level = String(req.body.verificationLevel || "none").toLowerCase();
      if (!["none", "low", "medium", "high", "highest"].includes(level)) {
        return res.status(400).json({ error: "Invalid verification level." });
      }
      patch.verification_level = level;
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: "No changes provided." });
    }

    patch.updated_at = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from("servers")
      .update(patch)
      .eq("id", serverId)
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "SERVER_UPDATE",
      targetType: "server",
      targetId: serverId,
      changes: patch,
    });

    const membership = await getMembership(serverId, req.user.id);
    const bundle = await loadServerBundle(serverId);
    const myPermissions = await buildMyPermissionsPayload(serverId, req.user.id);

    return res.json({
      server: publicServer(updated || server, {
        isOwner: true,
        memberCount: bundle.memberCount,
        nickname: membership?.nickname || null,
        listPosition: membership?.list_position ?? 0,
        channels: bundle.channels.map(publicChannel),
        roles: bundle.roles.map(publicRole),
        myPermissions,
      }),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] PATCH /:id error:", err);
    return res.status(status).json({ error: err.message || "Failed to update server.", code: err.code });
  }
});

/**
 * POST /servers/:id/invites — create invite (CREATE_INSTANT_INVITE)
 */
router.post("/:id/invites", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    await requireServerPermission(serverId, req.user.id, Permissions.CREATE_INSTANT_INVITE);

    const maxUses =
      req.body?.maxUses == null || req.body.maxUses === "" || Number(req.body.maxUses) === 0
        ? null
        : Math.max(1, Math.min(100000, Math.floor(Number(req.body.maxUses))));
    const maxAgeSeconds =
      req.body?.maxAgeSeconds == null || Number(req.body.maxAgeSeconds) === 0
        ? null
        : Math.max(60, Math.min(60 * 60 * 24 * 30, Math.floor(Number(req.body.maxAgeSeconds))));
    // Default 7 days when neither explicit 0 (forever) nor a value is given
    const age =
      req.body?.maxAgeSeconds === 0 || req.body?.maxAgeSeconds === null
        ? null
        : maxAgeSeconds != null
          ? maxAgeSeconds
          : 60 * 60 * 24 * 7;

    let code = generateInviteCode();
    for (let i = 0; i < 6; i++) {
      const { data: existing } = await supabase
        .from("server_invites")
        .select("code")
        .eq("code", code)
        .maybeSingle();
      if (!existing) break;
      code = generateInviteCode();
    }

    const expiresAt = age ? new Date(Date.now() + age * 1000).toISOString() : null;

    const { data: invite, error } = await supabase
      .from("server_invites")
      .insert({
        code,
        server_id: serverId,
        creator_id: req.user.id,
        channel_id: req.body?.channelId || null,
        max_uses: maxUses,
        uses: 0,
        max_age_seconds: age,
        temporary: Boolean(req.body?.temporary),
        expires_at: expiresAt,
      })
      .select("*")
      .single();
    if (error) throw error;

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "INVITE_CREATE",
      targetType: "invite",
      targetId: code,
      changes: { maxUses, maxAgeSeconds: age },
    });

    return res.status(201).json({ invite: publicInvite(invite, req) });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] POST /:id/invites error:", err);
    return res.status(status).json({ error: err.message || "Failed to create invite.", code: err.code });
  }
});

/**
 * GET /servers/:id/invites — list invites
 */
router.get("/:id/invites", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    await requireServerPermission(serverId, req.user.id, Permissions.CREATE_INSTANT_INVITE);

    const { data: invites, error } = await supabase
      .from("server_invites")
      .select("*")
      .eq("server_id", serverId)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const live = [];
    for (const invite of invites || []) {
      if (isInviteExpired(invite)) {
        await supabase.from("server_invites").delete().eq("code", invite.code);
        continue;
      }
      live.push(publicInvite(invite, req));
    }

    return res.json({ invites: live });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] GET /:id/invites error:", err);
    return res.status(status).json({ error: err.message || "Failed to list invites.", code: err.code });
  }
});

/**
 * DELETE /servers/:id/invites/:code — revoke invite
 */
router.delete("/:id/invites/:code", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const code = String(req.params.code || "").trim();
    await requireServerPermission(serverId, req.user.id, Permissions.CREATE_INSTANT_INVITE);

    const { data: invite } = await supabase
      .from("server_invites")
      .select("code, server_id")
      .eq("code", code)
      .eq("server_id", serverId)
      .maybeSingle();
    if (!invite) return res.status(404).json({ error: "Invite not found." });

    await supabase.from("server_invites").delete().eq("code", code).eq("server_id", serverId);

    await writeAudit({
      serverId,
      actorId: req.user.id,
      action: "INVITE_DELETE",
      targetType: "invite",
      targetId: code,
    });

    return res.json({ message: "Invite revoked.", code });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[SERVERS] DELETE /:id/invites/:code error:", err);
    return res.status(status).json({ error: err.message || "Failed to revoke invite.", code: err.code });
  }
});

module.exports = router;
