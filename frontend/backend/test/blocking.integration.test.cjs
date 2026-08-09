"use strict";

/**
 * End-to-end smoke test for the real, persistent user-blocking system:
 * REST block/unblock/list endpoints (routes/friends.js) backed by
 * lib/blocking.js and the users.blocked_users column.
 */

process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
process.env.SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-key";

const http = require("http");
const { createFakeSupabase } = require("./fakeSupabase.cjs");

const supabasePath = require.resolve("../db/supabase");
const fakeSupabase = createFakeSupabase({
  users: [
    { id: "u-alice", username: "alice", blocked_users: [] },
    { id: "u-bob", username: "bob", blocked_users: [] },
  ],
  friendships: [{ id: "f1", user_id: "u-alice", friend_id: "u-bob", status: "accepted" }],
});
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: fakeSupabase };

const express = require("express");
const { signToken } = require("../config/jwt");
const friendsRouter = require("../routes/friends");
const { isBlockedEitherWay } = require("../lib/blocking");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.set("io", { to: () => ({ emit: () => {} }) });
  app.use("/api/friends", friendsRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return { server, base: `http://127.0.0.1:${port}/api/friends` };
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
  const { server, base } = await startServer();
  try {
    const aliceToken = signToken({ id: "u-alice", username: "alice" });

    // Cannot block yourself
    let r = await req(base, "POST", "/block", { token: aliceToken, body: { userId: "u-alice" } });
    assert(r.status === 400, "cannot block self");

    // Block bob
    r = await req(base, "POST", "/block", { token: aliceToken, body: { userId: "u-bob" } });
    assert(r.status === 200 && r.body.blockedUsers.includes("u-bob"), "block succeeds: " + JSON.stringify(r.body));

    // Blocking severs the existing friendship row
    const friendship = fakeSupabase._tables.friendships.rows.find(
      (row) => row.user_id === "u-alice" || row.friend_id === "u-alice"
    );
    assert(!friendship, "friendship row removed after block");

    // isBlockedEitherWay reflects the block from either direction
    assert((await isBlockedEitherWay("u-alice", "u-bob")) === true, "blocked from blocker's perspective");
    assert((await isBlockedEitherWay("u-bob", "u-alice")) === true, "blocked from target's perspective (symmetric)");

    // Listed in alice's blocked list
    r = await req(base, "GET", "/blocked", { token: aliceToken });
    assert(r.status === 200 && r.body.blocked.length === 1 && r.body.blocked[0].id === "u-bob", "blocked list shows bob");

    // Unblock reverses it
    r = await req(base, "POST", "/unblock", { token: aliceToken, body: { userId: "u-bob" } });
    assert(r.status === 200 && !r.body.blockedUsers.includes("u-bob"), "unblock succeeds");
    assert((await isBlockedEitherWay("u-alice", "u-bob")) === false, "no longer blocked after unblock");

    console.log("blocking.integration.test.cjs: ok");
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
