"use strict";

const express = require("express");
const { AccessToken } = require("livekit-server-sdk");
const { requireAuth } = require("../middleware/auth");
const supabase = require("../db/supabase");
const { activeServerVoiceCalls } = require("../runtime/sharedState");
const {
  Permissions,
  hasPermission,
  resolveChannelPermissions,
} = require("../lib/serverPermissions");

const router = express.Router();

const DEFAULT_STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function buildIceServersFromEnv() {
  const raw = process.env.ICE_SERVERS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.warn("[webrtc] Invalid ICE_SERVERS_JSON:", e.message);
    }
  }

  const servers = [...DEFAULT_STUN];
  const turnUrl = process.env.TURN_URL || process.env.TURN_URI;
  const turnUser = process.env.TURN_USERNAME;
  const turnPass = process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD;

  if (turnUrl && turnUser && turnPass) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnPass,
    });
  }

  return servers;
}

function isLiveKitConfigured() {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
  );
}

function isTurnConfigured() {
  return Boolean(
    (process.env.TURN_URL || process.env.TURN_URI) &&
      process.env.TURN_USERNAME &&
      (process.env.TURN_CREDENTIAL || process.env.TURN_PASSWORD)
  );
}

async function resolveVoiceChannelAccess(userId, channelId) {
  const { data: channel, error } = await supabase
    .from("server_channels")
    .select("id, server_id, type, name")
    .eq("id", channelId)
    .maybeSingle();
  if (error) throw error;
  if (!channel || !["voice", "stage"].includes(channel.type)) {
    const err = new Error("Voice channel not found.");
    err.code = "NOT_VOICE_CHANNEL";
    err.status = channel ? 400 : 404;
    throw err;
  }
  const resolved = await resolveChannelPermissions(supabase, channel.server_id, userId, channelId);
  if (!resolved.isMember) {
    const err = new Error("You are not a member of this server.");
    err.code = "NOT_MEMBER";
    err.status = 403;
    throw err;
  }
  if (
    !hasPermission(resolved.bits, Permissions.VIEW_CHANNEL) ||
    !hasPermission(resolved.bits, Permissions.CONNECT)
  ) {
    const err = new Error("Missing voice channel permission.");
    err.code = "MISSING_PERMISSION";
    err.status = 403;
    throw err;
  }
  return { channel, resolved };
}

function stageRoleFor(channelId, userId) {
  const call = activeServerVoiceCalls.get(channelId);
  const participant = call?.participants?.get?.(userId);
  return participant?.stageRole === "speaker" ? "speaker" : "audience";
}

/** Public — browsers need ICE before auth for call setup timing */
router.get("/ice-config", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    iceServers: buildIceServersFromEnv(),
    turnConfigured: isTurnConfigured(),
  });
});

router.get("/media-config", (_req, res) => {
  res.set("Cache-Control", "public, max-age=60");
  res.json({
    sfu: isLiveKitConfigured(),
    livekitUrl: isLiveKitConfigured() ? process.env.LIVEKIT_URL : null,
    turnConfigured: isTurnConfigured(),
  });
});

router.all("/livekit-token", (req, res, next) => {
  if (!isLiveKitConfigured()) return res.json({ enabled: false });
  return next();
});

router.all("/livekit-token", requireAuth, async (req, res) => {
  const channelId = String(req.query?.channelId || req.body?.channelId || "").trim();
  if (!channelId) return res.status(400).json({ enabled: true, error: "channelId is required." });
  try {
    const userId = req.user.id;
    const { channel, resolved } = await resolveVoiceChannelAccess(userId, channelId);
    const canSpeak = hasPermission(resolved.bits, Permissions.SPEAK);
    const canPublish =
      channel.type === "stage" ? stageRoleFor(channelId, userId) === "speaker" && canSpeak : canSpeak;
    const room = `server-voice-${channelId}`;
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: userId,
      ttl: "1h",
    });
    token.addGrant({
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish,
      canPublishData: true,
    });
    return res.json({
      enabled: true,
      livekitUrl: process.env.LIVEKIT_URL,
      room,
      token: await token.toJwt(),
      canPublish,
      canSubscribe: true,
      channelType: channel.type,
      stageRole: channel.type === "stage" ? stageRoleFor(channelId, userId) : "speaker",
      canRequestToSpeak: hasPermission(resolved.bits, Permissions.REQUEST_TO_SPEAK),
      canStream: hasPermission(resolved.bits, Permissions.STREAM),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[webrtc] livekit-token error:", err);
    return res.status(status).json({
      enabled: true,
      error: err.message || "Failed to mint LiveKit token.",
      code: err.code || null,
    });
  }
});

module.exports = router;
