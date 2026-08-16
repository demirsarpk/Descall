"use strict";

const crypto = require("crypto");

function encryptionKey() {
  const secret = String(process.env.DIMA_KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || "").trim();
  if (secret.length < 16) {
    throw new Error("JWT_SECRET or DIMA_KEY_ENCRYPTION_SECRET is required to store provider keys");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decryptSecret(payload) {
  const parts = String(payload || "").split(":");
  if (parts.length !== 3) throw new Error("Invalid secret payload");
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const out = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return out.toString("utf8");
}

function maskSecret(raw) {
  const s = String(raw || "").trim();
  if (s.length < 8) return "••••";
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

function secretParts(raw) {
  const s = String(raw || "").trim();
  return {
    prefix: s.slice(0, 4),
    suffix: s.slice(-4),
    mask: maskSecret(s),
  };
}

module.exports = {
  encryptSecret,
  decryptSecret,
  maskSecret,
  secretParts,
};
