import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns the browser-side Supabase client (OAuth-only).
 *
 * Uses @supabase/ssr which stores the PKCE code verifier in cookies,
 * so it survives the OAuth redirect round-trip. This is the Supabase-
 * recommended approach for Next.js.
 *
 * The client is only used for OAuth initiation and callback.
 * Session management is handled by the backend via HttpOnly cookies.
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add them to .env.local (see .env.example).",
      );
    }

    _client = createBrowserClient(url, key);
  }
  return _client;
}
