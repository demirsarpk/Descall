"use strict";

const assert = require("assert");
const { encryptSecret, decryptSecret, maskSecret } = require("./cryptoKeys");
const { sanitizeProviderText, publicErrorForStatus, adminPingError } = require("./sanitize");
const { shouldFailover } = require("./provider-manager");
const { classifyHttpStatus, modelCandidates, extractText, thinkingConfigFor } = require("./gemini");

process.env.JWT_SECRET = process.env.JWT_SECRET || "dimaai-test-secret-min-32-characters!!";

const sample = "AIzaSyDummyTestKeyValue1234567890abcd";
const enc = encryptSecret(sample);
assert.notEqual(enc, sample);
assert.equal(decryptSecret(enc), sample);
assert.equal(maskSecret(sample), "AIza...abcd");
assert.ok(!enc.includes("AIza"));

const leaked = sanitizeProviderText("Gemini 2.0 Flash error from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash");
assert.ok(!/gemini/i.test(leaked));
assert.ok(!/googleapis/i.test(leaked));
assert.equal(publicErrorForStatus(503), "Dima is temporarily unavailable. Please try again shortly.");
assert.equal(adminPingError("auth"), "This key was rejected.");
assert.equal(adminPingError("request"), "This key could not be verified.");
assert.equal(classifyHttpStatus(404), "request");
assert.equal(classifyHttpStatus(401), "auth");
assert.equal(modelCandidates()[0], "gemini-3.6-flash");
assert.ok(!modelCandidates().includes("gemini-2.0-flash"));

assert.deepEqual(thinkingConfigFor("gemini-3.6-flash"), { thinkingLevel: "minimal" });
assert.deepEqual(thinkingConfigFor("gemini-3.5-flash"), { thinkingLevel: "minimal" });
assert.deepEqual(thinkingConfigFor("gemini-2.5-flash"), { thinkingBudget: 0 });
assert.equal(thinkingConfigFor("unknown-model"), null);
assert.equal(
  extractText({
    candidates: [{ content: { parts: [{ thought: true, text: "hidden" }, { text: "visible reply" }] } }],
  }),
  "visible reply",
);
assert.equal(
  extractText({ candidates: [{ content: { parts: [{ thought: true, text: "only thinking" }] } }] }),
  "",
);

assert.equal(shouldFailover("unavailable"), true);
assert.equal(shouldFailover("auth"), true);
assert.equal(shouldFailover("quota"), false);
assert.equal(shouldFailover("request"), false);

console.log("dimaai unit checks ok");
