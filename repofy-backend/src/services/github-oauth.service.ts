/**
 * github-oauth.service.ts — GitHub App OAuth code exchange and user info.
 *
 * Handles the server-side portion of the GitHub App OAuth flow:
 *  1. Exchange an authorization code for a user access token
 *  2. Fetch the authenticated GitHub user's profile
 *  3. Fetch the user's primary verified email (when not public)
 */
import { env } from "../config/env";
import { logger } from "../lib/logger";

// ── Types ────────────────────────────────────────────────────────────

export interface GitHubOAuthUser {
  id: number;          // Stable numeric user ID
  login: string;       // Current username (mutable)
  avatar_url: string;
  name: string | null;
  email: string | null; // May be null if no public email
}

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

// ── Code exchange ───────────────────────────────��────────────────────

/**
 * Exchange a GitHub authorization code for a user access token.
 * Sends the PKCE code_verifier for proof-of-possession.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json", // GitHub returns form-encoded by default without this
    },
    body: JSON.stringify({
      client_id: env.githubAppClientId,
      client_secret: env.githubAppClientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    logger.error("GitHub token exchange HTTP error", { status: res.status });
    throw new Error(`GitHub token exchange failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as GitHubTokenResponse;

  if (data.error || !data.access_token) {
    logger.error("GitHub token exchange error", {
      error: data.error,
      description: data.error_description,
    });
    throw new Error(
      data.error_description || data.error || "GitHub token exchange failed",
    );
  }

  return data.access_token;
}

// ── User info ────────────────────────────────────────────────────────

/**
 * Fetch the authenticated GitHub user's profile.
 */
export async function getGitHubUser(token: string): Promise<GitHubOAuthUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Repofy",
    },
  });

  if (!res.ok) {
    logger.error("GitHub /user call failed", { status: res.status });
    throw new Error(`GitHub /user failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as GitHubOAuthUser;
  return data;
}

/**
 * Fetch the user's primary verified email address.
 * Called when the /user endpoint returns no public email.
 * Requires the `user:email` permission on the GitHub App.
 */
export async function getGitHubUserEmail(token: string): Promise<string> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Repofy",
    },
  });

  if (!res.ok) {
    logger.error("GitHub /user/emails call failed", { status: res.status });
    throw new Error(`GitHub /user/emails failed: HTTP ${res.status}`);
  }

  const emails = (await res.json()) as GitHubEmail[];
  const primary = emails.find((e) => e.primary && e.verified);

  if (!primary) {
    throw new Error("No primary verified email found on GitHub account");
  }

  return primary.email;
}
