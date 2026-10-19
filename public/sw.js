/* Marcelo: recibe los avisos (Web Push) y abre la app al tocarlos. No guarda nada en caché. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  // Siempre hay que mostrar algo: si el mensaje llega raro, mostramos uno genérico.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Marcelo";
  const options = {
    body: typeof data.body === "string" ? data.body : "Tienes algo nuevo.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: typeof data.tag === "string" ? data.tag : "marcelo",
    data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/bandeja" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/bandeja";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
