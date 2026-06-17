import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Quante subscription totali?
    const { count: total, error: countErr } = await supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true });

    // Tutte le subscription
    const { data: all, error: allErr } = await supabase
      .from("push_subscriptions")
      .select("*")
      .order("updated_at", { ascending: false });

    if (allErr) throw allErr;

    const grouped = {};
    for (const sub of all || []) {
      const uid = sub.user_id || "unknown";
      if (!grouped[uid]) grouped[uid] = [];
      grouped[uid].push({
        id: sub.id,
        endpoint_prefix: sub.endpoint?.substring(0, 60) + "...",
        has_keys: !!(sub.keys?.p256dh && sub.keys?.auth),
        updated_at: sub.updated_at,
        group_name: sub.group_name
      });
    }

    return res.status(200).json({
      total_subscriptions: total || 0,
      by_user: grouped,
      raw_count: all?.length || 0
    });
  } catch (error) {
    console.error("Debug error:", error);
    return res.status(500).json({ error: error.message });
  }
}
