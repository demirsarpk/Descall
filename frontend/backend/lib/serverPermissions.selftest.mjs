/**
 * Lightweight permission overwrite / fail-closed checks (no Jest).
 * Run: node frontend/backend/lib/serverPermissions.selftest.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const {
  Permissions,
  hasPermission,
  applyOverwrites,
  EVERYONE_DEFAULT,
} = require("./serverPermissions.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const everyoneRoleId = "role-everyone";
const staffRoleId = "role-staff";
const userId = "user-1";

// Staff-only channel: @everyone denied VIEW, staff allowed VIEW
const overwrites = [
  {
    target_type: "role",
    target_id: everyoneRoleId,
    deny_permissions: String(Permissions.VIEW_CHANNEL),
    allow_permissions: "0",
    _position: 0,
  },
  {
    target_type: "role",
    target_id: staffRoleId,
    deny_permissions: "0",
    allow_permissions: String(Permissions.VIEW_CHANNEL),
    _position: 10,
  },
];

const everyoneBits = applyOverwrites(EVERYONE_DEFAULT, overwrites, {
  everyoneRoleId,
  memberRoleIds: new Set([everyoneRoleId]),
  userId,
});
assert(!hasPermission(everyoneBits, Permissions.VIEW_CHANNEL), "@everyone must not see staff channel");

const staffBits = applyOverwrites(EVERYONE_DEFAULT, overwrites, {
  everyoneRoleId,
  memberRoleIds: new Set([everyoneRoleId, staffRoleId]),
  userId,
});
assert(hasPermission(staffBits, Permissions.VIEW_CHANNEL), "staff must see staff channel");

// Member-specific deny beats role allow
const memberDeny = [
  ...overwrites,
  {
    target_type: "member",
    target_id: userId,
    deny_permissions: String(Permissions.VIEW_CHANNEL),
    allow_permissions: "0",
  },
];
const deniedStaff = applyOverwrites(EVERYONE_DEFAULT, memberDeny, {
  everyoneRoleId,
  memberRoleIds: new Set([everyoneRoleId, staffRoleId]),
  userId,
});
assert(!hasPermission(deniedStaff, Permissions.VIEW_CHANNEL), "member deny must win");

console.log("serverPermissions.selftest: ok");
