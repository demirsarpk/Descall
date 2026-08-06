"use strict";

const supabase = require("../db/supabase");

let firebaseAdmin;
let firebaseInitialized = false;

function getFirebaseMessaging() {
  if (firebaseInitialized) return firebaseAdmin?.messaging?.() || null;
  firebaseInitialized = true;

  const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) {
    console.warn("[push] Firebase is not configured; mobile push delivery is disabled.");
    return null;
  }

  try {
    const credentials = JSON.parse(rawCredentials);
    firebaseAdmin = require("firebase-admin");
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(credentials),
    });
    return firebaseAdmin.messaging();
  } catch (err) {
    console.error("[push] Firebase initialization failed:", err.message);
    return null;
  }
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function sendPushNotification({ userId, preference, title, body, data = {} }) {
  const messaging = getFirebaseMessaging();
  if (!messaging || !userId) return { sent: 0, skipped: true };

  const { data: preferences, error: preferencesError } = await supabase
    .from("notification_preferences")
    .select(preference)
    .eq("user_id", userId)
    .maybeSingle();
  if (preferencesError) throw preferencesError;
  if (preferences && preferences[preference] === false) return { sent: 0, skipped: true };

  const { data: devices, error: devicesError } = await supabase
    .from("push_devices")
    .select("push_token")
    .eq("user_id", userId);
  if (devicesError) throw devicesError;

  const tokens = [...new Set((devices || []).map((device) => device.push_token).filter(Boolean))];
  if (tokens.length === 0) return { sent: 0, skipped: true };

  const payload = {
    notification: {
      title: cleanText(title, 120),
      body: cleanText(body, 500),
    },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, cleanText(value, 256)])
    ),
  };
  const response = await messaging.sendEachForMulticast({ tokens, ...payload });
  const invalidTokens = response.responses
    .map((result, index) => ({ result, token: tokens[index] }))
    .filter(({ result }) =>
      !result.success &&
      ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]
        .includes(result.error?.code)
    )
    .map(({ token }) => token);

  if (invalidTokens.length > 0) {
    const { error } = await supabase.from("push_devices").delete().in("push_token", invalidTokens);
    if (error) console.warn("[push] Could not remove invalid device tokens:", error.message);
  }

  return { sent: response.successCount, failed: response.failureCount };
}

module.exports = { sendPushNotification };
