import { RequestHandler } from "express";
import { sendSuccess, sendError } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import { refreshSession } from "../services/auth.service";
import { invalidateToken } from "../middleware/auth";
import { getSupabaseAdmin } from "../config/supabase";
import { getSupabaseAuth } from "../config/supabase-auth";
import { setAuthCookies, clearAuthCookies, extractAccessToken, extractRefreshToken } from "../lib/cookie-utils";
import { logger } from "../lib/logger";
import { encryptToken } from "../lib/encryption";
import { exchangeCodeForToken, getGitHubUser, getGitHubUserEmail } from "../services/github-oauth.service";
import type { AuthenticatedRequest } from "../types";

export const handleGitHubCallback: RequestHandler = async (req, res) => {
  const { code, redirect_uri, code_verifier } = req.body;

  if (!code || !redirect_uri || !code_verifier) {
    sendError(res, 400, "Missing required fields: code, redirect_uri, code_verifier.");
    return;
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Exchange authorization code for GitHub access token (PKCE-verified)
    const githubToken = await exchangeCodeForToken(code, redirect_uri, code_verifier);

    // 2. Get GitHub user profile
    const ghUser = await getGitHubUser(githubToken);

    // 3. Resolve email (public or via /user/emails)
    let email = ghUser.email;
    if (!email) {
      email = await getGitHubUserEmail(githubToken);
    }

    // 4. Resolve Supabase user
    let userId: string;
    let userEmail: string;

    // 4a. Primary lookup: stable numeric GitHub user ID
    const { data: existingRow } = await supabase
      .from("github_tokens")
      .select("user_id")
      .eq("github_user_id", ghUser.id)
      .maybeSingle();

    if (existingRow) {
      // Returning user — fetch their current Supabase email
      userId = existingRow.user_id;
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      userEmail = userData?.user?.email ?? email;
    } else {
      // 4b. Try to create a new Supabase user
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: ghUser.name || ghUser.login },
      });

      if (created?.user) {
        // New user
        userId = created.user.id;
        userEmail = created.user.email ?? email;
      } else if (createErr) {
        // 4c. User already exists in Supabase auth (e.g. legacy user without github_user_id row).
        // Use generateLink to resolve their ID — it only works for existing users with magiclink type.
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email,
        });

        if (linkErr || !linkData?.user) {
          logger.error("Failed to resolve existing Supabase user", { email, error: linkErr });
          sendError(res, 500, "Failed to resolve user account.");
          return;
        }

        userId = linkData.user.id;
        userEmail = linkData.user.email ?? email;
      } else {
        // Should not happen — createUser returned neither data nor error
        sendError(res, 500, "Unexpected error creating user account.");
        return;
      }
    }

    // 5. Mint Supabase session via magic link bridge
    // For returning users (step 4a) and new users (step 4b), we need a fresh generateLink call.
    // For step 4c, we already called generateLink but we call again to get a fresh token_hash
    // (the previous one may have already been used internally).
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      logger.error("Failed to generate magic link", { userId, error: linkErr });
      sendError(res, 500, "Failed to create session.");
      return;
    }

    const { data: otpData, error: otpErr } = await getSupabaseAuth().auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (otpErr || !otpData.session) {
      logger.error("Failed to verify OTP for session", { userId, error: otpErr });
      sendError(res, 500, "Failed to create session.");
      return;
    }

    const { access_token, refresh_token } = otpData.session;

    // 6. Upsert github_tokens (with stable github_user_id)
    const { error: upsertError } = await supabase.from("github_tokens").upsert({
      user_id: userId,
      github_user_id: ghUser.id,
      github_token: encryptToken(githubToken),
      github_username: ghUser.login,
      github_avatar_url: ghUser.avatar_url,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (upsertError) {
      logger.error("Failed to upsert github_tokens", { userId, error: upsertError });
      sendError(res, 500, "Failed to store GitHub token.");
      return;
    }

    // 7. Update display_name
    const displayName = ghUser.name || ghUser.login;
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { display_name: displayName },
    });

    // 8. Set auth cookies
    setAuthCookies(res, access_token, refresh_token);

    // 9. Return user data
    sendSuccess(res, {
      user: {
        id: userId,
        email: userEmail,
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
