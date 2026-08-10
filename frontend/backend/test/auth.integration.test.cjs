"use strict";

/**
 * End-to-end smoke test for the new register/email-verify/2FA/session-
 * management flows in routes/auth.js, run against a fully in-memory fake
 * Supabase client + fake email transport (no network, no real DB).
 */

process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
process.env.JWT_EXPIRES_IN = "7d";
process.env.SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-key";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.FEEDBACK_EMAIL_FROM = "support@descall.com";

const path = require("path");
const http = require("http");
const { createFakeSupabase } = require("./fakeSupabase.cjs");

// Intercept outbound "emails" so tests can read the plaintext code without
// a live Resend account, and inject the fake DB before any module resolves
// the real Supabase client.
const sentEmails = [];
const realFetch = global.fetch;
global.fetch = async (url, opts) => {
  if (url === "https://api.resend.com/emails") {
    const body = JSON.parse(opts.body);
    sentEmails.push(body);
    return { ok: true, json: async () => ({ id: "fake_email_id" }) };
  }
  return realFetch(url, opts);
};

const supabasePath = require.resolve("../db/supabase");
const fakeSupabase = createFakeSupabase({ users: [] });
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: fakeSupabase };

const express = require("express");
const authRouter = require("../routes/auth");

function lastCodeFor(email) {
  const email_ = sentEmails.filter((e) => e.to[0] === email).slice(-1)[0];
  const match = email_?.text?.match(/code is (\d{6})/);
  return match ? match[1] : null;
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.set("io", { sockets: { sockets: new Map() } });
  app.use("/api/auth", authRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return { server, base: `http://127.0.0.1:${port}/api/auth` };
}

async function req(base, method, urlPath, { body, token } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function run() {
  const { server, base } = await startServer();
  try {
    // 1. Registering without accepting the Terms is rejected
    let r = await req(base, "POST", "/register", {
      body: { username: "alice", password: "password123" },
    });
    assert(r.status === 400, "register without terms acceptance rejected: " + JSON.stringify(r.body));

    // 2. Register without email (terms accepted)
    r = await req(base, "POST", "/register", {
      body: { username: "alice", password: "password123", termsAccepted: true },
    });
    assert(r.status === 201, "register without email succeeds: " + JSON.stringify(r.body));
    assert(r.body.needsEmailVerification === false, "no verification needed without email");

    // 3. Register with email
    r = await req(base, "POST", "/register", {
      body: { username: "bob", password: "password123", email: "bob@example.com", termsAccepted: true },
    });
    assert(r.status === 201, "register with email succeeds: " + JSON.stringify(r.body));
    assert(r.body.needsEmailVerification === true, "flags email verification needed");
    assert(r.body.verificationEmailSent === true, "verification email reported sent");
    const verifyCode = lastCodeFor("bob@example.com");
    assert(/^\d{6}$/.test(verifyCode || ""), "captured a 6-digit verification code");

    // 4. Duplicate username rejected
    r = await req(base, "POST", "/register", {
      body: { username: "bob", password: "password123", termsAccepted: true },
    });
    assert(r.status === 409, "duplicate username rejected");

    // 4. Login as bob (2FA not enabled yet) issues a real token immediately
    r = await req(base, "POST", "/login", { body: { username: "bob", password: "password123" } });
    assert(r.status === 200 && r.body.token, "login before 2FA returns a real token");
    const firstToken = r.body.token;
    const firstSessionId = r.body.sessionId;
    assert(typeof firstSessionId === "string" && firstSessionId.length > 0, "login returns a session id");

    // 5. Wrong verification code rejected
    r = await req(base, "POST", "/email/verify", { token: firstToken, body: { code: "000000" } });
    assert(r.status === 400, "wrong verification code rejected: " + JSON.stringify(r.body));

    // 6. Correct verification code accepted
    r = await req(base, "POST", "/email/verify", { token: firstToken, body: { code: verifyCode } });
    assert(r.status === 200 && r.body.emailVerified === true, "correct code verifies email");

    // 7. Enable 2FA now that email is verified
    r = await req(base, "POST", "/2fa/enable", { token: firstToken });
    assert(r.status === 200 && r.body.twoFactorEnabled === true, "2FA enables after verified email");

    // 8. Login again -> now requires 2FA, no real token yet
    r = await req(base, "POST", "/login", { body: { username: "bob", password: "password123" } });
    assert(r.status === 200 && r.body.requires2fa === true, "second login requires 2FA");
    assert(!r.body.token, "no real token issued before 2FA verification");
    const pendingToken = r.body.pendingToken;
    assert(pendingToken, "pending token issued");

    // 9. Pending token cannot access protected routes
    r = await req(base, "GET", "/sessions", { token: pendingToken });
    assert(r.status === 401, "pending 2FA token rejected by requireAuth");

    // 10. Wrong 2FA code rejected
    r = await req(base, "POST", "/2fa/verify-login", { body: { pendingToken, code: "111111" } });
    assert(r.status === 401, "wrong 2FA code rejected");

    // 11. Correct 2FA code issues a real token + new session
    const loginCode = lastCodeFor("bob@example.com");
    r = await req(base, "POST", "/2fa/verify-login", { body: { pendingToken, code: loginCode } });
    assert(r.status === 200 && r.body.token, "correct 2FA code issues real token: " + JSON.stringify(r.body));
    const secondToken = r.body.token;
    const secondSessionId = r.body.sessionId;
    assert(secondSessionId !== firstSessionId, "2FA login creates a distinct session");

    // 12. Sessions list shows both sessions, current flag matches caller
    r = await req(base, "GET", "/sessions", { token: secondToken });
    assert(r.status === 200 && r.body.sessions.length === 2, "both sessions listed: " + JSON.stringify(r.body));
    const current = r.body.sessions.find((s) => s.id === secondSessionId);
    assert(current?.current === true, "current session flagged correctly");

    // 13. The old (first) token still works until revoked
    r = await req(base, "GET", "/sessions", { token: firstToken });
    assert(r.status === 200, "old session token still valid before revocation");

    // 14. Revoke the old session from the new session
    r = await req(base, "POST", `/sessions/${firstSessionId}/revoke`, { token: secondToken });
    assert(r.status === 200, "revoke old session succeeds: " + JSON.stringify(r.body));

    // 15. Old token is now rejected everywhere (instant revocation)
    r = await req(base, "GET", "/sessions", { token: firstToken });
    assert(r.status === 401, "revoked session token rejected immediately");

    // 16. Cannot revoke your own current session via this endpoint
    r = await req(base, "POST", `/sessions/${secondSessionId}/revoke`, { token: secondToken });
    assert(r.status === 400, "cannot revoke current session via revoke endpoint");

    // 17. 2FA disable requires correct password
    r = await req(base, "POST", "/2fa/disable", { token: secondToken, body: { password: "wrong" } });
    assert(r.status === 401, "2FA disable rejects wrong password");
    r = await req(base, "POST", "/2fa/disable", { token: secondToken, body: { password: "password123" } });
    assert(r.status === 200 && r.body.twoFactorEnabled === false, "2FA disable with correct password succeeds");

    console.log("auth.integration.test.cjs: ok (" + sentEmails.length + " emails sent during test)");
  } finally {
    server.close();
  }
}

run().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
