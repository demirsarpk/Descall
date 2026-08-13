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
    : type === "dm" || type === "mention"
      ? [{ action: "open", title: "Open" }]
      : [];

  event.waitUntil(self.registration.showNotification(payload.title || "Descall", {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
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
      serverId: payload.serverId || null,
      channelId: payload.channelId || null,
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

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        client.postMessage({ type: "descall:pushsubscriptionchange" });
      }
    } catch {
      /* ignore */
    }
  })());
});
