import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendError } from "../lib/response";

/**
 * Short-lived cache to avoid a Supabase HTTP roundtrip on every request.
 * 3-5 auth-guarded calls per page load x ~60s TTL = safe + significant savings.
 *
 * This is per-process only. In a multi-replica deployment each instance
 * maintains its own token cache, which is fine — worst case is an extra
 * Supabase call, not a security issue.
 *
 * TODO(scaling): If Supabase auth latency becomes a bottleneck across
 * replicas, consider a shared Redis cache for verified tokens.
 */
const TOKEN_CACHE_TTL = 60 * 1000; // 60 seconds
const TOKEN_CACHE_MAX = 256;

interface TokenEntry {
  userId: string;
  email: string | undefined;
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

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    if (res.headersSent) return;

    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      if (!res.headersSent) sendError(res, 401, "Missing or invalid authorization header");
      return;
    }

    const token = authHeader.split(" ")[1];

    // Check cache first (LRU: delete + re-set moves entry to end)
    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      tokenCache.delete(token);
      tokenCache.set(token, cached);
      req.userId = cached.userId;
      req.userEmail = cached.email;
      next();
      return;
    }

    const { data, error } = await getSupabaseAdmin().auth.getUser(token);

    if (res.headersSent) return;

    if (error || !data.user) {
      // Remove stale cache entry if present
      tokenCache.delete(token);
      sendError(res, 401, "Invalid or expired token");
      return;
    }

    // Cache the verified token
    if (tokenCache.size >= TOKEN_CACHE_MAX) {
      const oldest = tokenCache.keys().next().value;
      if (oldest !== undefined) tokenCache.delete(oldest);
    }
    tokenCache.set(token, {
      userId: data.user.id,
      email: data.user.email,
      expiresAt: Date.now() + TOKEN_CACHE_TTL,
    });

    req.userId = data.user.id;
    req.userEmail = data.user.email;
    next();
  } catch (err) {
    if (!res.headersSent) next(err);
  }
};
