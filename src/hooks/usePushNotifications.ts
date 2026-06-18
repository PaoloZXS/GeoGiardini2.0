// src/hooks/usePushNotifications.ts
import { useState, useEffect, useCallback } from "react";
import {
  isNativePlatform,
  getVapidPublicKey,
  urlBase64ToUint8Array,
  savePushSubscription,
  deletePushSubscription,
  saveFcmToken,
  deleteFcmToken
} from "../utils/pushNotifications";

/**
 * Restituisce il groupName (ruolo) dell'utente loggato da localStorage.
 */
function getUserGroup(): string {
  return window.localStorage.getItem("loginRole") || "contatto";
}

function getUserId(): string | null {
  return window.localStorage.getItem("userId");
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState("default");
  const [error, setError] = useState<string | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // ── Sottoscrizione Web Push (PC / Browser PWA) ──
  const subscribeWeb = useCallback(async (userId: string, groupName: string): Promise<boolean> => {
    // 1) Verifica supporto browser
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      const msg = "Il browser non supporta le notifiche push.";
      console.warn("[Push]", msg);
      setError(msg);
      return false;
    }

    // 2) Richiedi permesso
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    setPermission(perm);
    if (perm !== "granted") {
      setError("Permesso notifiche negato.");
      return false;
    }

    // 3) Service worker
    const reg = await navigator.serviceWorker.ready;

    // 4) Chiave VAPID
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      setError("Chiave VAPID non configurata.");
      return false;
    }

    // 5) Rimuovi subscription precedente
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      await existingSub.unsubscribe();
    }

    // 6) Crea nuova
    const key = urlBase64ToUint8Array(vapidKey);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key as BufferSource
    });

    console.log("[Push] Sottoscrizione Web Push creata:", subscription.endpoint);

    // 7) Salva sul server
    const saved = await savePushSubscription(userId, groupName, subscription);
    if (!saved) throw new Error("Salvataggio subscription fallito.");

    console.log("[Push] Sottoscrizione Web salvata per gruppo:", groupName);
    setIsSubscribed(true);
    return true;
  }, []);

  // ── Sottoscrizione FCM (Android nativo / Capacitor) ──
  const subscribeNative = useCallback(async (userId: string, groupName: string): Promise<boolean> => {
    try {
      // Import dinamico del plugin Capacitor (solo in ambiente nativo)
      const { PushNotifications } = await import("@capacitor/push-notifications");

      // Richiedi permessi
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== "granted") {
        setError("Permesso notifiche negato sul dispositivo.");
        return false;
      }

      // Registra il dispositivo a FCM
      await PushNotifications.register();

      // Ascolta il token FCM
      const handle = await PushNotifications.addListener(
        "registration",
        (token) => {
          // Quando arriva il token, rimuovi il listener e salva
          handle.remove();

          console.log("[FCM] Token ricevuto:", token.value);
          setFcmToken(token.value);

          // Salva token sul server (fire-and-forget)
          saveFcmToken(userId, groupName, token.value).then((saved) => {
            if (saved) {
              setIsSubscribed(true);
              console.log("[FCM] Token salvato per gruppo:", groupName);
            } else {
              setError("Salvataggio token FCM fallito.");
            }
          });
        }
      );

      // Timeout sicurezza: se dopo 15s non arriva token, fallisce
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          handle.remove();
          setError("Registrazione FCM scaduta. Riprova.");
          resolve(false);
        }, 15000);

        // Quando il token arriva, il listener chiama handle.remove()
        // che risolve la promise. Intercettiamo remove per risolvere.
        const originalRemove = handle.remove.bind(handle);
        handle.remove = (): Promise<void> => {
          originalRemove();
          resolve(true);
          return Promise.resolve();
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore registrazione FCM.";
      console.error("[FCM] Errore:", err);
      setError(msg);
      return false;
    }
  }, []);

  // ── Subscribe unificato ──
  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    const userId = getUserId();
    const groupName = getUserGroup();
    if (!userId) {
      setError("Utente non autenticato. Effettua il login.");
      return false;
    }

    if (isNativePlatform()) {
      return subscribeNative(userId, groupName);
    } else {
      return subscribeWeb(userId, groupName);
    }
  }, [subscribeWeb, subscribeNative]);

  // ── Unsubscribe unificato ──
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (isNativePlatform()) {
      // Android: elimina token FCM dal server
      try {
        if (fcmToken) {
          await deleteFcmToken(fcmToken);
        }
        // Disinstalla dal device
        const { PushNotifications } = await import("@capacitor/push-notifications");
        PushNotifications.unregister();
        setFcmToken(null);
        setIsSubscribed(false);
        console.log("[FCM] Disiscrizione avvenuta.");
        return true;
      } catch (err) {
        console.error("[FCM] Errore disiscrizione:", err);
        setError("Errore disattivazione notifiche.");
        return false;
      }
    } else {
      // Web: rimuovi subscription Web Push
      if (!("serviceWorker" in navigator)) return false;

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await deletePushSubscription(sub.endpoint);
          await sub.unsubscribe();
          console.log("[Push] Sottoscrizione Web rimossa.");
        }
        setIsSubscribed(false);
        return true;
      } catch (err) {
        console.error("[Push] Unsubscribe failed:", err);
        setError("Errore disattivazione notifiche.");
        return false;
      }
    }
  }, [fcmToken]);

  // ── Controllo stato iniziale ──
  useEffect(() => {
    const checkSubscription = async () => {
      if (isNativePlatform()) {
        // Android: verifica se c'è già un token (da localStorage)
        setIsLoading(false);
      } else {
        // Web: verifica subscription esistente
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          setIsLoading(false);
          return;
        }

        setPermission(Notification.permission);

        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setIsSubscribed(!!sub);
          console.log("[Push] Stato sottoscrizione Web:", !!sub);
        } catch (err) {
          console.error("[Push] Errore controllo:", err);
          setIsSubscribed(false);
        } finally {
          setIsLoading(false);
        }
      }
    };

    checkSubscription();
  }, []);

  return { isSubscribed, isLoading, permission, subscribe, unsubscribe, error };
}
