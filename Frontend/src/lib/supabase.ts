import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../config";

// Cliente de Supabase Auth del modo api. Solo usa la clave publicable (VITE_*); nunca la service role.
// Se carga bajo demanda: en modo mock no entra al bundle inicial ni retrasa el login.
let client: Promise<SupabaseClient> | null = null;

export function supabase(): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return Promise.reject(new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY para el modo api."));
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }),
  );
  return client;
}
