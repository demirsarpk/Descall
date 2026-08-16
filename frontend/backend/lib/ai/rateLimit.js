"use strict";

const buckets = new Map();

function take(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= limit;
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.ip || req.socket?.remoteAddress || "unknown";
}

const MAX_MESSAGE_CHARS = 8000;
const MAX_CONTEXT_MESSAGES = 40;

function assertMessage(text) {
  const content = String(text || "").trim();
  if (!content) {
    const err = new Error("empty");
    err.code = "empty";
    throw err;
  }
  if (content.length > MAX_MESSAGE_CHARS) {
    const err = new Error("too_long");
    err.code = "too_long";
    throw err;
  }
  return content;
}

function allowUser(userId) {
  const id = String(userId || "anon");
  if (!take(`u-min:${id}`, 20, 60 * 1000)) return false;
  if (!take(`u-day:${id}`, 250, 24 * 60 * 60 * 1000)) return false;
  return true;
}

function allowIp(req) {
  const ip = clientIp(req);
  return take(`ip-min:${ip}`, 80, 60 * 1000);
}

module.exports = {
  MAX_MESSAGE_CHARS,
  MAX_CONTEXT_MESSAGES,
  assertMessage,
  allowUser,
  allowIp,
  clientIp,
};
