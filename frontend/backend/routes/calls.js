"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { listCallsForUser } = require("../lib/dmCallLog");

const router = express.Router();

// GET /api/calls — unified DM + group call history
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const calls = await listCallsForUser(req.user.id, { limit });
    return res.json({ calls });
  } catch (err) {
    console.error("[calls] list failed:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to load call history" });
  }
});

module.exports = router;
