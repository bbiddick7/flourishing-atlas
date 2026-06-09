// Browser-side Supabase client.
// Uses the PUBLIC anon key — safe to ship to the browser. Row-Level Security
// (defined in schema.sql) is what actually protects data: with the anon key a
// user can only read their own balance, never write credits.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Surfaced in the console to make misconfiguration obvious during setup.
  console.warn("Supabase env vars missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(url || "", anonKey || "");
