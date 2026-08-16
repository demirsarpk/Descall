import { historyBucket, formatRelTime } from "./historyUtils.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const now = Date.now();
const todayNoon = new Date();
todayNoon.setHours(12, 0, 0, 0);
const yesterday = new Date(todayNoon.getTime() - 24 * 3600 * 1000);
const previous = new Date(todayNoon.getTime() - 8 * 86400 * 1000);
assert(historyBucket(todayNoon.toISOString()) === "today", "now is today");
assert(historyBucket(yesterday.toISOString()) === "yesterday", "yesterday noon is yesterday");
assert(historyBucket(previous.toISOString()) === "previous", "8 days ago is previous");
assert(formatRelTime("", "en") === "", "empty timestamp is blank");
assert(formatRelTime(new Date(now - 120 * 1000).toISOString(), "en").length > 0, "relative time is non-empty");

console.log("historyUtils.selftest.mjs: ok");
