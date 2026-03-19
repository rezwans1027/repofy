/**
 * In-memory access token cache.
 *
 * The auth provider sets this on every auth state change. API calls read
 * it synchronously — no getSession() needed on the request hot path.
 * This avoids the Supabase Web Locks issue in headless Chromium (CI).
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}
