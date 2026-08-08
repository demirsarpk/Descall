self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {};
  }

  event.waitUntil(self.registration.showNotification(payload.title || "Descall", {
    body: payload.body || "",
    icon: "/default-avatar.png",
    badge: "/favicon.svg",
    tag: payload.tag || "descall",
    renotify: true,
    data: { deepLink: payload.deepLink || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLink = new URL(event.notification.data?.deepLink || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: "descall:notification-click", deepLink });
      return;
    }
    await clients.openWindow(deepLink);
  })());
});
