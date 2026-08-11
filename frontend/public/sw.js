self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = {};
  }

  const type = payload.type || "";
  const isCall = type === "call" || type === "group-call";
  const actions = isCall
    ? [
        { action: "answer", title: type === "group-call" ? "Join" : "Answer" },
        { action: "decline", title: "Decline" },
      ]
    : [];

  event.waitUntil(self.registration.showNotification(payload.title || "Descall", {
    body: payload.body || "",
    icon: "/default-avatar.png",
    badge: "/favicon.svg",
    tag: payload.tag || "descall",
    renotify: true,
    requireInteraction: isCall,
    actions,
    data: {
      deepLink: payload.deepLink || "/",
      type,
      action: payload.action || "open",
      fromId: payload.fromId || null,
      from: payload.from || null,
      conversationId: payload.conversationId || payload.fromId || null,
      groupId: payload.groupId || null,
      callType: payload.callType || null,
    },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const clickAction = event.action || data.action || "open";
  const deepLink = new URL(data.deepLink || "/", self.location.origin).href;
  const message = {
    type: "descall:notification-click",
    deepLink,
    ...data,
    action: clickAction,
  };

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      existing.postMessage(message);
      return;
    }
    await clients.openWindow(deepLink);
  })());
});
