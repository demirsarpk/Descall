"use strict";

/**
 * DesCoin — server-authoritative in-app currency.
 *
 * Design goals (per product spec): coins are earned by *genuinely* spending
 * time in the app — talking in a voice/video call, messaging, screen
 * sharing — never by a client simply claiming an amount. Every credit is:
 *   1. Gated on a fact the server itself already tracks (an active call /
 *      screen-share session with real participants), never on trusting the
 *      client's word alone.
 *   2. Rate-limited per hour/day per activity type AND by a global daily cap,
 *      computed by summing this user's own ledger rows — so replaying or
 *      spamming the same event stops paying out once the cap is hit.
 *   3. Logged to `descoin_ledger` (immutable audit trail) with the exact
 *      reason + context, so admins can review or reverse anomalies.
 *
 * Balance updates use optimistic concurrency (compare-and-swap on
 * users.descoin_balance) instead of a blind increment, so two concurrent
 * credits/debits for the same user can't race each other into an incorrect
 * balance.
 */

const supabase = require("../db/supabase");

const CAPS = {
  voice_activity: { perHour: 30, perDay: 180 },
  screenshare_activity: { perHour: 40, perDay: 220 },
  message_activity: { perHour: 30, perDay: 60 },
};

const GLOBAL_DAILY_CAP = 400;
const UNCAPPED_REASONS = new Set(["admin_grant", "admin_revoke", "shop_purchase"]);

function hoursAgoIso(h) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function todayStartIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function getBalance(userId) {
  const { data, error } = await supabase
    .from("users")
    .select("descoin_balance")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.descoin_balance ?? 0;
}

async function sumCreditsSince(userId, sinceIso, reason = null) {
  let query = supabase
    .from("descoin_ledger")
    .select("amount")
    .eq("user_id", userId)
    .gt("amount", 0)
    .gte("created_at", sinceIso);
  if (reason) query = query.eq("reason", reason);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + row.amount, 0);
}

/** Optimistic-concurrency balance mutation. Throws INSUFFICIENT_BALANCE on overdraw. */
async function applyDelta(userId, delta) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: row, error } = await supabase
      .from("users")
      .select("descoin_balance")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    const current = row?.descoin_balance ?? 0;
    const next = current + delta;
    if (next < 0) throw new Error("INSUFFICIENT_BALANCE");

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({ descoin_balance: next })
      .eq("id", userId)
      .eq("descoin_balance", current)
      .select("descoin_balance")
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return updated.descoin_balance;
    // Someone else updated the balance between our read and write — retry.
  }
  throw new Error("BALANCE_UPDATE_CONFLICT");
}

async function writeLedger(userId, amount, reason, meta, balanceAfter) {
  const { error } = await supabase.from("descoin_ledger").insert({
    user_id: userId,
    amount,
    reason,
    meta: meta || {},
    balance_after: balanceAfter,
  });
  if (error) throw error;
}

/**
 * Applies a balance delta and writes the matching ledger row. The audit
 * trail must never drift from the balance it explains, so if the ledger
 * write fails after the balance already moved, we compensate by reversing
 * the delta before rethrowing — callers can trust that either both sides
 * of the change land, or neither does.
 */
async function applyDeltaWithLedger(userId, delta, reason, meta) {
  const balance = await applyDelta(userId, delta);
  try {
    await writeLedger(userId, delta, reason, meta, balance);
  } catch (ledgerError) {
    try {
      await applyDelta(userId, -delta);
    } catch (rollbackError) {
      console.error(
        `[descoin] CRITICAL: ledger write failed for user ${userId} and rollback also failed — balance may be out of sync with the ledger.`,
        rollbackError
      );
    }
    throw ledgerError;
  }
  return balance;
}

/** Uncapped credit — used for admin grants and purchase refunds only. */
async function credit(userId, amount, reason, meta = {}) {
  const wholeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (wholeAmount <= 0) return { credited: 0, balance: await getBalance(userId) };
  const balance = await applyDeltaWithLedger(userId, wholeAmount, reason, meta);
  return { credited: wholeAmount, balance };
}

/** Debit for shop purchases / admin revokes. Throws INSUFFICIENT_BALANCE on overdraw. */
async function debit(userId, amount, reason, meta = {}) {
  const wholeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (wholeAmount <= 0) throw new Error("INVALID_AMOUNT");
  const balance = await applyDeltaWithLedger(userId, -wholeAmount, reason, meta);
  return { debited: wholeAmount, balance };
}

/**
 * Server-authoritative, rate-limited earning. Callers pass a `reason` that
 * must already be call/message-verified (see socket handlers) — this
 * function's only job is enforcing the anti-farm caps before crediting.
 * Silently clamps to whatever room remains instead of erroring, so a
 * legitimate heartbeat right at the cap boundary still gets a partial coin
 * instead of nothing.
 */
async function creditCapped(userId, amount, reason, meta = {}) {
  const caps = CAPS[reason];
  if (!caps) throw new Error(`Unknown capped DesCoin reason: ${reason}`);

  const [hourSum, daySum, globalDaySum] = await Promise.all([
    sumCreditsSince(userId, hoursAgoIso(1), reason),
    sumCreditsSince(userId, todayStartIso(), reason),
    sumCreditsSince(userId, todayStartIso()),
  ]);

  const hourRoom = caps.perHour != null ? caps.perHour - hourSum : Infinity;
  const dayRoom = caps.perDay != null ? caps.perDay - daySum : Infinity;
  const globalRoom = GLOBAL_DAILY_CAP - globalDaySum;

  const room = Math.floor(Math.min(amount, hourRoom, dayRoom, globalRoom));
  if (room <= 0) {
    const capped = hourRoom <= 0 ? "hour" : dayRoom <= 0 ? "day" : "global";
    return { credited: 0, capped, balance: await getBalance(userId) };
  }

  const balance = await applyDeltaWithLedger(userId, room, reason, meta);
  return { credited: room, capped: null, balance };
}

async function getLedger(userId, { limit = 50 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { data, error } = await supabase
    .from("descoin_ledger")
    .select("id, amount, reason, meta, balance_after, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(capped);
  if (error) throw error;
  return data || [];
}

module.exports = {
  CAPS,
  GLOBAL_DAILY_CAP,
  UNCAPPED_REASONS,
  getBalance,
  credit,
  debit,
  creditCapped,
  getLedger,
};
