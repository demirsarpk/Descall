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

module.exports = { sendWebPushToUsers };
