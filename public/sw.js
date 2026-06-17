// public/sw.js
const CACHE_NAME = "geogiardini-v9"; // 🔄 aggiornato
const STATIC_CACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/leaf-512.png"
];

// Installazione
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_CACHE_URLS);
    })
  );
});

// Attivazione
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Rimuovi cache vecchie
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        );
      }),
      // Prendi il controllo immediato
      self.clients.claim()
    ])
  );
});

// Gestione notifiche push
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification ricevuta");

  // IMPORTANTE: mantieni il SW attivo più a lungo possibile
  event.waitUntil(
    (async () => {
      // Estrai i dati
      let data = {};
      try {
        if (event.data) {
          data = event.data.json();
        }
      } catch (error) {
        console.error("[SW] Errore parsing:", error);
        data = {
          title: "GeoGiardini",
          body: "Nuova attività da verificare"
        };
      }

      const title = data.title || "GeoGiardini";
      const body = data.body || "Hai una nuova notifica";

      const options = {
        body: body,
        icon: "/leaf-512.png",
        badge: "/leaf-512.png",
        requireInteraction: true, // La notifica rimane fino a interazione utente
        vibrate: [200, 100, 200],
        data: { url: data.url || "/" }
      };

      // Mostra la notifica
      await self.registration.showNotification(title, options);

      // AGGIUNTA: Sync per mantenere vivo il SW
      if (self.sync) {
        await self.registration.sync.register("push-sync");
      }

      console.log("[SW] Notifica mostrata con successo");
    })()
  );
});

// Aggiunto: mantiene il SW attivo anche in background
self.addEventListener("sync", (event) => {
  if (event.tag === "push-sync") {
    event.waitUntil(
      // Non fa nulla, ma mantiene il SW attivo
      Promise.resolve()
    );
  }
});

// Gestione click sulla notifica
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Click su notifica, azione:", event.action);

  event.notification.close();

  // Se l'azione è "close", chiudi e basta
  if (event.action === "close") {
    return;
  }

  // URL da aprire (per click generico o azione "open")
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      // Cerca una finestra già aperta
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      // Se c'è una finestra, mettila in focus
      for (const client of clientList) {
        if (client.url.includes(urlToOpen)) {
          client.focus();
          return;
        }
      }

      // Altrimenti apri una nuova finestra
      if (self.clients.openWindow) {
        await self.clients.openWindow(urlToOpen);
      }
    })()
  );
});

// Gestione messaggi dal client (opzionale)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
