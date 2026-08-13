"use strict";

const webpush = require("web-push");
const supabase = require("../db/supabase");
const { sendFcmToUsers } = require("./fcm");

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

async function deliverPush(userIds, payload = {}) {
  await Promise.allSettled([
    sendWebPushToUsers(userIds, payload),
    sendFcmToUsers(userIds, payload),
  ]);
}

/**
 * Group-call push notification. Thin wrapper around VAPID + FCM so native and
 * installed PWAs wake even when backgrounded.
 */
async function sendGroupCallPush(userIds, payload = {}) {
  const body = {
    type: "group-call",
    title: payload.title || "Group call",
    body: payload.body || "Someone started a group call on Descall",
    tag: payload.tag || "group-call",
    deepLink: payload.deepLink || "/",
    ...payload,
  };
  await deliverPush(userIds, body);
}

/** DM / 1:1 incoming call — wake backgrounded native + web clients. */
async function sendIncomingCallPush(userIds, payload = {}) {
  const body = {
    type: "call",
    title: payload.title || "Incoming call",
    body: payload.body || "Someone is calling you on Descall",
    tag: payload.tag || "incoming-call",
    deepLink: payload.deepLink || "/",
    ...payload,
  };
  await deliverPush(userIds, body);
}

/** Direct message while recipient is backgrounded / offline. */
async function sendDmMessagePush(userIds, payload = {}) {
  const preview = String(payload.body || payload.text || "New message").slice(0, 140);
  const body = {
    type: "dm",
    title: payload.title || payload.from || "New message",
    body: preview,
    tag: payload.tag || `dm-${payload.fromId || "msg"}`,
    deepLink: payload.deepLink || (payload.fromId ? `/?dm=${encodeURIComponent(payload.fromId)}` : "/"),
    conversationId: payload.fromId || payload.conversationId || null,
    fromId: payload.fromId || null,
    from: payload.from || null,
    ...payload,
    body: preview,
  };
  await deliverPush(userIds, body);
}

/** @mention in a server channel or DM. */
async function sendMentionPush(userIds, payload = {}) {
  const preview = String(payload.body || payload.text || "mentioned you").slice(0, 140);
  const deepLink =
    payload.deepLink ||
    (payload.serverId && payload.channelId
      ? `/?server=${encodeURIComponent(payload.serverId)}&channel=${encodeURIComponent(payload.channelId)}`
      : payload.fromId
        ? `/?dm=${encodeURIComponent(payload.fromId)}`
        : "/");
  const body = {
    type: "mention",
    title: payload.title || `${payload.from || "Someone"} mentioned you`,
    body: preview,
    tag: payload.tag || `mention-${payload.messageId || payload.channelId || "x"}`,
    deepLink,
    serverId: payload.serverId || null,
    channelId: payload.channelId || null,
    messageId: payload.messageId || null,
    from: payload.from || null,
    ...payload,
    body: preview,
    deepLink,
  };
  await deliverPush(userIds, body);
}

module.exports = {
  sendWebPushToUsers,
  sendGroupCallPush,
  sendIncomingCallPush,
  sendDmMessagePush,
  sendMentionPush,
};
