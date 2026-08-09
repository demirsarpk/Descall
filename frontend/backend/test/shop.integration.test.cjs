"use strict";

/**
 * End-to-end smoke test for the cosmetics shop: catalog, inventory, equip
 * enforcement, and admin gifting with the real-time popup notification.
 * Stripe Checkout itself is exercised separately (requires network + a real
 * Stripe test key) — here we verify the 503 fallback when unconfigured.
 */

process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
process.env.SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-key";
delete process.env.STRIPE_SECRET_KEY;

const http = require("http");
const { createFakeSupabase } = require("./fakeSupabase.cjs");

const supabasePath = require.resolve("../db/supabase");
const fakeSupabase = createFakeSupabase({
  users: [
    { id: "u-alice", username: "alice", is_admin: true },
    { id: "u-bob", username: "bob", is_admin: false },
  ],
  shop_items: [
    {
      id: "item-banner-1",
      sku: "banner-aurora",
      name: "Aurora Banner",
      description: "A shimmering aurora banner.",
      category: "banner",
      asset_url: "https://cdn.example.com/aurora.png",
      preview_url: null,
      price_cents: 499,
      currency: "usd",
      active: true,
      rarity: "rare",
      sort_order: 0,
    },
    {
      id: "item-frame-1",
      sku: "frame-gold",
      name: "Gold Frame",
      description: "A gold avatar frame.",
      category: "avatar_frame",
      asset_url: "https://cdn.example.com/gold-frame.png",
      preview_url: null,
      price_cents: 299,
      currency: "usd",
      active: false,
      rarity: "epic",
      sort_order: 1,
    },
  ],
  user_inventory: [],
});
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: fakeSupabase };

const express = require("express");
const { signToken } = require("../config/jwt");
const shopRouter = require("../routes/shop");
const adminRouter = require("../routes/admin");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function fakeIo() {
  const emitted = [];
  const rooms = new Map();
  return {
    emitted,
    // Test helper mimicking a real connected socket joining `user:<id>`, so
    // the admin gift route's "is the recipient actually online" check has
    // something to look at.
    setOnline(userId, isOnline) {
      rooms.set(`user:${userId}`, isOnline ? new Set(["fake-socket-id"]) : undefined);
    },
    sockets: { adapter: { rooms } },
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        },
      };
    },
  };
}

async function startServer(io) {
  const app = express();
  app.use(express.json());
  app.set("io", io);
  app.use("/api/shop", shopRouter);
  app.use("/api/admin", adminRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return { server, base: `http://127.0.0.1:${port}` };
}

async function req(base, method, urlPath, { body, token } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function run() {
  const io = fakeIo();
  const { server, base } = await startServer(io);
  try {
    const aliceToken = signToken({ id: "u-alice", username: "alice" });
    const bobToken = signToken({ id: "u-bob", username: "bob" });

    // Catalog only lists active items
    let r = await req(base, "GET", "/api/shop/catalog", { token: bobToken });
    assert(r.status === 200, "catalog loads: " + JSON.stringify(r.body));
    assert(r.body.items.length === 1 && r.body.items[0].sku === "banner-aurora", "only active item listed");

    // Bob's inventory starts empty
    r = await req(base, "GET", "/api/shop/inventory", { token: bobToken });
    assert(r.status === 200 && r.body.inventory.length === 0, "inventory starts empty");

    // Checkout is disabled without Stripe configured
    r = await req(base, "POST", "/api/shop/checkout", { token: bobToken, body: { itemId: "item-banner-1" } });
    assert(r.status === 503, "checkout 503 without Stripe key: " + JSON.stringify(r.body));

    // Bob cannot equip an item he doesn't own
    r = await req(base, "POST", "/api/shop/equip", {
      token: bobToken,
      body: { category: "banner", itemId: "item-banner-1" },
    });
    assert(r.status === 403, "cannot equip unowned item");

    // Admin gifts the banner to Bob, with a message. Bob is "online" so this
    // should deliver a live popup immediately.
    io.setOnline("u-bob", true);
    r = await req(base, "POST", "/api/admin/shop/gift", {
      token: aliceToken,
      body: { userId: "u-bob", itemId: "item-banner-1", message: "Enjoy the update!" },
    });
    assert(r.status === 200 && r.body.success, "gift succeeds: " + JSON.stringify(r.body));

    // Real-time popup notification was pushed to the recipient's room
    const giftEvent = io.emitted.find((e) => e.event === "shop:gift:received" && e.room === "user:u-bob");
    assert(giftEvent, "shop:gift:received emitted to recipient");
    assert(giftEvent.payload.item.sku === "banner-aurora", "gift payload includes item");
    assert(giftEvent.payload.message === "Enjoy the update!", "gift payload includes message");
    assert(giftEvent.payload.from.username === "alice", "gift payload includes sender");

    // Bob's inventory now contains the gifted item
    r = await req(base, "GET", "/api/shop/inventory", { token: bobToken });
    assert(r.status === 200 && r.body.inventory.length === 1, "inventory shows gifted item");
    assert(r.body.inventory[0].acquiredVia === "gift", "acquired via gift");
    assert(r.body.inventory[0].item.sku === "banner-aurora", "gifted item details populated");

    // Re-gifting the same item is idempotent (no duplicate inventory row)
    r = await req(base, "POST", "/api/admin/shop/gift", {
      token: aliceToken,
      body: { userId: "u-bob", itemId: "item-banner-1", message: "Again!" },
    });
    assert(r.status === 200, "re-gift does not error");
    r = await req(base, "GET", "/api/shop/inventory", { token: bobToken });
    assert(r.body.inventory.length === 1, "re-gifting does not duplicate inventory row");

    // Now Bob can equip the item he owns
    r = await req(base, "POST", "/api/shop/equip", {
      token: bobToken,
      body: { category: "banner", itemId: "item-banner-1" },
    });
    assert(r.status === 200 && r.body.ok, "equip succeeds once owned");
    const bobRow = fakeSupabase._tables.users.rows.find((u) => u.id === "u-bob");
    assert(bobRow.equipped_banner_id === "item-banner-1", "equipped_banner_id persisted");

    // Unequip by passing a null itemId
    r = await req(base, "POST", "/api/shop/equip", { token: bobToken, body: { category: "banner", itemId: null } });
    assert(r.status === 200, "unequip succeeds");
    assert(bobRow.equipped_banner_id === null, "equipped_banner_id cleared");

    // Offline-gift catch-up: a gift granted before the recipient connects
    // still has notified_at = null, and getUnnotifiedGifts should surface it
    // exactly once for delivery on the next socket connect.
    const shop = require("../lib/shop");
    io.setOnline("u-bob", false);
    r = await req(base, "POST", "/api/admin/shop/gift", {
      token: aliceToken,
      body: { userId: "u-bob", itemId: "item-frame-1", message: "For while you were away" },
    });
    assert(r.status === 200, "second gift (different item) succeeds");
    const liveEventsForOfflineGift = io.emitted.filter(
      (e) => e.event === "shop:gift:received" && e.payload?.item?.sku === "frame-gold"
    );
    assert(liveEventsForOfflineGift.length === 0, "no live popup emitted while recipient is offline");

    let pending = await shop.getUnnotifiedGifts("u-bob");
    assert(pending.length === 1, "one unnotified gift pending: " + JSON.stringify(pending));
    assert(pending[0].item.sku === "frame-gold", "pending gift has correct item");
    assert(pending[0].message === "For while you were away", "pending gift has correct message");
    assert(pending[0].from.username === "alice", "pending gift has correct sender");

    await shop.markGiftsNotified(pending.map((g) => g.inventoryId));
    pending = await shop.getUnnotifiedGifts("u-bob");
    assert(pending.length === 0, "gift no longer pending after being marked notified");

    console.log("shop.integration.test.cjs: ok");
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
