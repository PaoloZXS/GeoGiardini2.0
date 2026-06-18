import { createClient } from "@supabase/supabase-js";

// Valori pubblici (sono le credenziali pubbliche per il client Supabase)
const SUPABASE_URL = "https://buqzzpaxklbawlcoannn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tW193hD-ID_tCfuHae55Ug_WNftAi0h";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
