/**
 * Activation progress persistence checks.
 * Run: node frontend/src/lib/activationProgress.selftest.mjs
 */
import {
  ACTIVATION_STEPS,
  activationCompletedCount,
  dismissActivation,
  isActivationComplete,
  loadActivationProgress,
  markActivationStep,
  openActivation,
  saveActivationProgress,
  shouldShowActivation,
} from "./activationProgress.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};

const userId = "user-1";
assert(ACTIVATION_STEPS.length === 3, "three steps");
assert(!shouldShowActivation({ userId, friendsCount: 2 }), "no show for settled accounts");
assert(shouldShowActivation({ userId, friendsCount: 0 }), "show for empty friends");
assert(shouldShowActivation({ userId, justRegistered: true }), "show for justRegistered");

openActivation(userId);
const opened = loadActivationProgress(userId);
assert(opened.openedAt, "openedAt set");
assert(shouldShowActivation({ userId, friendsCount: 2 }), "stay open after openActivation");

markActivationStep(userId, "invite");
markActivationStep(userId, "friend");
markActivationStep(userId, "call");
const done = loadActivationProgress(userId);
assert(isActivationComplete(done), "complete");
assert(activationCompletedCount(done) === 3, "count 3");
assert(!shouldShowActivation({ userId, friendsCount: 0 }), "hide when complete");

dismissActivation(userId);
saveActivationProgress(userId, { ...loadActivationProgress(userId), completed: { invite: false, friend: false, call: false }, dismissed: true });
assert(!shouldShowActivation({ userId, justRegistered: true }), "dismissed wins");

console.log("activationProgress.selftest.mjs: ok");
