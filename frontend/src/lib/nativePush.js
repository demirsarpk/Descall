import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { API_BASE_URL } from "../config/api";
import { getToken } from "./storage";

let listenersAttached = false;
let lastToken = null;

function dispatchNotificationAction(payload = {}) {
  const detail = {
    type: payload.type || payload.data?.type || "call",
    action: payload.action || payload.data?.action || "open",
    fromId: payload.fromId || payload.data?.fromId || payload.conversationId || payload.data?.conversationId,
    from: payload.from || payload.data?.from,
    conversationId: payload.conversationId || payload.data?.conversationId || payload.fromId || payload.data?.fromId,
    groupId: payload.groupId || payload.data?.groupId,
    callType: payload.callType || payload.data?.callType || "voice",
    deepLink: payload.deepLink || payload.data?.deepLink,
  };
  window.dispatchEvent(new CustomEvent("descall:notification-click", { detail }));
  if (detail.action === "answer" || detail.action === "accept" || detail.action === "join") {
    window.dispatchEvent(new CustomEvent("descall:call-action", { detail: { ...detail, action: "accept" } }));
  }
  if (detail.action === "decline") {
    window.dispatchEvent(new CustomEvent("descall:call-action", { detail: { ...detail, action: "decline" } }));
  }
}

async function uploadFcmToken(token) {
  const auth = getToken();
  if (!auth || !token) return false;
  lastToken = token;
  const response = await fetch(`${API_BASE_URL}/api/web-push/fcm-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token,
      platform: Capacitor.getPlatform?.() || "android",
    }),
  });
  if (!response.ok) throw new Error(`FCM token upload failed (${response.status})`);
  return true;
}

function ensureListeners() {
  if (listenersAttached || !Capacitor.isNativePlatform()) return;
  listenersAttached = true;

  PushNotifications.addListener("registration", (token) => {
    const value = token?.value || token;
    if (!value) return;
    uploadFcmToken(value).catch((err) => {
      console.warn("[NativePush] token upload failed:", err?.message || err);
    });
  });

  PushNotifications.addListener("registrationError", (error) => {
    console.warn("[NativePush] registration error:", error?.error || error);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    // Foreground delivery — route into in-app handlers when it's a call.
    const data = notification?.data || {};
    if (data.type === "call" || data.type === "group-call") {
      dispatchNotificationAction({ ...data, action: data.action || "open" });
    }
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    const data = event?.notification?.data || {};
    const actionId = event?.actionId;
    const action =
      actionId === "accept" || actionId === "answer" || actionId === "JOIN"
        ? "answer"
        : actionId === "decline" || actionId === "DECLINE"
          ? "decline"
          : data.action || "open";
    dispatchNotificationAction({ ...data, action });
  });
}

export async function requestNativePushPermission() {
  if (!Capacitor.isNativePlatform()) return null;
  ensureListeners();
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") return permission.receive;
  await PushNotifications.register();
  return "granted";
}

/** Re-upload last/known token after login. */
export async function syncNativePushToken() {
  if (!Capacitor.isNativePlatform()) return false;
  ensureListeners();
  try {
    const permission = await PushNotifications.checkPermissions();
    if (permission.receive !== "granted") return false;
    await PushNotifications.register();
    if (lastToken) await uploadFcmToken(lastToken);
    return true;
  } catch (err) {
    console.warn("[NativePush] sync failed:", err?.message || err);
    return false;
  }
}

export function isNativePushPlatform() {
  return Capacitor.isNativePlatform();
}
