"use strict";

const webpush = require("web-push");
const supabase = require("../db/supabase");

let configured = false;

function configureWebPush() {
  if (configured) return true;

  const subject = process.env.WEB_PUSH_SUBJECT;
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

async function sendWebPushToUsers(userIds, payload) {
  const recipients = [...new Set((userIds || []).filter(Boolean))];
  if (!recipients.length || !configureWebPush()) return;

  const { data: subscriptions, error } = await supabase
    .from("web_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", recipients);
  if (error) {
    console.warn("[WebPush] Could not load subscriptions:", error.message);
    return;
  }

  const body = JSON.stringify(payload);
  await Promise.allSettled((subscriptions || []).map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
        { TTL: 60, urgency: "high" }
      );
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await supabase
          .from("web_push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
        return;
      }
      console.warn("[WebPush] Delivery failed:", error.message);
    }
  }));
}

/**
 * Group-call push notification. This used to be imported by
 * socket/groupHandlers.js but was never actually defined here, so every
 * `group:call:start` threw an uncaught TypeError ("sendGroupCallPush is not
 * a function") straight out of a socket event handler — which crashes the
 * entire Node process, dropping every connected user's socket and killing
 * any in-progress calls/signaling for the whole server, not just the one
 * group call being started. That single crash-on-every-group-call is the
 * root cause behind a wide range of previously reported group call symptoms
 * (sudden drops, calls where nobody can see/hear each other, banners never
 * reaching other members, etc).
 *
 * For now this is a thin wrapper around the existing Web Push (VAPID) path,
 * which already covers the "notify even while backgrounded" use case this
 * was meant for. Kept as a distinct export (rather than inlining a second
 * sendWebPushToUsers call at the call site) so a native/FCM delivery path
 * can be added here later without touching callers.
 */
async function sendGroupCallPush(userIds, payload = {}) {
  return sendWebPushToUsers(userIds, payload);
}

module.exports = { sendWebPushToUsers, sendGroupCallPush };
