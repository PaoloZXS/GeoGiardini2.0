import { createClient } from "@supabase/supabase-js";

// ============================================================================
// Endpoint di KEEPALIVE
// ----------------------------------------------------------------------------
// Esegue una query leggera ma reale sul DB per generare attività e impedire
// che il progetto Supabase (piano free) vada in PAUSA per inattività
// (~7 giorni senza richieste).
//
// Viene richiamato periodicamente dal Cron di Vercel (vedi vercel.json).
// Risponde velocemente e NON espone dati sensibili.
// ============================================================================
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Query leggera ma reale sul DB (conta i clienti) per generare attività
    const { count, error } = await supabase
      .from("clienti")
      .select("id", { count: "exact", head: true });
    if (error) throw error;

    return res.status(200).json({
      ok: true,
      ts: new Date().toISOString(),
      clienti: count || 0
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "error" });
  }
}
