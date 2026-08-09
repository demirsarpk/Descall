"use strict";

// Pure-function coverage only — set placeholder creds so requiring the
// module (which loads ../db/supabase eagerly) doesn't throw in CI/local
// runs without real Supabase env vars.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

const { describeDevice, clientIp } = require("./sessions");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

assert(
  describeDevice(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
  ) === "Chrome on Windows",
  "detects Chrome on Windows"
);
assert(
  describeDevice(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  ) === "Safari on iOS",
  "detects Safari on iOS"
);
assert(
  describeDevice("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0") ===
    "Firefox on Linux",
  "detects Firefox on Linux"
);
assert(describeDevice("Descall-Electron/2.8.11") === "Descall Desktop", "detects Electron client");
assert(describeDevice("") === "Browser on Unknown OS", "handles empty UA gracefully");

assert(
  clientIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }, ip: "9.9.9.9" }) === "1.2.3.4",
  "prefers first x-forwarded-for entry"
);
assert(
  clientIp({ headers: {}, ip: "9.9.9.9" }) === "9.9.9.9",
  "falls back to req.ip"
);
assert(
  clientIp({ headers: {}, ip: null, socket: { remoteAddress: "8.8.8.8" } }) === "8.8.8.8",
  "falls back to socket.remoteAddress"
);

console.log("sessions.selftest.cjs: ok");
