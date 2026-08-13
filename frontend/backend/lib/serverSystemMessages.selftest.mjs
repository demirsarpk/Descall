/**
 * Lightweight static checks for system messages + insights helpers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const systemSrc = readFileSync(join(dir, "serverSystemMessages.js"), "utf8");
const insightsSrc = readFileSync(join(dir, "serverInsights.js"), "utf8");
const routesSrc = readFileSync(join(dir, "../routes/servers.js"), "utf8");
const voiceSrc = readFileSync(join(dir, "../socket/serverVoiceHandlers.js"), "utf8");

assert.match(systemSrc, /message_type:\s*"system"/);
assert.match(systemSrc, /member_join/);
assert.match(systemSrc, /member_leave/);
assert.match(systemSrc, /member_kick/);
assert.match(systemSrc, /member_ban/);
assert.match(systemSrc, /member_welcome/);

assert.match(insightsSrc, /server_voice_sessions/);
assert.match(insightsSrc, /getServerInsights/);
assert.match(insightsSrc, /recordVoiceSession/);

assert.match(routesSrc, /\/:id\/insights/);
assert.match(routesSrc, /VIEW_GUILD_INSIGHTS/);
assert.match(routesSrc, /postSystemMessage/);
assert.match(routesSrc, /kind:\s*"member_leave"/);
assert.match(routesSrc, /kind:\s*"member_kick"/);
assert.match(routesSrc, /kind:\s*"member_ban"/);

assert.match(voiceSrc, /recordVoiceSession/);
assert.match(voiceSrc, /joinedAt/);

console.log("serverSystemMessages.selftest: ok");
