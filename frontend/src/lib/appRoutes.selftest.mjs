import {
  appPathForView,
  directPath,
  groupPath,
  isAuthenticatedAppPath,
  parseAppRoute,
} from "./appRoutes.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(directPath("Ada Test") === "/direct/Ada%20Test", "encode direct usernames");
assert(groupPath("group-123") === "/groups/group-123", "group route");
assert(appPathForView("friends") === "/friends", "friends menu route");
assert(isAuthenticatedAppPath("/direct/ada"), "recognize DM app route");
assert(!isAuthenticatedAppPath("/features"), "keep marketing route public");
assert(parseAppRoute("/direct/Ada%20Test").username === "Ada Test", "parse DM username");
assert(parseAppRoute("/groups/group-123").groupId === "group-123", "parse group id");
assert(parseAppRoute("/settings/voice").settingsTab === "voice", "parse settings tab");
assert(parseAppRoute("/not-real").unknown, "unknown route fallback");

console.log("appRoutes.selftest.mjs: ok");
