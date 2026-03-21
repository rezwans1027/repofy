import { RequestHandler } from "express";
import { sendSuccess, sendError } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import { refreshSession } from "../services/auth.service";
import { invalidateToken } from "../middleware/auth";
import { getSupabaseAdmin } from "../config/supabase";
import { setAuthCookies, clearAuthCookies, extractAccessToken, extractRefreshToken } from "../lib/cookie-utils";
import { logger } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

export const handleGitHubCallback: RequestHandler = async (req, res) => {
  const { access_token, refresh_token, provider_token } = req.body;

  if (!access_token || !refresh_token || !provider_token) {
    sendError(res, 400, "Missing required tokens.");
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Verify the access token
    const { data, error } = await supabase.auth.getUser(access_token);
    if (error || !data.user) {
      sendError(res, 401, "Invalid access token.");
      return;
    }

    const user = data.user;

    // 2. Call GitHub /user with provider_token to get canonical login & avatar
    const ghRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${provider_token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Repofy",
      },
    });

    if (!ghRes.ok) {
      logger.error("GitHub /user call failed during callback", { status: ghRes.status });
      sendError(res, 502, "Failed to verify GitHub token.");
      return;
    }

    const ghUser = await ghRes.json() as { login: string; avatar_url: string; name: string | null };

    // 3. Upsert into github_tokens table
    const { error: upsertError } = await supabase.from("github_tokens").upsert({
      user_id: user.id,
      github_token: provider_token,
      github_username: ghUser.login,
      github_avatar_url: ghUser.avatar_url,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) {
      logger.error("Failed to upsert github_tokens", { userId: user.id, error: upsertError });
      sendError(res, 500, "Failed to store GitHub token.");
      return;
    }

    // 4. Set display_name from GitHub's name field
    const displayName = ghUser.name || ghUser.login;
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { display_name: displayName },
    });

    // 5. Set auth cookies
    setAuthCookies(res, access_token, refresh_token);

    // 6. Return user data
    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        display_name: displayName,
        github_username: ghUser.login,
        avatar_url: ghUser.avatar_url,
      },
    });
  } catch (err) {
    handleControllerError(err, req, res, "GitHub Callback", "An unexpected error occurred.");
  }
};

export const handleRefresh: RequestHandler = async (req, res) => {
  const refreshToken = extractRefreshToken(req);

  if (!refreshToken) {
    sendError(res, 401, "No refresh token");
    return;
  }

  try {
    const result = await refreshSession(refreshToken);
    setAuthCookies(res, result.session.access_token, result.session.refresh_token);
    sendSuccess(res, { user: result.user });
  } catch (err) {
    clearAuthCookies(res);
    handleControllerError(err, req, res, "Auth Refresh", "Session expired.");
  }
};

export const handleMe: RequestHandler = async (req, res) => {
  const { userId, userEmail } = req as AuthenticatedRequest;

  try {
    const { data: ghData } = await getSupabaseAdmin()
      .from("github_tokens")
      .select("github_username, github_avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    // Get display_name from user metadata
    const { data: userData } = await getSupabaseAdmin().auth.admin.getUserById(userId);
    const displayName = userData?.user?.user_metadata?.display_name;

    sendSuccess(res, {
      user: {
        id: userId,
        email: userEmail,
        display_name: displayName,
        github_username: ghData?.github_username,
        avatar_url: ghData?.github_avatar_url,
      },
    });
  } catch {
    // Fallback if DB query fails
    sendSuccess(res, { user: { id: userId, email: userEmail } });
  }
};

export const handleLogout: RequestHandler = async (req, res) => {
  const token = extractAccessToken(req);

  try {
    // Best-effort: invalidate token cache if present
    if (token) invalidateToken(token);

    // Best-effort: sign out via Supabase admin if we can resolve the user
    if (token) {
      try {
        const { data } = await getSupabaseAdmin().auth.getUser(token);
        if (data.user) {
          await getSupabaseAdmin().auth.admin.signOut(data.user.id);
        }
      } catch {
        // Ignore — token may be expired, user may not exist
      }
    }
  } catch {
    // Ignore errors — always clear cookies
  }

  // Always clear cookies regardless of token validity
  clearAuthCookies(res);
  sendSuccess(res, { message: "Logged out successfully." });
};
