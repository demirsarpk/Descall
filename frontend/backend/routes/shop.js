"use strict";

/**
 * Real-money cosmetics shop: catalog, inventory, Stripe Checkout, and equip
 * state. Stripe is optional at boot — until STRIPE_SECRET_KEY is configured,
 * /checkout responds 503 instead of crashing the whole backend.
 */

const express = require("express");
const supabase = require("../db/supabase");
const { requireAuth } = require("../middleware/auth");
const shop = require("../lib/shop");

const router = express.Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  // Lazy-required so environments without the key never import the SDK.
  const Stripe = require("stripe");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

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

router.post("/checkout", requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: "Payments are not configured yet. Please try again later." });
  }
  try {
    const { itemId } = req.body || {};
    if (!itemId) return res.status(400).json({ error: "itemId is required." });

    const item = await shop.getItemById(itemId);
    if (!item || !item.active) return res.status(404).json({ error: "Item not found." });

    if (await shop.userOwnsItem(req.user.id, itemId)) {
      return res.status(409).json({ error: "You already own this item." });
    }

    const appUrl = (process.env.APP_PUBLIC_URL || "https://des-call.onrender.com").replace(/\/$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: item.currency || "usd",
            product_data: {
              name: item.name,
              description: item.description || undefined,
              images: item.preview_url ? [item.preview_url] : undefined,
            },
            unit_amount: item.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/app?shop=success&item=${encodeURIComponent(item.sku)}`,
      cancel_url: `${appUrl}/app?shop=cancelled`,
      client_reference_id: req.user.id,
      metadata: { userId: req.user.id, itemId: item.id },
    });

    await supabase.from("shop_purchases").insert({
      user_id: req.user.id,
      item_id: item.id,
      stripe_session_id: session.id,
      amount_cents: item.price_cents,
      currency: item.currency || "usd",
      status: "pending",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("[shop] checkout error:", err.message);
    res.status(500).json({ error: "Failed to start checkout." });
  }
});

/**
 * Stripe webhook — mounted in server.js with express.raw() BEFORE the global
 * express.json() middleware, since Stripe signature verification needs the
 * exact raw request bytes.
 */
router.post("/webhook", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).end();

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[shop] webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId || session.client_reference_id;
      const itemId = session.metadata?.itemId;
      if (userId && itemId && session.payment_status === "paid") {
        await shop.grantItem(userId, itemId, { acquiredVia: "purchase" });
        await supabase
          .from("shop_purchases")
          .update({
            status: "paid",
            stripe_payment_intent: session.payment_intent || null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", session.id);

        const io = req.app.get("io");
        if (io) {
          const item = await shop.getItemById(itemId);
          io.to(`user:${userId}`).emit("shop:purchase:completed", { item });
        }
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("[shop] webhook handling error:", err.message);
    res.status(500).json({ error: "Webhook processing failed." });
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
