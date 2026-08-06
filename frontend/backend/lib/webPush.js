"use strict";
const webpush = require("web-push");
const supabase = require("../db/supabase");
let configured = false;
function setup() {
  if (configured) return true;
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true; return true;
}
async function sendGroupCallPush(userIds, payload) {
  if (!setup() || !userIds?.length) return;
  const { data } = await supabase.from("web_push_subscriptions").select("*").in("user_id", userIds);
  await Promise.all((data || []).map(async (s) => {
    try { await webpush.sendNotification({ endpoint:s.endpoint, keys:{ p256dh:s.p256dh, auth:s.auth } }, JSON.stringify(payload)); }
    catch (e) { if ([404,410].includes(e.statusCode)) await supabase.from("web_push_subscriptions").delete().eq("endpoint",s.endpoint); else console.warn("[web-push]",e.message); }
  }));
}
module.exports = { sendGroupCallPush };
