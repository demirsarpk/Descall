"use strict";

/**
 * Descall Servers API — Steps 1–5
 * Create / list / get / delete / leave + channel CRUD + text chat history + roles
 * Ownership limit: max 10 servers owned per user (membership unlimited).
 * Channel/role manage: owner only until permission engine lands in Step 6.
 */

const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { EVERYONE_DEFAULT, toPgBigint, fromPgBigint, Permissions } = require("../lib/serverPermissions");

const router = express.Router();

const MAX_OWNED_SERVERS = 10;
const MAX_CHANNELS_PER_SERVER = 500;
const MAX_ROLES_PER_SERVER = 50;
const NAME_MIN = 2;
const NAME_MAX = 100;
const CHANNEL_NAME_MIN = 1;
const CHANNEL_NAME_MAX = 100;
const CHANNEL_TYPES = new Set(["text", "voice", "category"]);
const ROLE_NAME_MIN = 1;
const ROLE_NAME_MAX = 100;

/** Permission keys editable in Step 5 role UI (full engine in Step 6). */
const EDITABLE_PERMISSION_KEYS = [
  "VIEW_CHANNEL",
  "SEND_MESSAGES",
  "MANAGE_MESSAGES",
  "MANAGE_CHANNELS",
  "MANAGE_ROLES",
  "KICK_MEMBERS",
  "BAN_MEMBERS",
  "MENTION_EVERYONE",
  "CONNECT",
  "SPEAK",
  "MUTE_MEMBERS",
  "MOVE_MEMBERS",
  "ADMINISTRATOR",
];

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
    const err = new Error("Only the server owner can manage channels for now.");
    err.status = 403;
    err.code = "OWNER_REQUIRED";
    throw err;
  }
  return { server, membership };
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
    description: row.description || null,
    ownerId: row.owner_id,
    vanitySlug: row.vanity_slug || null,
    isPublic: Boolean(row.is_public),
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
    .select("server_id, user_id, nickname, list_position, joined_at")
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
 * GET /servers/my
 * Servers the user is a member of (owned + joined), ordered by list_position.
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: memberships, error } = await supabase
      .from("server_members")
      .select("server_id, nickname, list_position, joined_at")
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
        return publicServer(row, {
          nickname: m.nickname || null,
          listPosition: m.list_position ?? 0,
          joinedAt: m.joined_at,
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

    return res.json({
      server: publicServer(bundle.server, {
        isOwner: bundle.server.owner_id === req.user.id,
        memberCount: bundle.memberCount,
        nickname: membership.nickname || null,
        listPosition: membership.list_position ?? 0,
        joinedAt: membership.joined_at,
        channels: bundle.channels.map(publicChannel),
        roles: bundle.roles.map(publicRole),
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
 * Membership-gated history for text channels.
 */
router.get("/:id/channels/:channelId/messages", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const channelId = req.params.channelId;
    const { before, limit = 50 } = req.query;

    const membership = await getMembership(serverId, req.user.id);
    if (!membership) {
      return res.status(403).json({ error: "You are not a member of this server." });
    }

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
      .select("user_id, nickname, joined_at, list_position")
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

    const rolesByUser = new Map();
    for (const row of memberRoles || []) {
      if (!rolesByUser.has(row.user_id)) rolesByUser.set(row.user_id, []);
      rolesByUser.get(row.user_id).push(row.role_id);
    }

    const byId = new Map((users || []).map((u) => [u.id, u]));
    const list = (members || []).map((m) => {
      const u = byId.get(m.user_id) || {};
      return {
        userId: m.user_id,
        username: u.username || null,
        displayName: u.display_name || null,
        avatarUrl: u.avatar_url || null,
        nickname: m.nickname || null,
        joinedAt: m.joined_at,
        isOwner: server?.owner_id === m.user_id,
        roleIds: rolesByUser.get(m.user_id) || [],
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
    await requireServerOwner(serverId, req.user.id);

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
    const position =
      typeof req.body?.position === "number" && Number.isFinite(req.body.position)
        ? Math.max(0, Math.floor(req.body.position))
        : (top?.[0]?.position ?? 0) + 1;

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
    await requireServerOwner(serverId, req.user.id);

    const { data: existing, error: findErr } = await supabase
      .from("server_roles")
      .select("*")
      .eq("id", roleId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: "Role not found." });

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
    await requireServerOwner(serverId, req.user.id);

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
    await requireServerOwner(serverId, req.user.id);

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
    await requireServerOwner(serverId, req.user.id);

    const { data: role } = await supabase
      .from("server_roles")
      .select("id, name, is_everyone")
      .eq("id", roleId)
      .eq("server_id", serverId)
      .maybeSingle();
    if (!role) return res.status(404).json({ error: "Role not found." });
    if (role.is_everyone) {
      return res.status(400).json({ error: "@everyone cannot be removed." });
    }

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
 * POST /servers/:id/channels
 * Create text | voice | category. Owner only (Step 3).
 */
router.post("/:id/channels", requireAuth, async (req, res) => {
  try {
    const serverId = req.params.id;
    const type = String(req.body?.type || "text").toLowerCase();
    if (!CHANNEL_TYPES.has(type)) {
      return res.status(400).json({ error: "Channel type must be text, voice, or category." });
    }

    await requireServerOwner(serverId, req.user.id);

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
        slowmode_seconds: 0,
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
    await requireServerOwner(serverId, req.user.id);

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
    await requireServerOwner(serverId, req.user.id);

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

module.exports = router;
