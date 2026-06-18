import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  "mailto:admin@geogiardini.it",
  vapidPublicKey,
  vapidPrivateKey
);

// ── OneSignal ──
const onesignalAppId = process.env.VITE_ONESIGNAL_APP_ID || "";
const onesignalApiKey = process.env.ONESIGNAL_REST_API_KEY || "";

async function sendOneSignalNotification(userIds, title, body, url) {
  if (!onesignalAppId || !onesignalApiKey) {
    console.log("[OneSignal] Non configurato");
    return 0;
  }

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${onesignalApiKey}`
      },
      body: JSON.stringify({
        app_id: onesignalAppId,
        contents: { en: body },
        headings: { en: title },
        include_external_user_ids: userIds,
        url: url || "/",
        channel_for_external_user_ids: "push"
      })
    });

    const result = await res.json();
    console.log("[OneSignal] Risultato:", result);
    return result.recipients || 0;
  } catch (err) {
    console.error("[OneSignal] Errore:", err);
    return 0;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    const {
      title,
      body,
      url,
      excludeUserId,
      includeAdmins = false,
      includeOtherGardeners = false,
      recipientIds = []
    } = req.body;

    if (!title || !body) {
      return res
        .status(400)
        .json({ error: "Missing required fields: title, body" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Costruisci lista destinatari (user_id)
    const targetUserIds = new Set();

    if (includeAdmins) {
      const { data: admins } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "admin");
      if (admins) {
        admins.forEach((a) => targetUserIds.add(String(a.id)));
      }
      targetUserIds.add("1");
      targetUserIds.add("2");
    }

    if (includeOtherGardeners) {
      const { data: gardeners } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "giardiniere");
      if (gardeners) {
        gardeners.forEach((g) => targetUserIds.add(String(g.id)));
      }
    }

    if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      recipientIds.forEach((id) => targetUserIds.add(String(id)));
    }

    if (excludeUserId) {
      targetUserIds.delete(String(excludeUserId));
    }

    if (targetUserIds.size === 0) {
      return res
        .status(200)
        .json({ sent: 0, total: 0, message: "No recipients" });
    }

    const userIdsArray = Array.from(targetUserIds);

    // Recupera subscription per invio web push
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys, platform")
      .in("user_id", userIdsArray)
      .eq("platform", "web");

    if (error) throw error;

    const webSubs = (subscriptions || []).filter((s) => s.endpoint && s.keys);
    const payload = JSON.stringify({ title, body, url: url || "/" });
    let sent = 0;
    const errors = [];

    // ── Invia via Web Push (PC/browser) ──
    if (webSubs.length > 0 && vapidPublicKey && vapidPrivateKey) {
      const webResults = await Promise.allSettled(
        webSubs.map((sub) => {
          const pushSub = { endpoint: sub.endpoint, keys: sub.keys };
          return webpush.sendNotification(pushSub, payload).catch(async (err) => {
            if (err.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
            errors.push({ endpoint: sub.endpoint?.substring(0, 60) + "...", type: "web", statusCode: err.statusCode });
            throw err;
          });
        })
      );
      sent += webResults.filter((r) => r.status === "fulfilled").length;
    }

    // ── Invia via OneSignal (Android) ──
    const oneSignalSent = await sendOneSignalNotification(userIdsArray, title, body, url);
    sent += oneSignalSent;

    const total = webSubs.length + (oneSignalSent > 0 ? userIdsArray.length : 0);
    console.log("[Push] Risultato:", { sent, web: webSubs.length, onesignal: oneSignalSent });

    return res.status(200).json({ sent, total, onesignal: oneSignalSent });
  } catch (error) {
    console.error("Push send error:", error);
    return res.status(500).json({ error: error.message });
  }
}
