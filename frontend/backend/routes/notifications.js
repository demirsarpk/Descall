"use strict";

const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const PLATFORMS = new Set(["web", "android", "ios"]);
const PREFERENCE_KEYS = new Set(["dm", "groups", "calls", "mentions", "friend_requests"]);

function stringValue(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("dm, groups, calls, mentions, friend_requests")
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (error) throw error;
    return res.json({
      preferences: data || { dm: true, groups: true, calls: true, mentions: true, friend_requests: true },
    });
  } catch (err) {
    console.error("[notifications] preferences read failed:", err.message);
    return res.status(500).json({ error: "Could not load notification preferences." });
  }
});

router.patch("/preferences", requireAuth, async (req, res) => {
  const updates = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key, value]) => PREFERENCE_KEYS.has(key) && typeof value === "boolean")
  );
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Provide at least one valid notification preference." });
  }

  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: req.user.id, ...updates }, { onConflict: "user_id" })
      .select("dm, groups, calls, mentions, friend_requests")
      .single();
    if (error) throw error;
    return res.json({ preferences: data });
  } catch (err) {
    console.error("[notifications] preferences update failed:", err.message);
    return res.status(500).json({ error: "Could not save notification preferences." });
  }
});

router.post("/devices", requireAuth, async (req, res) => {
  const deviceId = stringValue(req.body?.deviceId, 255);
  const platform = stringValue(req.body?.platform, 16);
  const pushToken = stringValue(req.body?.pushToken, 4096);
  if (!deviceId || !pushToken || !PLATFORMS.has(platform)) {
    return res.status(400).json({ error: "A deviceId, supported platform, and pushToken are required." });
  }

  try {
    // A Firebase token can be reassigned after sign-out/sign-in on the same device.
    await supabase
      .from("push_devices")
      .delete()
      .eq("push_token", pushToken)
      .neq("user_id", req.user.id);

    const { error } = await supabase.from("push_devices").upsert(
      {
        user_id: req.user.id,
        device_id: deviceId,
        platform,
        push_token: pushToken,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" }
    );
    if (error) throw error;
    return res.status(204).end();
  } catch (err) {
    console.error("[notifications] device registration failed:", err.message);
    return res.status(500).json({ error: "Could not register this device for notifications." });
  }
});

router.delete("/devices/:deviceId", requireAuth, async (req, res) => {
  const deviceId = stringValue(req.params.deviceId, 255);
  if (!deviceId) return res.status(400).json({ error: "A deviceId is required." });

  try {
    const { error } = await supabase
      .from("push_devices")
      .delete()
      .eq("user_id", req.user.id)
      .eq("device_id", deviceId);
    if (error) throw error;
    return res.status(204).end();
  } catch (err) {
    console.error("[notifications] device removal failed:", err.message);
    return res.status(500).json({ error: "Could not remove this device." });
  }
});

module.exports = router;
