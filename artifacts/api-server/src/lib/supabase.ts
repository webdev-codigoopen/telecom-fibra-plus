import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

export function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Supabase não configurado: defina SUPABASE_URL e SUPABASE_SECRET_KEY nos secrets.",
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { "x-client-info": "@workspace/api-server" },
      },
    });
  }
  return cachedClient;
}
