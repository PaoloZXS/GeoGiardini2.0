const CACHE_NAME = "geogiardini-v4";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.json",
  "/leaf-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title || "GeoGiardini";
  const options = {
    body: data.body || data.message || "",
    icon: "/leaf-512.png",
    badge: "/leaf-512.png",
    requireInteraction: true,
    vibrate: [120, 80, 120],
    data: {
      url: data.url || "/",
      ...data.data
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "PUSH_RECEIVED") {
    const { title, body } = event.data;
    self.registration.showNotification(title || "GeoGiardini", {
      body: body || "",
      icon: "/leaf-512.png",
      badge: "/leaf-512.png",
      requireInteraction: true,
      vibrate: [120, 80, 120]
    });
    // Forward to all clients
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => client.postMessage(event.data));
    });
  }
});
