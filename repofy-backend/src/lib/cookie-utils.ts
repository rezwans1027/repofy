import type { Request, Response } from "express";
import { COOKIE_NAMES, getCookieOptions } from "../config/cookies";
import { env } from "../config/env";

/** Set both auth cookies on the response. */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const opts = getCookieOptions(env.isProduction);
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, opts.accessToken);
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, opts.refreshToken);
}

/** Clear both auth cookies (maxAge: 0). */
export function clearAuthCookies(res: Response): void {
  const opts = getCookieOptions(env.isProduction);
  const { maxAge: _a, ...accessClearOpts } = opts.accessToken;
  const { maxAge: _r, ...refreshClearOpts } = opts.refreshToken;
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, accessClearOpts);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, refreshClearOpts);
}

/** Extract access token from cookie first, then fall back to Authorization header. */
export function extractAccessToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return undefined;
}

/** Extract refresh token from cookie only (no header fallback). */
export function extractRefreshToken(req: Request): string | undefined {
  return req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
}
