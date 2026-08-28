import { createClient } from "@supabase/supabase-js";

// Valori pubblici (sono le credenziali pubbliche per il client Supabase)
const SUPABASE_URL = "https://vxzfefccmafswydzrxao.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GFacJp422gfwEj7wlYilug_Wiipjt7K";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
