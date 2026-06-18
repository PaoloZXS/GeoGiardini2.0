// src/hooks/usePushNotifications.ts
import { useState, useEffect, useCallback } from "react";
import {
  isNativePlatform,
  getVapidPublicKey,
  urlBase64ToUint8Array,
  savePushSubscription,
  deletePushSubscription
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

/**
 * OneSignal App ID - pubblico (non è un segreto).
 * Definito qui per non dipendere da variabili d'ambiente Vercel.
 */
const ONE_SIGNAL_APP_ID = "96a37cd0-a328-4a9c-959e-3b953495515f";
function getOneSignalAppId(): string {
  return ONE_SIGNAL_APP_ID;
}

// ── Sottoscrizione Web Push (PC / Browser PWA) ──
async function subscribeWeb(
  userId: string,
  groupName: string,
  setIsSubscribed: (v: boolean) => void,
  setError: (v: string | null) => void,
  setPermission: (v: string) => void
): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    setError("Il browser non supporta le notifiche push.");
    return false;
  }

  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  setPermission(perm);
  if (perm !== "granted") {
    setError("Permesso notifiche negato.");
    return false;
  }

  const reg = await navigator.serviceWorker.ready;
  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) {
    setError("Chiave VAPID non configurata.");
    return false;
  }

  const existingSub = await reg.pushManager.getSubscription();
  if (existingSub) {
    await existingSub.unsubscribe();
  }

  const key = urlBase64ToUint8Array(vapidKey);
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key as BufferSource
  });

  const saved = await savePushSubscription(userId, groupName, subscription);
  if (!saved) throw new Error("Salvataggio subscription fallito.");

  setIsSubscribed(true);
  return true;
}

async function unsubscribeWeb(
  setIsSubscribed: (v: boolean) => void,
  setError: (v: string | null) => void
): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setIsSubscribed(false);
    return true;
  } catch (err) {
    setError("Errore disattivazione notifiche.");
    return false;
  }
}

// ── OneSignal per Android nativo ──
async function subscribeNative(
  userId: string,
  groupName: string,
  setIsSubscribed: (v: boolean) => void,
  setError: (v: string | null) => void,
  setPermission: (v: string) => void
): Promise<boolean> {
  try {
    const mod = await import("@onesignal/capacitor-plugin");
    const OneSignal = mod.default;
    const appId = getOneSignalAppId();

    if (!appId) {
      setError("OneSignal non configurato.");
      return false;
    }

    // Inizializza OneSignal
    await OneSignal.initialize(appId);

    // Collega l'utente al nostro sistema
    await OneSignal.login(userId);

    // Tag per filtro gruppi
    await OneSignal.addTags({
      group: groupName,
      username: window.localStorage.getItem("loginUsername") || ""
    });

    // Attiva le notifiche
    await OneSignal.optInPushSubscription();

    // Ottieni ID OneSignal per salvarlo
    const { onesignalId } = await OneSignal.getOnesignalId();
    const { optedIn } = await OneSignal.getPushSubscriptionOptedIn();

    setIsSubscribed(optedIn);
    setPermission(optedIn ? "granted" : "denied");

    if (optedIn && onesignalId) {
      await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          group_name: groupName,
          onesignal_id: onesignalId,
          platform: "android"
        })
      }).catch(() => {});
    }

    return optedIn;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore attivazione OneSignal.";
    console.error("[OneSignal] Errore:", err);
    setError(msg);
    return false;
  }
}

async function unsubscribeNative(
  setIsSubscribed: (v: boolean) => void,
  setError: (v: string | null) => void
): Promise<boolean> {
  try {
    const mod = await import("@onesignal/capacitor-plugin");
    const OneSignal = mod.default;
    await OneSignal.optOutPushSubscription();
    await OneSignal.logout();
    setIsSubscribed(false);
    return true;
  } catch (err) {
    setError("Errore disattivazione notifiche.");
    return false;
  }
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState("default");
  const [error, setError] = useState<string | null>(null);

  // ── Subscribe ──
  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    const userId = getUserId();
    const groupName = getUserGroup();
    if (!userId) {
      setError("Utente non autenticato. Effettua il login.");
      return false;
    }

    if (isNativePlatform()) {
      return subscribeNative(userId, groupName, setIsSubscribed, setError, setPermission);
    } else {
      return subscribeWeb(userId, groupName, setIsSubscribed, setError, setPermission);
    }
  }, []);

  // ── Unsubscribe ──
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (isNativePlatform()) {
      return unsubscribeNative(setIsSubscribed, setError);
    } else {
      return unsubscribeWeb(setIsSubscribed, setError);
    }
  }, []);

  // ── Stato iniziale ──
  useEffect(() => {
    const check = async () => {
      if (isNativePlatform()) {
        try {
          const mod = await import("@onesignal/capacitor-plugin");
          const OneSignal = mod.default;
          const appId = getOneSignalAppId();
          if (appId) {
            await OneSignal.initialize(appId);
            const { optedIn } = await OneSignal.getPushSubscriptionOptedIn();
            setIsSubscribed(optedIn);
          }
        } catch {
          setIsSubscribed(false);
        }
        setIsLoading(false);
      } else {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          setIsLoading(false);
          return;
        }
        setPermission(Notification.permission);
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setIsSubscribed(!!sub);
        } catch {
          setIsSubscribed(false);
        } finally {
          setIsLoading(false);
        }
      }
    };
    check();
  }, []);

  return { isSubscribed, isLoading, permission, subscribe, unsubscribe, error };
}
