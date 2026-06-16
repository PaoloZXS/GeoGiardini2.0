const VAPID_PLACEHOLDER = "INSERISCI_VAPID_PUBLIC_KEY";

async function fetchVapidPublicKey(): Promise<string> {
  try {
    const response = await fetch("/api/vapid-public-key");
    if (!response.ok) return VAPID_PLACEHOLDER;
    const payload = await response.json();
    return payload.vapidPublicKey || VAPID_PLACEHOLDER;
  } catch {
    return VAPID_PLACEHOLDER;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getCurrentPushSubscriptionEndpoint(): Promise<string> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription?.endpoint || "";
  } catch {
    return "";
  }
}

export async function initPushNotifications(userId: string): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("[Push] Browser non supporta notifiche push");
    return;
  }

  const vapidPublicKey = await fetchVapidPublicKey();
  if (vapidPublicKey.includes(VAPID_PLACEHOLDER)) {
    // Fallback: usa la chiave dall'env (per sviluppo locale)
    const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!envKey) {
      console.log("[Push] Chiave VAPID non configurata");
      return;
    }
    await subscribeUser(userId, envKey);
    return;
  }

  await subscribeUser(userId, vapidPublicKey);
}

async function subscribeUser(userId: string, vapidPublicKey: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // Se già iscritto con stessa chiave, mantieni
    if (subscription) {
      await saveSubscription(userId, subscription);
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[Push] Permesso notifiche negato");
      return;
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource
    });

    await saveSubscription(userId, subscription);
    console.log("[Push] Iscrizione completata");
  } catch (error) {
    console.error("[Push] Errore iscrizione:", error);
  }
}

async function saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  try {
    const sub = subscription.toJSON();
    await fetch("/api/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        endpoint: sub.endpoint,
        keys: sub.keys
      })
    });
  } catch (error) {
    console.error("[Push] Errore salvataggio subscription:", error);
  }
}

export async function sendPushNotification(
  title: string,
  body: string,
  excludeUserId?: string,
  url?: string
): Promise<void> {
  try {
    await fetch("/api/push-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, excludeUserId, url })
    });
  } catch (error) {
    console.error("[Push] Errore invio notifica:", error);
  }
}
