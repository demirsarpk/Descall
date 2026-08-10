"use strict";

/**
 * Unit coverage for lib/descoin.js's two hardening fixes found while
 * live-testing the DesCoin economy:
 *   1. A failed ledger write must not leave the balance out of sync with
 *      the audit trail (applyDeltaWithLedger's rollback).
 *   2. Concurrent capped credits for the same user must not exceed the
 *      per-hour/day caps (creditCapped's per-user serialization queue).
 */

process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
process.env.SUPABASE_URL = "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-key";

const { createFakeSupabase } = require("./fakeSupabase.cjs");

const supabasePath = require.resolve("../db/supabase");
const fakeSupabase = createFakeSupabase({
  users: [{ id: "u-charlie", username: "charlie", descoin_balance: 0 }],
  descoin_ledger: [],
});
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: fakeSupabase };

const descoin = require("../lib/descoin");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

function userRow() {
  return fakeSupabase._tables.users.rows.find((u) => u.id === "u-charlie");
}

async function run() {
  // --- Fix 1: ledger-write failure must roll back the balance change ---
  const ledgerTable = fakeSupabase._tables.descoin_ledger;
  const originalInsert = fakeSupabase.from;
  fakeSupabase.from = function (name) {
    const query = originalInsert.call(fakeSupabase, name);
    if (name === "descoin_ledger") {
      const originalThen = query.then.bind(query);
      query.then = (resolve, reject) => {
        if (query.mode === "insert") {
          return Promise.resolve({ data: null, error: { message: "simulated ledger failure" } }).then(
            resolve,
            reject
          );
        }
        return originalThen(resolve, reject);
      };
    }
    return query;
  };

  let threw = false;
  try {
    await descoin.credit("u-charlie", 100, "admin_grant", {});
  } catch (err) {
    threw = true;
    assert(err.message === "simulated ledger failure", "credit rethrows the ledger error");
  }
  assert(threw, "credit() propagates a ledger-write failure instead of swallowing it");
  assert(userRow().descoin_balance === 0, "balance rolled back to 0 after the ledger write failed");
  assert(ledgerTable.rows.length === 0, "no ledger row was left behind by the failed write");

  fakeSupabase.from = originalInsert; // restore real behavior for the rest of the test

  // A subsequent legitimate credit still works normally after a rollback
  const result = await descoin.credit("u-charlie", 100, "admin_grant", {});
  assert(result.credited === 100 && result.balance === 100, "credit works normally post-rollback");
  assert(ledgerTable.rows.length === 1, "exactly one ledger row for the successful credit");

  // --- Fix 2: concurrent creditCapped calls must not exceed the cap ---
  await descoin.debit("u-charlie", 100, "admin_revoke", {}); // reset to 0 for a clean cap window
  ledgerTable.rows.length = 0; // clear ledger so sumCreditsSince starts fresh

  const cap = descoin.CAPS.message_activity.perHour; // 30
  const concurrentCalls = cap + 15; // deliberately over-request
  const results = await Promise.all(
    Array.from({ length: concurrentCalls }, () => descoin.creditCapped("u-charlie", 1, "message_activity", {}))
  );
  const totalCredited = results.reduce((sum, r) => sum + r.credited, 0);
  assert(totalCredited === cap, `concurrent credits stop exactly at the ${cap}/hour cap, got ${totalCredited}`);
  assert(userRow().descoin_balance === cap, "final balance matches the capped total, not the over-requested total");
  const messageLedgerRows = ledgerTable.rows.filter((r) => r.reason === "message_activity");
  assert(
    messageLedgerRows.reduce((sum, r) => sum + r.amount, 0) === cap,
    "ledger sum matches the balance — no drift under concurrency"
  );

  console.log("descoin.unit.test.cjs: ok");
}

run().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
