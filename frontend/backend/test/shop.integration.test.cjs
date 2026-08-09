"use strict";

/**
 * End-to-end smoke test for the cosmetics shop: catalog, inventory, DesCoin
 * purchases, equip enforcement, and admin gifting with the real-time popup
 * notification. Purchases are paid for entirely with DesCoin (the in-app
 * activity currency) — there is no real-money checkout to exercise here.
 */

process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
process.env.SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-key";

const http = require("http");
const { createFakeSupabase } = require("./fakeSupabase.cjs");

const supabasePath = require.resolve("../db/supabase");
const fakeSupabase = createFakeSupabase({
  users: [
    { id: "u-alice", username: "alice", is_admin: true, descoin_balance: 0 },
    { id: "u-bob", username: "bob", is_admin: false, descoin_balance: 500 },
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
      price_descoin: 300,
      theme_key: null,
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
      price_descoin: 200,
      theme_key: null,
      active: false,
      rarity: "epic",
      sort_order: 1,
    },
    {
      id: "item-theme-1",
      sku: "theme-midnight",
      name: "Midnight",
      description: "A deep indigo and violet look for the whole app.",
      category: "theme",
      asset_url: "https://cdn.example.com/midnight.svg",
      preview_url: null,
      price_descoin: 1000,
      theme_key: "midnight",
      active: true,
      rarity: "epic",
      sort_order: 2,
    },
  ],
  user_inventory: [],
  descoin_ledger: [],
  shop_purchases: [],
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

    // Catalog only lists active items (2 of the 3 seeded: banner + theme)
    let r = await req(base, "GET", "/api/shop/catalog", { token: bobToken });
    assert(r.status === 200, "catalog loads: " + JSON.stringify(r.body));
    assert(r.body.items.length === 2, "only active items listed: " + JSON.stringify(r.body.items));
    assert(r.body.items.some((i) => i.sku === "banner-aurora"), "active banner listed");
    assert(r.body.items.some((i) => i.sku === "theme-midnight"), "active theme listed");

    // Bob's inventory starts empty
    r = await req(base, "GET", "/api/shop/inventory", { token: bobToken });
    assert(r.status === 200 && r.body.inventory.length === 0, "inventory starts empty");

    // Wallet reflects the seeded DesCoin balance
    r = await req(base, "GET", "/api/shop/wallet", { token: bobToken });
    assert(r.status === 200 && r.body.balance === 500, "wallet shows seeded balance: " + JSON.stringify(r.body));

    // Purchasing an item costing more than the balance is rejected, no charge
    r = await req(base, "POST", "/api/shop/purchase", { token: bobToken, body: { itemId: "item-theme-1" } });
    assert(r.status === 402, "purchase blocked when balance insufficient: " + JSON.stringify(r.body));
    r = await req(base, "GET", "/api/shop/wallet", { token: bobToken });
    assert(r.body.balance === 500, "balance untouched after a rejected purchase");

    // Purchasing an affordable item debits DesCoin instantly and grants it
    r = await req(base, "POST", "/api/shop/purchase", { token: bobToken, body: { itemId: "item-banner-1" } });
    assert(r.status === 200 && r.body.ok, "purchase succeeds: " + JSON.stringify(r.body));
    assert(r.body.balance === 200, "balance debited by item price (500 - 300 = 200)");
    r = await req(base, "GET", "/api/shop/inventory", { token: bobToken });
    assert(r.body.inventory.length === 1 && r.body.inventory[0].item.sku === "banner-aurora", "purchased item granted");

    // The DesCoin spend is recorded in the audit ledger
    r = await req(base, "GET", "/api/shop/ledger", { token: bobToken });
    assert(r.status === 200, "ledger loads: " + JSON.stringify(r.body));
    const purchaseEntry = r.body.entries.find((e) => e.reason === "shop_purchase");
    assert(purchaseEntry && purchaseEntry.amount === -300, "ledger has the -300 shop_purchase debit");

    // Re-purchasing an already-owned item is rejected
    r = await req(base, "POST", "/api/shop/purchase", { token: bobToken, body: { itemId: "item-banner-1" } });
    assert(r.status === 409, "cannot re-purchase an owned item: " + JSON.stringify(r.body));

    // Bob cannot equip a (different, still unowned) item — the premium
    // theme, which he hasn't purchased or been gifted yet
    r = await req(base, "POST", "/api/shop/equip", {
      token: bobToken,
      body: { category: "theme", itemId: "item-theme-1" },
    });
    assert(r.status === 403, "cannot equip unowned item");

    // Admin gifts the theme to Bob, with a message. Bob is "online" so this
    // should deliver a live popup immediately.
    io.setOnline("u-bob", true);
    r = await req(base, "POST", "/api/admin/shop/gift", {
      token: aliceToken,
      body: { userId: "u-bob", itemId: "item-theme-1", message: "Enjoy the update!" },
    });
    assert(r.status === 200 && r.body.success, "gift succeeds: " + JSON.stringify(r.body));

    // Real-time popup notification was pushed to the recipient's room
    const giftEvent = io.emitted.find((e) => e.event === "shop:gift:received" && e.room === "user:u-bob");
    assert(giftEvent, "shop:gift:received emitted to recipient");
    assert(giftEvent.payload.item.sku === "theme-midnight", "gift payload includes item");
    assert(giftEvent.payload.message === "Enjoy the update!", "gift payload includes message");
    assert(giftEvent.payload.from.username === "alice", "gift payload includes sender");

    // Bob's inventory now contains both the purchased banner and the gifted
    // theme (gifting never touches his DesCoin balance)
    r = await req(base, "GET", "/api/shop/inventory", { token: bobToken });
    assert(r.status === 200 && r.body.inventory.length === 2, "inventory shows purchased + gifted items");
    const giftedRow = r.body.inventory.find((i) => i.item.sku === "theme-midnight");
    assert(giftedRow && giftedRow.acquiredVia === "gift", "theme acquired via gift");
    r = await req(base, "GET", "/api/shop/wallet", { token: bobToken });
    assert(r.body.balance === 200, "gifting does not touch the recipient's DesCoin balance");

    // Re-gifting the same item is idempotent (no duplicate inventory row)
    r = await req(base, "POST", "/api/admin/shop/gift", {
      token: aliceToken,
      body: { userId: "u-bob", itemId: "item-theme-1", message: "Again!" },
    });
    assert(r.status === 200, "re-gift does not error");
    r = await req(base, "GET", "/api/shop/inventory", { token: bobToken });
    assert(r.body.inventory.length === 2, "re-gifting does not duplicate inventory row");

    // Now Bob can equip the theme he owns
    r = await req(base, "POST", "/api/shop/equip", {
      token: bobToken,
      body: { category: "theme", itemId: "item-theme-1" },
    });
    assert(r.status === 200 && r.body.ok, "equip succeeds once owned");
    const bobRow = fakeSupabase._tables.users.rows.find((u) => u.id === "u-bob");
    assert(bobRow.equipped_theme_id === "item-theme-1", "equipped_theme_id persisted");

    // Unequip by passing a null itemId
    r = await req(base, "POST", "/api/shop/equip", { token: bobToken, body: { category: "theme", itemId: null } });
    assert(r.status === 200, "unequip succeeds");
    assert(bobRow.equipped_theme_id === null, "equipped_theme_id cleared");

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
