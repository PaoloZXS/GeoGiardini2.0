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

  if (
    !supabaseUrl ||
    !supabaseServiceKey ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    return res.status(500).json({ error: "Push notifications not configured" });
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

    // 1) Se includeAdmins, recupera tutti gli admin (clienti + hardcoded)
    if (includeAdmins) {
      // Admin dalla tabella clienti
      const { data: admins } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "admin");
      if (admins) {
        admins.forEach((a) => targetUserIds.add(String(a.id)));
      }
      // Admin hardcoded (Angelo=1, Giulio=2) — non presenti in clienti
      targetUserIds.add("1");
      targetUserIds.add("2");
    }

    // 2) Se includeOtherGardeners, recupera tutti i giardinieri
    if (includeOtherGardeners) {
      const { data: gardeners } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "giardiniere");
      if (gardeners) {
        gardeners.forEach((g) => targetUserIds.add(String(g.id)));
      }
    }

    // 3) Aggiungi eventuali recipientIds espliciti
    if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      recipientIds.forEach((id) => targetUserIds.add(String(id)));
    }

    // 4) Rimuovi il mittente dalla lista
    if (excludeUserId) {
      targetUserIds.delete(String(excludeUserId));
    }

    // Se nessun destinatario, esci
    if (targetUserIds.size === 0) {
      return res
        .status(200)
        .json({ sent: 0, total: 0, message: "No recipients" });
    }

    // Recupera le subscription filtrate per i destinatari
    const userIdsArray = Array.from(targetUserIds);
    let query = supabase
      .from("push_subscriptions")
      .select("endpoint, keys, user_id")
      .in("user_id", userIdsArray);

    const { data: subscriptions, error } = await query;
    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0, total: 0 });
    }

    const payload = JSON.stringify({ title, body, url: url || "/" });

    let sent = 0;
    const errors = [];
    const results = await Promise.allSettled(
      subscriptions.map((sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: sub.keys
        };
        return webpush.sendNotification(pushSub, payload).catch(async (err) => {
          console.error("[Push] Errore invio a", sub.endpoint?.substring(0, 60) + "...", ":", err.statusCode, err.message);
          // Se subscription non più valida (410 Gone), elimina
          if (err.statusCode === 410) {
            console.log("[Push] Subscription 410 GONE, elimino:", sub.endpoint?.substring(0, 60) + "...");
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
          errors.push({
            endpoint: sub.endpoint?.substring(0, 60) + "...",
            statusCode: err.statusCode,
            message: err.message
          });
          throw err;
        });
      })
    );

    sent = results.filter((r) => r.status === "fulfilled").length;
    console.log("[Push] Risultato:", { sent, total: subscriptions.length, errors });

    return res.status(200).json({ sent, total: subscriptions.length, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("Push send error:", error);
    return res.status(500).json({ error: error.message });
  }
}
