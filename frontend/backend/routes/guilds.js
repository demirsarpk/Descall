"use strict";

const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const { socketToUser } = require("../runtime/sharedState");

const router = express.Router();
const INVITE_CODE_LENGTH = 8;
const MAX_GUILD_NAME_LENGTH = 100;
const MAX_CHANNELS_PER_GUILD = 500;
const MAX_MEMBERS_PER_GUILD = 10000;

function generateInviteCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getUserSocketId(userId) {
  for (const [socketId, id] of socketToUser.entries()) {
    if (id === userId) return socketId;
  }
  return null;
}

// Helper: Check if user is a member of a guild
async function isGuildMember(guildId, userId) {
  const { data, error } = await supabase
    .from("guild_members")
    .select("guild_id")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .single();
  if (error || !data) return false;
  return true;
}

// Helper: Check if user is the guild owner
async function isGuildOwner(guildId, userId) {
  const { data, error } = await supabase
    .from("guilds")
    .select("owner_id")
    .eq("id", guildId)
    .single();
  if (error || !data) return false;
  return data.owner_id === userId;
}

// Helper: Fetch full guild payload with channels and members
async function fetchGuildPayload(guildId) {
  const { data: guild, error: guildError } = await supabase
    .from("guilds")
    .select("id, name, icon_url, owner_id, created_at")
    .eq("id", guildId)
    .single();
  if (guildError || !guild) return null;

  const { data: channels } = await supabase
    .from("guild_channels")
    .select("id, name, type, position, parent_id")
    .eq("guild_id", guildId)
    .order("position", { ascending: true });

  const { data: members } = await supabase
    .from("guild_members")
    .select("user_id, nickname, joined_at")
    .eq("guild_id", guildId);

  const memberUserIds = members?.map((m) => m.user_id) || [];
  let memberUsers = [];
  if (memberUserIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, username, avatar_url, status")
      .in("id", memberUserIds);
    memberUsers = users || [];
  }

  const enrichedMembers = members?.map((m) => {
    const user = memberUsers.find((u) => u.id === m.user_id);
    return { ...m, user: user || { id: m.user_id, username: "Unknown" } };
  }) || [];

  return { ...guild, channels: channels || [], members: enrichedMembers };
}

// GET /guilds/my — List guilds the current user is a member of
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: memberships, error: membershipError } = await supabase
      .from("guild_members")
      .select("guild_id, joined_at")
      .eq("user_id", userId);

    if (membershipError) {
      console.error("[Guilds] Membership error:", membershipError);
      return res.status(500).json({ error: "Failed to fetch memberships" });
    }

    if (!memberships || memberships.length === 0) {
      return res.json({ guilds: [] });
    }

    const guildIds = memberships.map((m) => m.guild_id);

    const { data: guilds, error: guildsError } = await supabase
      .from("guilds")
      .select("id, name, icon_url, owner_id, created_at")
      .in("id", guildIds)
      .order("created_at", { ascending: false });

    if (guildsError) {
      console.error("[Guilds] Guilds fetch error:", guildsError);
      return res.status(500).json({ error: "Failed to fetch guilds" });
    }

    const guildsWithDetails = await Promise.all(
      (guilds || []).map(async (guild) => {
        const { data: memberCount } = await supabase
          .from("guild_members")
          .select("user_id", { count: "exact", head: true })
          .eq("guild_id", guild.id);

        const { data: channels } = await supabase
          .from("guild_channels")
          .select("id, name, type, position, parent_id")
          .eq("guild_id", guild.id)
          .order("position", { ascending: true });

        return {
          ...guild,
          memberCount: memberCount?.length || 0,
          channels: channels || [],
          isOwner: guild.owner_id === userId,
        };
      })
    );

    return res.json({ guilds: guildsWithDetails });
  } catch (err) {
    console.error("[Guilds] /my error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /guilds — Create a new guild
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, iconUrl } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Guild name is required" });
    }
    if (name.trim().length > MAX_GUILD_NAME_LENGTH) {
      return res.status(400).json({ error: `Guild name must be under ${MAX_GUILD_NAME_LENGTH} characters` });
    }

    const trimmedName = name.trim();

    // Create guild
    const { data: guild, error: guildError } = await supabase
      .from("guilds")
      .insert({ name: trimmedName, icon_url: iconUrl || null, owner_id: userId })
      .select()
      .single();

    if (guildError || !guild) {
      console.error("[Guilds] Create error:", guildError);
      return res.status(500).json({ error: "Failed to create guild" });
    }

    // Add owner as first member
    const { error: memberError } = await supabase
      .from("guild_members")
      .insert({ guild_id: guild.id, user_id: userId });

    if (memberError) {
      console.error("[Guilds] Member insert error:", memberError);
      // Rollback: delete guild
      await supabase.from("guilds").delete().eq("id", guild.id);
      return res.status(500).json({ error: "Failed to initialize guild membership" });
    }

    // Create default channels: text-general, voice-general
    const { error: channelError } = await supabase
      .from("guild_channels")
      .insert([
        { guild_id: guild.id, name: "general", type: "text", position: 0 },
        { guild_id: guild.id, name: "General", type: "voice", position: 1 },
      ]);

    if (channelError) {
      console.warn("[Guilds] Default channels error:", channelError);
      // Non-fatal
    }

    const payload = await fetchGuildPayload(guild.id);
    return res.status(201).json({ guild: payload });
  } catch (err) {
    console.error("[Guilds] POST / error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /guilds/:id — Get guild details (member only)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    const payload = await fetchGuildPayload(guildId);
    if (!payload) {
      return res.status(404).json({ error: "Guild not found" });
    }

    return res.json({ guild: payload });
  } catch (err) {
    console.error("[Guilds] GET /:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /guilds/:id — Delete guild (owner only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;

    const owner = await isGuildOwner(guildId, userId);
    if (!owner) {
      return res.status(403).json({ error: "Only the guild owner can delete the guild" });
    }

    const { error } = await supabase.from("guilds").delete().eq("id", guildId);
    if (error) {
      console.error("[Guilds] Delete error:", error);
      return res.status(500).json({ error: "Failed to delete guild" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[Guilds] DELETE /:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /guilds/:id/invites — Create an invite
router.post("/:id/invites", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;
    const { maxUses, expiresInHours } = req.body;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    const code = generateInviteCode();
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const { data: invite, error } = await supabase
      .from("guild_invites")
      .insert({
        code,
        guild_id: guildId,
        creator_id: userId,
        max_uses: maxUses || null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error || !invite) {
      console.error("[Guilds] Invite create error:", error);
      return res.status(500).json({ error: "Failed to create invite" });
    }

    return res.status(201).json({ invite });
  } catch (err) {
    console.error("[Guilds] POST /:id/invites error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /guilds/:id/invites — List invites (member only)
router.get("/:id/invites", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    const { data: invites, error } = await supabase
      .from("guild_invites")
      .select("code, guild_id, creator_id, max_uses, uses, expires_at, created_at")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Guilds] Invite list error:", error);
      return res.status(500).json({ error: "Failed to list invites" });
    }

    return res.json({ invites: invites || [] });
  } catch (err) {
    console.error("[Guilds] GET /:id/invites error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /guilds/:id/invites/:code — Revoke an invite
router.delete("/:id/invites/:code", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;
    const code = req.params.code;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    const { error } = await supabase
      .from("guild_invites")
      .delete()
      .eq("code", code)
      .eq("guild_id", guildId);

    if (error) {
      console.error("[Guilds] Invite revoke error:", error);
      return res.status(500).json({ error: "Failed to revoke invite" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[Guilds] DELETE /:id/invites/:code error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /invites/:code/join — Join a guild via invite code
router.post("/invites/:code/join", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const code = req.params.code;

    const { data: invite, error: inviteError } = await supabase
      .from("guild_invites")
      .select("code, guild_id, max_uses, uses, expires_at")
      .eq("code", code)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ error: "Invalid or expired invite code" });
    }

    // Check expiration
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await supabase.from("guild_invites").delete().eq("code", code);
      return res.status(410).json({ error: "Invite has expired" });
    }

    // Check max uses
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) {
      await supabase.from("guild_invites").delete().eq("code", code);
      return res.status(410).json({ error: "Invite has reached maximum uses" });
    }

    // Check if already a member
    const alreadyMember = await isGuildMember(invite.guild_id, userId);
    if (alreadyMember) {
      return res.status(409).json({ error: "You are already a member of this guild" });
    }

    // Check member limit
    const { data: memberCount } = await supabase
      .from("guild_members")
      .select("user_id", { count: "exact", head: true })
      .eq("guild_id", invite.guild_id);
    if ((memberCount?.length || 0) >= MAX_MEMBERS_PER_GUILD) {
      return res.status(403).json({ error: "Guild has reached maximum member limit" });
    }

    // Add member
    const { error: memberError } = await supabase
      .from("guild_members")
      .insert({ guild_id: invite.guild_id, user_id: userId });

    if (memberError) {
      console.error("[Guilds] Join error:", memberError);
      return res.status(500).json({ error: "Failed to join guild" });
    }

    // Increment uses
    await supabase
      .from("guild_invites")
      .update({ uses: invite.uses + 1 })
      .eq("code", code);

    // Clean up if max uses reached
    if (invite.max_uses !== null && invite.uses + 1 >= invite.max_uses) {
      await supabase.from("guild_invites").delete().eq("code", code);
    }

    const payload = await fetchGuildPayload(invite.guild_id);
    return res.status(200).json({ guild: payload });
  } catch (err) {
    console.error("[Guilds] POST /invites/:code/join error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /guilds/:id/leave — Leave a guild
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;

    const owner = await isGuildOwner(guildId, userId);
    if (owner) {
      return res.status(403).json({ error: "Owner must transfer ownership or delete the guild" });
    }

    const { error } = await supabase
      .from("guild_members")
      .delete()
      .eq("guild_id", guildId)
      .eq("user_id", userId);

    if (error) {
      console.error("[Guilds] Leave error:", error);
      return res.status(500).json({ error: "Failed to leave guild" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[Guilds] POST /:id/leave error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /guilds/:id/members — List members
router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    const { data: members, error } = await supabase
      .from("guild_members")
      .select("user_id, nickname, joined_at")
      .eq("guild_id", guildId);

    if (error) {
      console.error("[Guilds] Members error:", error);
      return res.status(500).json({ error: "Failed to fetch members" });
    }

    const memberIds = members?.map((m) => m.user_id) || [];
    let users = [];
    if (memberIds.length > 0) {
      const { data } = await supabase
        .from("users")
        .select("id, username, avatar_url, status")
        .in("id", memberIds);
      users = data || [];
    }

    const enriched = members?.map((m) => {
      const user = users.find((u) => u.id === m.user_id);
      return { ...m, user: user || { id: m.user_id, username: "Unknown" } };
    }) || [];

    return res.json({ members: enriched });
  } catch (err) {
    console.error("[Guilds] GET /:id/members error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /guilds/:id/members/:userId — Update member (nickname, roles later)
router.patch("/:id/members/:userId", requireAuth, async (req, res) => {
  try {
    const actorId = req.user.id;
    const guildId = req.params.id;
    const targetUserId = req.params.userId;
    const { nickname } = req.body;

    const member = await isGuildMember(guildId, actorId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    // Can only edit self for now (Phase 1 — no roles yet)
    if (actorId !== targetUserId) {
      const owner = await isGuildOwner(guildId, actorId);
      if (!owner) {
        return res.status(403).json({ error: "You can only edit your own nickname" });
      }
    }

    const { data, error } = await supabase
      .from("guild_members")
      .update({ nickname: nickname || null })
      .eq("guild_id", guildId)
      .eq("user_id", targetUserId)
      .select()
      .single();

    if (error) {
      console.error("[Guilds] Member update error:", error);
      return res.status(500).json({ error: "Failed to update member" });
    }

    return res.json({ member: data });
  } catch (err) {
    console.error("[Guilds] PATCH /:id/members/:userId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /guilds/:id/channels — Create a channel
router.post("/:id/channels", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;
    const { name, type, parentId } = req.body;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Channel name is required" });
    }
    if (!type || !["text", "voice", "category"].includes(type)) {
      return res.status(400).json({ error: "Invalid channel type" });
    }

    // Count existing channels
    const { data: existing } = await supabase
      .from("guild_channels")
      .select("id", { count: "exact", head: true })
      .eq("guild_id", guildId);
    if ((existing?.length || 0) >= MAX_CHANNELS_PER_GUILD) {
      return res.status(403).json({ error: "Guild has reached maximum channel limit" });
    }

    // Get max position for ordering
    const { data: maxPos } = await supabase
      .from("guild_channels")
      .select("position")
      .eq("guild_id", guildId)
      .order("position", { ascending: false })
      .limit(1)
      .single();

    const position = (maxPos?.position ?? -1) + 1;

    const { data: channel, error } = await supabase
      .from("guild_channels")
      .insert({
        guild_id: guildId,
        name: name.trim(),
        type,
        position,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error || !channel) {
      console.error("[Guilds] Channel create error:", error);
      return res.status(500).json({ error: "Failed to create channel" });
    }

    return res.status(201).json({ channel });
  } catch (err) {
    console.error("[Guilds] POST /:id/channels error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /guilds/:id/channels/:channelId — Update channel (name, position, parent)
router.patch("/:id/channels/:channelId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;
    const channelId = req.params.channelId;
    const { name, position, parentId } = req.body;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (position !== undefined) updates.position = position;
    if (parentId !== undefined) updates.parent_id = parentId || null;

    const { data, error } = await supabase
      .from("guild_channels")
      .update(updates)
      .eq("id", channelId)
      .eq("guild_id", guildId)
      .select()
      .single();

    if (error) {
      console.error("[Guilds] Channel update error:", error);
      return res.status(500).json({ error: "Failed to update channel" });
    }

    return res.json({ channel: data });
  } catch (err) {
    console.error("[Guilds] PATCH /:id/channels/:channelId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /guilds/:id/channels/:channelId — Delete a channel
router.delete("/:id/channels/:channelId", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const guildId = req.params.id;
    const channelId = req.params.channelId;

    const member = await isGuildMember(guildId, userId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this guild" });
    }

    const { error } = await supabase
      .from("guild_channels")
      .delete()
      .eq("id", channelId)
      .eq("guild_id", guildId);

    if (error) {
      console.error("[Guilds] Channel delete error:", error);
      return res.status(500).json({ error: "Failed to delete channel" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[Guilds] DELETE /:id/channels/:channelId error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
