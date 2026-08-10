"use strict";

/**
 * Cosmetics + premium-theme shop: catalog, inventory, DesCoin wallet, and
 * equip state. Purchases are paid for entirely with DesCoin — the in-app
 * currency users earn by being active (see lib/descoin.js) — there is no
 * real-money checkout.
 */

const express = require("express");
const { requireAuth } = require("../middleware/auth");
const shop = require("../lib/shop");
const descoin = require("../lib/descoin");

const router = express.Router();

router.get("/catalog", requireAuth, async (_req, res) => {
  try {
    const items = await shop.listActiveItems();
    res.json({ items });
  } catch (err) {
    console.error("[shop] catalog error:", err.message);
    res.status(500).json({ error: "Failed to load shop catalog." });
  }
});

router.get("/inventory", requireAuth, async (req, res) => {
  try {
    const inventory = await shop.getUserInventory(req.user.id);
    res.json({ inventory });
  } catch (err) {
    console.error("[shop] inventory error:", err.message);
    res.status(500).json({ error: "Failed to load your inventory." });
  }
});

router.get("/wallet", requireAuth, async (req, res) => {
  try {
    const balance = await descoin.getBalance(req.user.id);
    res.json({ balance });
  } catch (err) {
    console.error("[shop] wallet error:", err.message);
    res.status(500).json({ error: "Failed to load your DesCoin balance." });
  }
});

router.get("/ledger", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const entries = await descoin.getLedger(req.user.id, { limit });
    res.json({ entries });
  } catch (err) {
    console.error("[shop] ledger error:", err.message);
    res.status(500).json({ error: "Failed to load your DesCoin history." });
  }
});

// Instant DesCoin purchase — no redirect, no pending state. Debits the
// buyer's balance and grants the item atomically-ish (balance CAS + insert).
router.post("/purchase", requireAuth, async (req, res) => {
  try {
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: "itemId is required." });

    const item = await shop.getItemById(itemId);
    if (!item || !item.active) return res.status(404).json({ error: "Item not found." });

    if (await shop.userOwnsItem(req.user.id, itemId)) {
      return res.status(409).json({ error: "You already own this item." });
    }

    const price = Number(item.price_descoin) || 0;
    let debitResult;
    try {
      debitResult = await descoin.debit(req.user.id, price, "shop_purchase", { itemId: item.id, sku: item.sku });
    } catch (err) {
      if (err.message === "INSUFFICIENT_BALANCE") {
        return res.status(402).json({ error: "Not enough DesCoin for this item." });
      }
      throw err;
    }

    await shop.grantItem(req.user.id, itemId, { acquiredVia: "purchase" });

    const supabase = require("../db/supabase");
    await supabase.from("shop_purchases").insert({
      user_id: req.user.id,
      item_id: item.id,
      amount_descoin: price,
      status: "paid",
    });

    res.json({ ok: true, balance: debitResult.balance, item });
  } catch (err) {
    console.error("[shop] purchase error:", err.message);
    res.status(500).json({ error: "Failed to complete purchase." });
  }
});

router.post("/equip", requireAuth, async (req, res) => {
  try {
    const { category, itemId } = req.body || {};
    if (!shop.EQUIP_COLUMN_BY_CATEGORY[category]) {
      return res.status(400).json({ error: "Invalid item category." });
    }
    if (itemId) {
      const owns = await shop.userOwnsItem(req.user.id, itemId);
      if (!owns) return res.status(403).json({ error: "You do not own this item." });
    }
    await shop.equipItem(req.user.id, category, itemId || null);

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${req.user.id}`).emit("shop:equipped", { category, itemId: itemId || null });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[shop] equip error:", err.message);
    res.status(500).json({ error: "Failed to equip item." });
  }
});

module.exports = router;
