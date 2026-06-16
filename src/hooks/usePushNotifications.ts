import { useState, useEffect, useCallback } from "react";
import { getVapidPublicKey, urlBase64ToUint8Array } from "../utils/pushNotifications";

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState("default");

  // Determina l'URL base per le API
  const getApiBaseUrl = () => {
    // In produzione (Vercel) usa URL relativo
    if (import.meta.env.PROD) return '';
    // In sviluppo usa localhost:3000
    return 'http://10.0.0.209:3000';
  };

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications not supported");
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        console.warn("Notification permission denied");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        console.error("VAPID public key not available");
        return false;
      }

      const key = urlBase64ToUint8Array(vapidKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });

      const userId = window.localStorage.getItem("userId");
      const subJSON = subscription.toJSON();
      
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/push-subscriptions`, {
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
        const baseUrl = getApiBaseUrl();
        await fetch(`${baseUrl}/api/push-subscriptions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        }).catch(() => {});
        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
      return false;
    }
  }, []);

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

  return { isSubscribed, isLoading, permission, subscribe, unsubscribe };
}
