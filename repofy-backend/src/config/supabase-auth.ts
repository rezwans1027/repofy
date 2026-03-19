import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase client initialised with the **anon key**.
 * Used for end-user auth operations (signInWithPassword, refreshSession)
 * that must run as a regular user, not as service-role admin.
 */
export function getSupabaseAuth(): SupabaseClient {
  if (!_client) {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_ANON_KEY – cannot create Supabase auth client",
      );
    }
    _client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}
