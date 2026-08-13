import { API_BASE_URL } from "../config/api";
import { getToken } from "./storage";

function urlBase64ToUint8Array(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const bytes = atob(padded);
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

export async function subscribeWebPush() {
  const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
  const token = getToken();
  if (
    !publicKey ||
    !token ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    Notification.permission !== "granted"
  ) {
    return false;
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

  const response = await fetch(`${API_BASE_URL}/api/web-push/subscription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) throw new Error(`Push subscription failed (${response.status})`);
  return true;
}

/** Re-subscribe when the browser rotates the push endpoint (common on iOS PWA). */
export function listenForPushSubscriptionChange() {
  if (!("serviceWorker" in navigator)) return () => {};
  const onMessage = (event) => {
    if (event?.data?.type !== "descall:pushsubscriptionchange") return;
    subscribeWebPush().catch((error) => {
      console.warn("[WebPush] Resubscribe after endpoint change failed:", error?.message || error);
    });
  };
  navigator.serviceWorker.addEventListener("message", onMessage);
  return () => navigator.serviceWorker.removeEventListener("message", onMessage);
}
