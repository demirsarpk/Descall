"use strict";

/**
 * Firebase Cloud Messaging for native Android (Capacitor) devices.
 * Uses FIREBASE_SERVICE_ACCOUNT_JSON when set; otherwise no-ops so Web Push
 * remains the fallback delivery path.
 */

const supabase = require("../db/supabase");

let messaging = null;
let initAttempted = false;

function getMessaging() {
  if (initAttempted) return messaging;
  initAttempted = true;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      console.warn("[FCM] FIREBASE_SERVICE_ACCOUNT_JSON not set — native push disabled");
      return null;
    }
    const admin = require("firebase-admin");
    const cred = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(cred) });
    }
    messaging = admin.messaging();
  } catch (err) {
    console.warn("[FCM] init failed:", err?.message || err);
    messaging = null;
  }
  return messaging;
}

async function upsertDeviceToken(userId, token, platform = "android") {
  if (!userId || !token) return;
  const { error } = await supabase.from("device_push_tokens").upsert(
    {
      user_id: userId,
      token: String(token),
      platform: String(platform || "android"),
      last_seen: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
  if (error) throw error;
}

async function removeDeviceToken(userId, token) {
  if (!userId || !token) return;
  await supabase
    .from("device_push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token", token);
}

async function sendFcmToUsers(userIds, payload = {}) {
  const recipients = [...new Set((userIds || []).filter(Boolean))];
  const msg = getMessaging();
  if (!recipients.length || !msg) return { sent: 0 };

  const { data: rows, error } = await supabase
    .from("device_push_tokens")
    .select("token, user_id")
    .in("user_id", recipients);
  if (error) {
    console.warn("[FCM] load tokens failed:", error.message);
    return { sent: 0 };
  }

  const tokens = [...new Set((rows || []).map((r) => r.token).filter(Boolean))];
  if (!tokens.length) return { sent: 0 };

  const data = {};
  for (const [key, value] of Object.entries(payload || {})) {
    if (value == null) continue;
    data[key] = typeof value === "string" ? value : JSON.stringify(value);
  }

  const title = payload.title || "Descall";
  const body = payload.body || "";
  let sent = 0;

  await Promise.allSettled(
    tokens.map(async (token) => {
      try {
        await msg.send({
          token,
          notification: { title, body },
          data,
          android: {
            priority: "high",
            notification: {
              channelId: payload.type?.includes("call") ? "incoming_calls" : "descall_default",
              priority: "high",
              defaultSound: true,
              defaultVibrateTimings: true,
            },
          },
        });
        sent += 1;
      } catch (err) {
        const code = err?.errorInfo?.code || err?.code || "";
        if (
          String(code).includes("registration-token-not-registered") ||
          String(code).includes("invalid-registration-token")
        ) {
          await supabase.from("device_push_tokens").delete().eq("token", token);
          return;
        }
        console.warn("[FCM] send failed:", err?.message || err);
      }
    })
  );

  return { sent };
}

module.exports = {
  getMessaging,
  upsertDeviceToken,
  removeDeviceToken,
  sendFcmToUsers,
};
