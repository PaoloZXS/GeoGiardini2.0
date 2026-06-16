// src/hooks/usePushNotifications.ts
import { useState, useEffect, useCallback } from "react";
import {
  getVapidPublicKey,
  urlBase64ToUint8Array,
  savePushSubscription,
  deletePushSubscription
} from "../utils/pushNotifications";

/**
 * Restituisce il groupName (ruolo) dell'utente loggato da localStorage.
 * Ispirato dalla logica CosaDaFare che associa una subscription a un gruppo.
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

  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    // 1) Verifica supporto browser
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      const msg = "Il browser non supporta le notifiche push.";
      console.warn("[Push]", msg);
      setError(msg);
      return false;
    }

    try {
      // 2) Richiedi permesso notifiche
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        const msg = "Permesso notifiche negato.";
        console.warn("[Push]", msg);
        setError(msg);
        return false;
      }

      // 3) Ottieni il service worker
      const reg = await navigator.serviceWorker.ready;

      // 4) Ottieni chiave VAPID (come in CosaDaFare push.js)
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        const msg = "Chiave VAPID non configurata. Contatta l'amministratore.";
        console.error("[Push]", msg);
        setError(msg);
        return false;
      }

      // 5) Recupera userId e groupName
      const userId = getUserId();
      const groupName = getUserGroup();

      if (!userId) {
        const msg = "Utente non autenticato. Effettua il login.";
        console.error("[Push]", msg);
        setError(msg);
        return false;
      }

      // 6) Rimuovi eventuale subscription esistente prima di crearne una nuova
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        // Rimuovi anche dal server
        await deletePushSubscription(existingSub.endpoint);
        await existingSub.unsubscribe();
      }

      // 7) Crea nuova sottoscrizione
      const key = urlBase64ToUint8Array(vapidKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });

      console.log("[Push] Sottoscrizione creata:", subscription.endpoint);

      // 8) Salva sul server (con groupName = ruolo, come in CosaDaFare)
      const saved = await savePushSubscription(userId, groupName, subscription);
      if (!saved) {
        throw new Error("Salvataggio subscription fallito.");
      }

      console.log(
        "[Push] Sottoscrizione salvata con successo per gruppo:",
        groupName
      );
      setIsSubscribed(true);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Errore attivazione notifiche.";
      console.error("[Push] Errore:", err);
      setError(msg);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (!("serviceWorker" in navigator)) {
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Rimuovi dal server PRIMA (come in CosaDaFare)
        await deletePushSubscription(sub.endpoint);
        // Poi dal browser
        await sub.unsubscribe();
        console.log("[Push] Sottoscrizione rimossa.");
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Errore disattivazione notifiche.";
      console.error("[Push] Unsubscribe failed:", err);
      setError(msg);
      return false;
    }
  }, []);

  // Controlla lo stato della sottoscrizione all'avvio
  useEffect(() => {
    const checkSubscription = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setIsLoading(false);
        return;
      }

      setPermission(Notification.permission);

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
        console.log("[Push] Stato sottoscrizione:", !!sub);
      } catch (err) {
        console.error("[Push] Errore controllo sottoscrizione:", err);
        setIsSubscribed(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscription();
  }, []);

  return { isSubscribed, isLoading, permission, subscribe, unsubscribe, error };
}
