// src/utils/pushNotifications.ts

const VAPID_PLACEHOLDER = "INSERISCI_VAPID_PUBLIC_KEY";

/**
 * Determina se l'app è in esecuzione in ambiente nativo (Capacitor/Android).
 * Usa un check runtime che non può essere ottimizzato da Vite.
 * Su web: nessuna delle due proprietà esiste → false
 * Su Android nativo: Capacitor setta androidBridge → true
 */
export function isNativePlatform(): boolean {
  try {
    return typeof window !== "undefined" && (
      // Capacitor bridge su Android
      !!(window as any).androidBridge ||
      // Capacitor plugin headers presenti
      !!(window as any).Capacitor?.isNative ||
      // Plugin disponibile
      !!(window as any).Capacitor?.Plugins?.PushNotifications
    );
  } catch {
    return false;
  }
}

/**
 * Determina l'URL base per le API in base all'ambiente.
 * In DEV: usa percorso relativo, il proxy di Vite (vite.config.ts) inoltra a localhost:3000.
 * In PROD: percorso relativo, Vercel gestisce le API.
 */
export function getApiBaseUrl(): string {
  return "";
}

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
 * Salva una sottoscrizione push sul server (upsert).
 * Ispirato dalla logica funzionante di CosaDaFare.
 */
export async function savePushSubscription(
  userId: string,
  groupName: string,
  subscription: PushSubscription
): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const subJSON = subscription.toJSON();
    const res = await fetch(`${baseUrl}/api/push-subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        group_name: groupName,
        endpoint: subscription.endpoint,
        keys: subJSON.keys
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error(
        "[Push] Errore salvataggio subscription:",
        errData.error || res.statusText
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Push] Errore salvataggio subscription:", err);
    return false;
  }
}

/**
 * Elimina una sottoscrizione push dal server.
 */
export async function deletePushSubscription(
  endpoint: string
): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/push-subscriptions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint })
    });
    return res.ok;
  } catch (err) {
    console.error("[Push] Errore cancellazione subscription:", err);
    return false;
  }
}

/**
 * Invia una notifica push tramite l'API endpoint.
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
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/push-send`;

    console.log("[Push] Invio notifica:", payload.title, "a", endpoint);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("[Push] Errore invio:", errData.error || res.statusText);
      return null;
    }

    const result = await res.json();
    console.log("[Push] Notifica inviata:", result);
    return result;
  } catch (err) {
    console.error("[Push] Errore di rete:", err);
    return null;
  }
}

/**
 * Ottiene la VAPID public key dall'API
 */
export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/api/vapid-public-key`;

    console.log("[Push] Recupero VAPID key da:", endpoint);

    const res = await fetch(endpoint);
    if (!res.ok) {
      console.error("[Push] Errore VAPID:", res.status);
      return null;
    }

    const data = await res.json();
    console.log("[Push] VAPID key ricevuta:", !!data.vapidPublicKey);
    return data.vapidPublicKey || null;
  } catch (err) {
    console.error("[Push] Errore VAPID:", err);
    return null;
  }
}

/**
 * Converte una stringa base64 url-safe in un Uint8Array
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

// ──────────────────────────────────────────────────
//  FUNZIONI OneSignal (per app nativa Android / Capacitor)
//  Nota: la registrazione/disiscrizione è gestita
//  direttamente dal plugin OneSignal lato client.
//  Le funzioni qui sono solo per compatibilità.
// ──────────────────────────────────────────────────
