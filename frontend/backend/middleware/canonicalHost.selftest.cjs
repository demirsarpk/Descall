/**
 * Self-test for canonicalHost middleware.
 * Run: node frontend/backend/middleware/canonicalHost.selftest.cjs
 */
const assert = require("assert");
const { canonicalHostMiddleware, isApiOrInfraPath } = require("./canonicalHost");

assert.strictEqual(isApiOrInfraPath("/api/foo"), true);
assert.strictEqual(isApiOrInfraPath("/auth/login"), true);
assert.strictEqual(isApiOrInfraPath("/health"), true);
assert.strictEqual(isApiOrInfraPath("/discord-alternative"), false);
assert.strictEqual(isApiOrInfraPath("/"), false);

function run(reqProps) {
  const redirects = [];
  const req = {
    method: "GET",
    path: "/",
    originalUrl: "/",
    protocol: "http",
    get(name) {
      const headers = reqProps.headers || {};
      return headers[name.toLowerCase()] || headers[name] || undefined;
    },
    ...reqProps,
  };
  const res = {
    set() {},
    redirect(code, url) {
      redirects.push({ code, url });
    },
  };
  let nextCalled = false;
  const prevEnv = {
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    FORCE_CANONICAL_HOST: process.env.FORCE_CANONICAL_HOST,
  };
  process.env.FORCE_CANONICAL_HOST = "true";
  canonicalHostMiddleware(req, res, () => {
    nextCalled = true;
  });
  Object.assign(process.env, prevEnv);
  return { redirects, nextCalled };
}

// http apex → https apex
{
  const { redirects, nextCalled } = run({
    path: "/download",
    originalUrl: "/download?platform=windows",
    headers: { host: "descall.com", "x-forwarded-proto": "http" },
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(redirects[0].code, 301);
  assert.strictEqual(redirects[0].url, "https://descall.com/download?platform=windows");
}

// www → apex
{
  const { redirects } = run({
    path: "/discord-alternative",
    originalUrl: "/discord-alternative",
    headers: { host: "www.descall.com", "x-forwarded-proto": "https" },
  });
  assert.strictEqual(redirects[0].url, "https://descall.com/discord-alternative");
}

// Render marketing HTML → apex
{
  const { redirects } = run({
    path: "/compare/discord",
    originalUrl: "/compare/discord",
    headers: { host: "des-call.onrender.com", "x-forwarded-proto": "https" },
  });
  assert.strictEqual(redirects[0].url, "https://descall.com/compare/discord");
}

// API on Render must NOT redirect
{
  const { redirects, nextCalled } = run({
    path: "/api/status",
    originalUrl: "/api/status",
    headers: { host: "des-call.onrender.com", "x-forwarded-proto": "https" },
  });
  assert.strictEqual(redirects.length, 0);
  assert.strictEqual(nextCalled, true);
}

// Already canonical → next
{
  const { redirects, nextCalled } = run({
    path: "/",
    originalUrl: "/",
    headers: { host: "descall.com", "x-forwarded-proto": "https" },
  });
  assert.strictEqual(redirects.length, 0);
  assert.strictEqual(nextCalled, true);
}

// Trailing slash → stripped
{
  const { redirects } = run({
    path: "/discord-alternative/",
    originalUrl: "/discord-alternative/?x=1",
    headers: { host: "descall.com", "x-forwarded-proto": "https" },
  });
  assert.strictEqual(redirects[0].code, 301);
  assert.strictEqual(redirects[0].url, "https://descall.com/discord-alternative?x=1");
}

console.log("canonicalHost.selftest.cjs: ok");
