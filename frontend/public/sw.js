self.addEventListener("push", event => { const d=event.data?.json?.()||{}; event.waitUntil(self.registration.showNotification(d.title||"Descall",{body:d.body||"",icon:"/icon.png",data:{deepLink:d.deepLink||"/"}})); });
self.addEventListener("notificationclick", event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data.deepLink)); });
