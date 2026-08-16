"use strict";

const express = require("express");
const supabase = require("../db/supabase");
const { encryptSecret, decryptSecret, secretParts } = require("../lib/ai/cryptoKeys");
const { envKeyEntries, pingWithKey, markKeyResult } = require("../lib/ai/provider-manager");
const { logInternal, USER_UNAVAILABLE } = require("../lib/ai/sanitize");

const router = express.Router();

function publicKeyRow(row) {
  return {
    id: row.id,
    source: "database",
    label: row.label,
    mask: `${row.key_prefix || "••••"}...${row.key_suffix || "••••"}`,
    enabled: row.enabled !== false,
    isPreferred: Boolean(row.is_preferred),
    failoverOrder: row.failover_order ?? 100,
    lastOkAt: row.last_ok_at || null,
    lastErrorAt: row.last_error_at || null,
    lastError: row.last_error || null,
    available: Boolean(row.enabled) && !isRecentlyFailing(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isRecentlyFailing(row) {
  if (!row.last_error_at) return false;
  if (row.last_ok_at && new Date(row.last_ok_at) > new Date(row.last_error_at)) return false;
  const age = Date.now() - new Date(row.last_error_at).getTime();
  return age < 15 * 60 * 1000;
}

async function loadDbRows() {
  const { data, error } = await supabase
    .from("dimaai_provider_keys")
    .select("id,label,key_prefix,key_suffix,enabled,is_preferred,failover_order,last_ok_at,last_error_at,last_error,created_at,updated_at,encrypted_secret")
    .order("failover_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

router.get("/keys", async (_req, res) => {
  try {
    const rows = await loadDbRows();
    const db = rows.map((row) => {
      const view = publicKeyRow(row);
      delete row.encrypted_secret;
      return view;
    });
    const env = envKeyEntries().map((k) => ({
      id: k.id,
      source: "environment",
      label: k.label,
      mask: k.mask,
      enabled: true,
      isPreferred: false,
      failoverOrder: k.failover_order,
      lastOkAt: null,
      lastErrorAt: null,
      lastError: null,
      available: true,
      readOnly: true,
    }));
    res.json({
      keys: [...db, ...env],
      counts: {
        database: db.length,
        environment: env.length,
        enabled: db.filter((k) => k.enabled).length + env.length,
      },
    });
  } catch (err) {
    logInternal("admin-list", err);
    res.status(500).json({ error: "Could not load provider keys." });
  }
});

router.post("/keys", async (req, res) => {
  try {
    const secret = String(req.body?.secret || req.body?.apiKey || "").trim();
    const label = String(req.body?.label || "Provider key").trim().slice(0, 80) || "Provider key";
    if (secret.length < 20) {
      return res.status(400).json({ error: "That key looks incomplete." });
    }
    const parts = secretParts(secret);
    const { data: existing } = await supabase
      .from("dimaai_provider_keys")
      .select("id")
      .eq("key_suffix", parts.suffix)
      .eq("key_prefix", parts.prefix)
      .limit(1);
    if (existing?.length) {
      return res.status(409).json({ error: "This key is already saved." });
    }
    const { count } = await supabase
      .from("dimaai_provider_keys")
      .select("id", { count: "exact", head: true });
    const failoverOrder = Number.isFinite(Number(req.body?.failoverOrder))
      ? Number(req.body.failoverOrder)
      : (count || 0) + 1;
    const isPreferred = Boolean(req.body?.isPreferred) || count === 0;
    if (isPreferred) {
      await supabase.from("dimaai_provider_keys").update({ is_preferred: false }).neq("id", "00000000-0000-0000-0000-000000000000");
    }
    const { data, error } = await supabase
      .from("dimaai_provider_keys")
      .insert({
        label,
        encrypted_secret: encryptSecret(secret),
        key_prefix: parts.prefix,
        key_suffix: parts.suffix,
        enabled: req.body?.enabled !== false,
        is_preferred: isPreferred,
        failover_order: failoverOrder,
        created_by: req.user.id,
      })
      .select("id,label,key_prefix,key_suffix,enabled,is_preferred,failover_order,last_ok_at,last_error_at,last_error,created_at,updated_at")
      .single();
    if (error) throw error;
    res.json({ key: publicKeyRow(data) });
  } catch (err) {
    logInternal("admin-add", err);
    res.status(500).json({ error: "Could not save that key." });
  }
});

router.patch("/keys/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const patch = { updated_at: new Date().toISOString() };
    if (typeof req.body?.label === "string") patch.label = req.body.label.trim().slice(0, 80) || "Provider key";
    if (typeof req.body?.enabled === "boolean") patch.enabled = req.body.enabled;
    if (Number.isFinite(Number(req.body?.failoverOrder))) patch.failover_order = Number(req.body.failoverOrder);
    if (req.body?.isPreferred === true) {
      await supabase.from("dimaai_provider_keys").update({ is_preferred: false }).neq("id", id);
      patch.is_preferred = true;
    }
    if (req.body?.isPreferred === false) patch.is_preferred = false;
    const { data, error } = await supabase
      .from("dimaai_provider_keys")
      .update(patch)
      .eq("id", id)
      .select("id,label,key_prefix,key_suffix,enabled,is_preferred,failover_order,last_ok_at,last_error_at,last_error,created_at,updated_at")
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Key not found." });
    res.json({ key: publicKeyRow(data) });
  } catch (err) {
    logInternal("admin-patch", err);
    res.status(500).json({ error: "Could not update that key." });
  }
});

router.delete("/keys/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dimaai_provider_keys")
      .delete()
      .eq("id", req.params.id)
      .select("id");
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: "Key not found." });
    res.json({ ok: true });
  } catch (err) {
    logInternal("admin-delete", err);
    res.status(500).json({ error: "Could not remove that key." });
  }
});

router.post("/keys/reorder", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: "Missing order." });
    for (let i = 0; i < ids.length; i += 1) {
      await supabase
        .from("dimaai_provider_keys")
        .update({ failover_order: i + 1, updated_at: new Date().toISOString() })
        .eq("id", ids[i]);
    }
    const rows = await loadDbRows();
    res.json({ keys: rows.map(publicKeyRow) });
  } catch (err) {
    logInternal("admin-reorder", err);
    res.status(500).json({ error: "Could not save failover order." });
  }
});

router.post("/keys/:id/test", async (req, res) => {
  try {
    if (String(req.params.id).startsWith("env:")) {
      const env = envKeyEntries().find((k) => k.id === req.params.id);
      if (!env) return res.status(404).json({ error: "Key not found." });
      try {
        await pingWithKey(env.apiKey);
        return res.json({ ok: true, available: true });
      } catch {
        return res.json({ ok: false, available: false, error: USER_UNAVAILABLE });
      }
    }
    const { data, error } = await supabase
      .from("dimaai_provider_keys")
      .select("id,encrypted_secret")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Key not found." });
    const apiKey = decryptSecret(data.encrypted_secret);
    try {
      await pingWithKey(apiKey);
      await markKeyResult({ id: data.id, source: "database" }, { ok: true });
      return res.json({ ok: true, available: true });
    } catch (err) {
      await markKeyResult({ id: data.id, source: "database" }, { ok: false, errorText: err.code || "error" });
      return res.json({ ok: false, available: false, error: USER_UNAVAILABLE });
    }
  } catch (err) {
    logInternal("admin-test", err);
    res.status(500).json({ error: "Could not test that key." });
  }
});

module.exports = router;
