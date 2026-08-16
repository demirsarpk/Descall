"use strict";

const supabase = require("../../db/supabase");
const gemini = require("./gemini");
const { decryptSecret, secretParts } = require("./cryptoKeys");
const { logInternal } = require("./sanitize");

const sticky = { keyId: null };

function envKeyEntries() {
  const found = [];
  const seen = new Set();
  const push = (raw, label) => {
    const key = String(raw || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    const parts = secretParts(key);
    found.push({
      id: `env:${label}`,
      source: "environment",
      label,
      apiKey: key,
      enabled: true,
      is_preferred: found.length === 0,
      failover_order: 1000 + found.length,
      mask: parts.mask,
      key_prefix: parts.prefix,
      key_suffix: parts.suffix,
    });
  };
  push(process.env.GEMINI_API_KEY, "GEMINI_API_KEY");
  for (let i = 1; i <= 20; i += 1) {
    push(process.env[`GEMINI_API_KEY_${i}`], `GEMINI_API_KEY_${i}`);
  }
  return found;
}

async function loadDbKeys() {
  const { data, error } = await supabase
    .from("dimaai_provider_keys")
    .select("id,label,encrypted_secret,enabled,is_preferred,failover_order,key_prefix,key_suffix")
    .order("is_preferred", { ascending: false })
    .order("failover_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    logInternal("keys-load", error);
    return [];
  }
  const out = [];
  for (const row of data || []) {
    try {
      const apiKey = decryptSecret(row.encrypted_secret);
      out.push({
        id: row.id,
        source: "database",
        label: row.label,
        apiKey,
        enabled: row.enabled !== false,
        is_preferred: Boolean(row.is_preferred),
        failover_order: row.failover_order ?? 100,
        mask: `${row.key_prefix || ""}...${row.key_suffix || ""}`,
        key_prefix: row.key_prefix,
        key_suffix: row.key_suffix,
      });
    } catch (err) {
      logInternal("keys-decrypt", err, { status: 0 });
    }
  }
  return out;
}

function sortPool(keys) {
  return [...keys].sort((a, b) => {
    if (a.is_preferred !== b.is_preferred) return a.is_preferred ? -1 : 1;
    return (a.failover_order || 100) - (b.failover_order || 100);
  });
}

async function getKeyPool() {
  const db = (await loadDbKeys()).filter((k) => k.enabled && k.apiKey);
  const env = envKeyEntries();
  const dbSuffixes = new Set(db.map((k) => k.key_suffix));
  const extraEnv = env.filter((k) => !dbSuffixes.has(k.key_suffix));
  const pool = sortPool([...db, ...extraEnv]);
  if (sticky.keyId) {
    const idx = pool.findIndex((k) => k.id === sticky.keyId);
    if (idx > 0) {
      const [hit] = pool.splice(idx, 1);
      pool.unshift(hit);
    }
  }
  return pool;
}

async function markKeyResult(key, { ok, errorText }) {
  if (!key || key.source !== "database") return;
  const patch = { updated_at: new Date().toISOString() };
  if (ok) {
    patch.last_ok_at = new Date().toISOString();
    patch.last_error = null;
  } else {
    patch.last_error_at = new Date().toISOString();
    patch.last_error = String(errorText || "unavailable").slice(0, 180);
  }
  const { error } = await supabase.from("dimaai_provider_keys").update(patch).eq("id", key.id);
  if (error) logInternal("keys-mark", error);
}

function shouldFailover(code) {
  return code === "unavailable" || code === "auth";
}

/**
 * Complete with sticky key + failover on auth/unavailable only.
 * Quota (429) does not rotate to another key.
 */
async function completeWithFailover({ messages, signal, onToken }) {
  const pool = await getKeyPool();
  if (!pool.length) {
    const err = new Error("no_keys");
    err.code = "no_keys";
    throw err;
  }

  let lastErr = null;
  for (let i = 0; i < pool.length; i += 1) {
    const key = pool[i];
    try {
      const result = await gemini.complete({
        apiKey: key.apiKey,
        messages,
        signal,
        onToken,
      });
      sticky.keyId = key.id;
      await markKeyResult(key, { ok: true });
      return result;
    } catch (err) {
      if (err?.code === "aborted") throw err;
      lastErr = err;
      await markKeyResult(key, { ok: false, errorText: err.code || "error" });
      if (err.code === "quota" || err.code === "request") throw err;
      if (!shouldFailover(err.code)) throw err;
      logInternal("failover", { message: `trying next configured key (${i + 1}/${pool.length})` });
    }
  }
  throw lastErr || new Error("unavailable");
}

async function pingWithKey(apiKey, signal) {
  return gemini.pingKey(apiKey, signal);
}

module.exports = {
  envKeyEntries,
  getKeyPool,
  completeWithFailover,
  pingWithKey,
  markKeyResult,
  shouldFailover,
};
