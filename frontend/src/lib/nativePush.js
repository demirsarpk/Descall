import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export async function requestNativePushPermission() {
  if (!Capacitor.isNativePlatform()) return null;
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt") {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== "granted") return permission.receive;
  await PushNotifications.register();
  return "granted";
}
