import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendError } from "../lib/response";
import { extractAccessToken, extractRefreshToken, setAuthCookies, clearAuthCookies } from "../lib/cookie-utils";
import { refreshSession } from "../services/auth.service";
import { decryptToken, isEncrypted, encryptToken } from "../lib/encryption";
import { logger } from "../lib/logger";

/**
 * Short-lived cache to avoid a Supabase HTTP roundtrip on every request.
 * 3-5 auth-guarded calls per page load x ~60s TTL = safe + significant savings.
 *
 * This is per-process only. In a multi-replica deployment each instance
 * maintains its own token cache, which is fine — worst case is an extra
 * Supabase call, not a security issue.
 */
const TOKEN_CACHE_TTL = 60 * 1000; // 60 seconds
const TOKEN_CACHE_MAX = 256;

interface TokenEntry {
  userId: string;
  email: string | undefined;
  githubToken: string | undefined;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenEntry>();

// Periodic sweep of expired tokens so stale entries don't linger.
// Unref'd so it won't keep the process alive during shutdown.
const tokenCacheSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    if (now >= entry.expiresAt) tokenCache.delete(key);
  }
}, TOKEN_CACHE_TTL);
tokenCacheSweepInterval.unref();

/** Exposed for test isolation. */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/** Remove a specific token from the cache (used on logout). */
export function invalidateToken(token: string): void {
  tokenCache.delete(token);
}

async function fetchGitHubToken(userId: string): Promise<string | undefined> {
  try {
    const { data } = await getSupabaseAdmin()
      .from("github_tokens")
      .select("github_token")
      .eq("user_id", userId)
      .maybeSingle();

    const raw = data?.github_token;
    if (!raw) return undefined;

    if (isEncrypted(raw)) {
      return decryptToken(raw);
    }

    // Legacy plaintext token — fire-and-forget re-encrypt for lazy migration
    void (async () => {
      try {
        const { error } = await getSupabaseAdmin()
          .from("github_tokens")
          .update({ github_token: encryptToken(raw) })
          .eq("user_id", userId);
        if (error) logger.error("Lazy token encryption migration failed", { userId, error });
      } catch (err) {
        logger.error("Lazy token encryption migration threw", { userId, err });
      }
    })();

    return raw;
  } catch {
    return undefined;
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    if (res.headersSent) return;

    const token = extractAccessToken(req);

    if (!token) {
      if (!res.headersSent) sendError(res, 401, "Missing or invalid authorization");
      return;
    }

    // Check cache first (LRU: delete + re-set moves entry to end)
    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      tokenCache.delete(token);
      tokenCache.set(token, cached);
      req.userId = cached.userId;
      req.userEmail = cached.email;
      req.githubToken = cached.githubToken;
      next();
      return;
    }

    const { data, error } = await getSupabaseAdmin().auth.getUser(token);

    if (res.headersSent) return;

    if (error || !data.user) {
      // Remove stale cache entry if present
      tokenCache.delete(token);

      // Auto-refresh: try refresh token if available
      const refreshToken = extractRefreshToken(req);
      if (refreshToken) {
        try {
          const result = await refreshSession(refreshToken);
          // Set new cookies on the response
          setAuthCookies(res, result.session.access_token, result.session.refresh_token);

          // Fetch GitHub token from DB
          const githubToken = await fetchGitHubToken(result.user.id);

          // Cache the new token
          const newToken = result.session.access_token;
          if (tokenCache.size >= TOKEN_CACHE_MAX) {
            const oldest = tokenCache.keys().next().value;
            if (oldest !== undefined) tokenCache.delete(oldest);
          }
          tokenCache.set(newToken, {
            userId: result.user.id,
            email: result.user.email,
            githubToken,
            expiresAt: Date.now() + TOKEN_CACHE_TTL,
          });

          req.userId = result.user.id;
          req.userEmail = result.user.email;
          req.githubToken = githubToken;
          next();
          return;
        } catch {
          // Refresh failed — clear stale cookies and return 401
          clearAuthCookies(res);
          if (!res.headersSent) sendError(res, 401, "Invalid or expired token");
          return;
        }
      }

      sendError(res, 401, "Invalid or expired token");
      return;
    }

    // Fetch GitHub token from DB
    const githubToken = await fetchGitHubToken(data.user.id);

    // Cache the verified token
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
      const oldest = tokenCache.keys().next().value;
      if (oldest !== undefined) tokenCache.delete(oldest);
    }
    tokenCache.set(token, {
      userId: data.user.id,
      email: data.user.email,
      githubToken,
      expiresAt: Date.now() + TOKEN_CACHE_TTL,
    });

    req.userId = data.user.id;
    req.userEmail = data.user.email;
    req.githubToken = githubToken;
    next();
  } catch (err) {
    if (!res.headersSent) next(err);
  }
};
