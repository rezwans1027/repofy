import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendError } from "../lib/response";
import { extractAccessToken, extractRefreshToken, setAuthCookies, clearAuthCookies } from "../lib/cookie-utils";
import { refreshSession } from "../services/auth.service";
import { decryptToken, isEncrypted, encryptToken } from "../lib/encryption";
import { TTLCache } from "../lib/ttl-cache";
import { logger } from "../lib/logger";

interface TokenEntry {
  userId: string;
  email: string | undefined;
  githubToken: string | undefined;
}

const tokenCache = new TTLCache<TokenEntry>(256, 60 * 1000);

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

    // Legacy plaintext token — fire-and-forget re-encrypt for lazy migration.
    // The WHERE clause ensures we only overwrite if the row still holds the
    // exact plaintext value we read, avoiding clobbering a freshly rotated token.
    void (async () => {
      try {
        const { error } = await getSupabaseAdmin()
          .from("github_tokens")
          .update({ github_token: encryptToken(raw) })
          .eq("user_id", userId)
          .eq("github_token", raw);
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

    const cached = tokenCache.get(token);
    if (cached) {
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

          const newToken = result.session.access_token;
          tokenCache.set(newToken, {
            userId: result.user.id,
            email: result.user.email,
            githubToken,
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

    tokenCache.set(token, {
      userId: data.user.id,
      email: data.user.email,
      githubToken,
    });

    req.userId = data.user.id;
    req.userEmail = data.user.email;
    req.githubToken = githubToken;
    next();
  } catch (err) {
    if (!res.headersSent) next(err);
  }
};
