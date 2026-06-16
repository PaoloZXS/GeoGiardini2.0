import { useState, useEffect, useCallback } from "react";
import { getVapidPublicKey, urlBase64ToUint8Array } from "../utils/pushNotifications";

const SUBSCRIPTION_URL = "/api/push-subscriptions";

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // Verifica lo stato della subscription all'avvio
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
      } catch {
        // service worker non ready
      } finally {
        setIsLoading(false);
      }
    };
    checkSubscription();
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications not supported");
      return false;
    }

    try {
      // Richiedi permesso
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        console.warn("Notification permission denied");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;

      // Se esiste già una subscription, cancellala
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      // Ottieni VAPID key
      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        console.error("VAPID public key not available");
        return false;
      }

      // Sottoscrivi
      const key = urlBase64ToUint8Array(vapidKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });

      // Salva subscription sul server
      const userId = window.localStorage.getItem("userId");
      const subJSON = subscription.toJSON();
      const res = await fetch(SUBSCRIPTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          endpoint: subscription.endpoint,
          keys: subJSON.keys
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save subscription");
      }

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Rimuovi dal server
        await fetch(SUBSCRIPTION_URL, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        }).catch(() => {
          // Ignora errori di rete
        });

        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
      return false;
    }
  }, []);

  return { isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
