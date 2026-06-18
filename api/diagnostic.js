import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "No config" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, onesignal_id, platform, updated_at")
    .order("updated_at", { ascending: false });

  return res.json({
    count: subs?.length || 0,
    subscriptions: (subs || []).map(s => ({
      id: s.id,
      user_id: s.user_id,
      platform: s.platform,
      endpoint_short: s.endpoint ? s.endpoint.substring(0, 50) : null,
      onesignal_id: s.onesignal_id || null,
      updated_at: s.updated_at
    }))
  });
}
