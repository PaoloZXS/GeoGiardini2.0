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

  if (!supabaseUrl || !supabaseServiceKey || !vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ error: "Push notifications not configured" });
  }

  try {
    const { title, body, excludeUserId, url } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: "Missing required fields: title, body" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Recupera tutte le subscription eccetto quella del mittente
    let query = supabase.from("push_subscriptions").select("endpoint, keys, user_id");
    if (excludeUserId) {
      query = query.neq("user_id", excludeUserId);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0, total: 0 });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/",
      icon: "/leaf-512.png",
      badge: "/leaf-512.png",
      requireInteraction: true,
      vibrate: [120, 80, 120]
    });

    let sent = 0;
    const results = await Promise.allSettled(
      subscriptions.map((sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: sub.keys
        };
        return webpush.sendNotification(pushSub, payload).catch(async (err) => {
          // Se subscription non più valida (410 Gone), elimina
          if (err.statusCode === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
          throw err;
        });
      })
    );

    sent = results.filter((r) => r.status === "fulfilled").length;

    return res.status(200).json({ sent, total: subscriptions.length });
  } catch (error) {
    console.error("Push send error:", error);
    return res.status(500).json({ error: error.message });
  }
}
