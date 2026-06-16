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
      const { user_id, group_name, endpoint, keys } = req.body;
      if (!user_id || !endpoint || !keys) {
        return res
          .status(400)
          .json({ error: "Missing required fields: user_id, endpoint, keys" });
      }

      // Upsert: se esiste già per questo user_id, aggiorna
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      const record = {
        endpoint,
        keys,
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
          .insert({ ...record, user_id });
      }

      return res.status(200).json({ success: true });
    }

    if (req.method === "DELETE") {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "Missing endpoint" });
      }

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Push subscriptions error:", error);
    return res.status(500).json({ error: error.message });
  }
}
