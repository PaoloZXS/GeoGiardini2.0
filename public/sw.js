// public/sw.js
const CACHE_NAME = "geogiardini-v8";
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

// Gestione notifiche push - CORRETTA (con event.waitUntil obbligatorio per SW)
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification ricevuta");

  event.waitUntil(
    (async () => {
      let data = {};

      try {
        // Prova a parsare il payload JSON
        if (event.data) {
          data = event.data.json();
        }
      } catch (error) {
        console.error("[SW] Errore parsing push data:", error);
        data = {
          title: "GeoGiardini",
          body: "Nuova attività da verificare"
        };
      }

      // Assicurati che title e body esistano
      const title = data.title || "GeoGiardini";
      const body = data.body || "Hai una nuova notifica";

      const options = {
        body: body,
        icon: "/leaf-512.png",
        badge: "/leaf-512.png",
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
          url: data.url || "/",
          timestamp: Date.now()
        },
        actions: [
          {
            action: "open",
            title: "Apri"
          },
          {
            action: "close",
            title: "Chiudi"
          }
        ]
      };

      console.log("[SW] Mostra notifica:", title, body);

      try {
        await self.registration.showNotification(title, options);
        console.log("[SW] Notifica mostrata con successo");
      } catch (error) {
        console.error("[SW] Errore nel mostrare la notifica:", error);
      }
    })()
  );
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
