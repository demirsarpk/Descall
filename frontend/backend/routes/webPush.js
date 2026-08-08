"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const supabase = require("../db/supabase");

const router = express.Router();

function validSubscription(subscription) {
  return Boolean(
    subscription &&
    typeof subscription.endpoint === "string" &&
    subscription.endpoint.startsWith("https://") &&
    typeof subscription.keys?.p256dh === "string" &&
    typeof subscription.keys?.auth === "string"
  );
}

router.post("/subscription", requireAuth, async (req, res) => {
  const subscription = req.body;
  if (!validSubscription(subscription)) {
    return res.status(400).json({ error: "Invalid push subscription." });
  }

  const { error } = await supabase
    .from("web_push_subscriptions")
    .upsert(
      {
        user_id: req.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
  if (error) {
    console.error("[WebPush] Subscription save failed:", error.message);
    return res.status(500).json({ error: "Could not save push subscription." });
  }

  return res.status(204).end();
});

router.delete("/subscription", requireAuth, async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint) {
    return res.status(400).json({ error: "Missing push endpoint." });
  }

  const { error } = await supabase
    .from("web_push_subscriptions")
    .delete()
    .eq("user_id", req.user.id)
    .eq("endpoint", endpoint);
  if (error) {
    console.error("[WebPush] Subscription removal failed:", error.message);
    return res.status(500).json({ error: "Could not remove push subscription." });
  }

  return res.status(204).end();
});

module.exports = router;
