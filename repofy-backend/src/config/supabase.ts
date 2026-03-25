import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase client initialised with the **service-role key**.
 * This intentionally bypasses Row-Level Security so the backend can
 * read/write any row.  Access control is enforced at the controller
 * and middleware layer (JWT auth, ownership checks, rate limiting).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY – cannot create Supabase client",
      );
    }
    _client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}
