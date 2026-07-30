"use strict";

const express = require("express");

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

/** Public — browsers need ICE before auth for call setup timing */
router.get("/ice-config", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    iceServers: buildIceServersFromEnv(),
    turnConfigured: !!(process.env.TURN_URL || process.env.TURN_URI),
  });
});

module.exports = router;
