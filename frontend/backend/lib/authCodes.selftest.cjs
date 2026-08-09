"use strict";

const { hashCode, isCodeFresh, verifyStoredCode } = require("./authCodes");

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
}

// hashCode is deterministic and code-sensitive
assert(hashCode("123456") === hashCode("123456"), "same code hashes identically");
assert(hashCode("123456") !== hashCode("654321"), "different codes hash differently");

// freshness window
const now = new Date().toISOString();
const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
assert(isCodeFresh(now) === true, "just-sent code is fresh");
assert(isCodeFresh(old) === false, "11-minute-old code is expired");
assert(isCodeFresh(null) === false, "no timestamp is not fresh");

// verifyStoredCode: correct code within window
const hash = hashCode("424242");
let result = verifyStoredCode({ code: "424242", storedHash: hash, sentAtIso: now, attempts: 0 });
assert(result.ok === true, "correct code within window verifies");

// wrong code
result = verifyStoredCode({ code: "000000", storedHash: hash, sentAtIso: now, attempts: 0 });
assert(result.ok === false && result.reason === "invalid_code", "wrong code rejected");

// expired
result = verifyStoredCode({ code: "424242", storedHash: hash, sentAtIso: old, attempts: 0 });
assert(result.ok === false && result.reason === "expired", "expired code rejected");

// too many attempts
result = verifyStoredCode({ code: "424242", storedHash: hash, sentAtIso: now, attempts: 5 });
assert(result.ok === false && result.reason === "too_many_attempts", "rate-limited after 5 attempts");

// missing pending code
result = verifyStoredCode({ code: "424242", storedHash: null, sentAtIso: null, attempts: 0 });
assert(result.ok === false && result.reason === "no_pending_code", "no pending code rejected");

console.log("authCodes.selftest.cjs: ok");
