interface SendPushOptions {
  title: string;
  body: string;
  excludeUserId?: string;
  url?: string;
  includeAdmins?: boolean;
  includeOtherGardeners?: boolean;
  recipientIds?: string[];
}

/**
 * Invia una notifica push tramite l'API endpoint.
 * excludeUserId: l'ID dell'utente mittente (non riceverà la notifica)
 * includeAdmins: se true, invia a tutti gli admin
 * includeOtherGardeners: se true, invia a tutti i giardinieri (escluso mittente)
 * recipientIds: array specifico di user_id a cui inviare
 */
export async function sendPushNotification(
  titleOrOptions: string | SendPushOptions,
  body?: string,
  excludeUserId?: string,
  url?: string
): Promise<{ sent: number; total: number } | null> {
  let payload: SendPushOptions;

  if (typeof titleOrOptions === "string") {
    payload = {
      title: titleOrOptions,
      body: body || "",
      excludeUserId: excludeUserId || undefined,
      url: url || "/"
    };
  } else {
    payload = titleOrOptions;
  }

  try {
    const res = await fetch("/api/push-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("Push send error:", errData.error || res.statusText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Push send network error:", err);
    return null;
  }
}

/**
 * Ottiene la VAPID public key dall'API
 */
export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/vapid-public-key");
    const data = await res.json();
    return data.vapidPublicKey || null;
  } catch {
    return null;
  }
}

/**
 * Converte una stringa base64 url-safe in un Uint8Array
 * (richiesto da PushManager.subscribe)
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
