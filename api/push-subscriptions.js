import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (req.method === "POST") {
      const { user_id, group_name, endpoint, keys, fcm_token, platform } = req.body;
      if (!user_id) {
        return res
          .status(400)
          .json({ error: "Missing required field: user_id" });
      }

      // ── Sottoscrizione Web Push (VAPID) ──
      if (endpoint && keys) {
        const { data: existing } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", endpoint)
          .maybeSingle();

        const record = {
          user_id,
          endpoint,
          keys,
          platform: "web",
          updated_at: new Date().toISOString()
        };

        if (existing) {
          await supabase
            .from("push_subscriptions")
            .update(record)
            .eq("id", existing.id);
        } else {
          await supabase
            .from("push_subscriptions")
            .insert(record);
        }

        console.log("[Push] Web subscription salvata per user_id:", user_id);
        return res.status(200).json({ success: true, platform: "web" });
      }

      // ── Sottoscrizione Android nativa (FCM) ──
      if (fcm_token) {
        // Upsert per fcm_token
        const { data: existing } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("fcm_token", fcm_token)
          .maybeSingle();

        const record = {
          user_id,
          fcm_token,
          platform: platform || "android",
          updated_at: new Date().toISOString()
        };

        if (existing) {
          await supabase
            .from("push_subscriptions")
            .update(record)
            .eq("id", existing.id);
        } else {
          await supabase
            .from("push_subscriptions")
            .insert(record);
        }

        console.log("[FCM] Token salvato per user_id:", user_id);
        return res.status(200).json({ success: true, platform: "android" });
      }

      return res.status(400).json({ error: "Missing either endpoint+keys or fcm_token" });
    }

    if (req.method === "DELETE") {
      const { endpoint, fcm_token } = req.body;

      if (fcm_token) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("fcm_token", fcm_token);

        console.log("[FCM] Token eliminato:", fcm_token.substring(0, 30) + "...");
        return res.status(200).json({ success: true });
      }

      if (endpoint) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);

        console.log("[Push] Web subscription eliminata per endpoint:", endpoint.substring(0, 50) + "...");
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Missing either endpoint or fcm_token" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Push subscriptions error:", error);
    return res.status(500).json({ error: error.message });
  }
}
