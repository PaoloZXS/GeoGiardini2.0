import { useState, useEffect, useCallback } from "react";
import { getVapidPublicKey, urlBase64ToUint8Array } from "../utils/pushNotifications";

const SUBSCRIPTION_URL = "/api/push-subscriptions";

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState("default");

  // 🔹 1. DEFINISCI subscribe PRIMA di usarlo
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

  // 🔹 2. DEFINISCI unsubscribe
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!("serviceWorker" in navigator)) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await fetch(SUBSCRIPTION_URL, {
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

  // 🔹 3. (Disabilitato) Auto-subscribe — gestito da App.tsx
  // useEffect(() => {
  //   const autoSubscribe = async () => {
  //     const userId = localStorage.getItem("userId");
  //     if (userId && "serviceWorker" in navigator) {
  //       const perm = await Notification.requestPermission();
  //       if (perm === "granted") {
  //         await subscribe();
  //       }
  //     }
  //   };
  //   autoSubscribe();
  // }, [subscribe]);

  // 🔹 4. Verifica lo stato della subscription all'avvio
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
