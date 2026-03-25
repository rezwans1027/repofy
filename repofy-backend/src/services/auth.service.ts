import { getSupabaseAuth } from "../config/supabase-auth";
import { logger } from "../lib/logger";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/* ------------------------------------------------------------------ */
/*  Refresh-token reuse-interval check (runs once at startup)         */
/* ------------------------------------------------------------------ */

const SAFE_REUSE_INTERVAL = 10; // seconds — anything above this is flagged

/** Warn at startup if the Supabase refresh token reuse interval is too high. */
async function validateRefreshTokenReuseInterval(): Promise<void> {
  try {
    // Supabase Admin API endpoint for auth config — available on service_role key.
    // @supabase/supabase-js doesn't expose this directly, so we read it from
    // the project settings via the REST API.
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return;

    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
    });

    if (!res.ok) {
      logger.warn(`Could not verify refresh token reuse interval (HTTP ${res.status})`);
      return;
    }

    const settings = (await res.json()) as Record<string, unknown>;
    const reuseInterval = settings.refresh_token_reuse_interval;

    if (typeof reuseInterval === "number" && reuseInterval > SAFE_REUSE_INTERVAL) {
      logger.warn(
        `Supabase refresh_token_reuse_interval is ${reuseInterval}s (recommended: ≤${SAFE_REUSE_INTERVAL}s). ` +
          `A high value increases the window for stolen refresh-token replay attacks. ` +
          `Lower it in the Supabase Dashboard → Authentication → Settings.`,
      );
    } else if (typeof reuseInterval === "number") {
      logger.info(`Supabase refresh_token_reuse_interval: ${reuseInterval}s (OK)`);
    }
  } catch {
    // Non-critical — don't block startup
    logger.warn("Could not verify Supabase refresh token reuse interval");
  }
}

// Fire on module load (non-blocking)
validateRefreshTokenReuseInterval();

/* ------------------------------------------------------------------ */

export async function refreshSession(
  refreshToken: string,
): Promise<{ session: { access_token: string; refresh_token: string }; user: { id: string; email: string; display_name?: string } }> {
  const { data, error } = await getSupabaseAuth().auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session || !data.user) {
    throw new AuthError("Session expired", 401);
  }

  return {
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
    user: {
      id: data.user.id,
      email: data.user.email ?? "",
      display_name: data.user.user_metadata?.display_name,
    },
  };
}
