import type { CookieOptions } from "express";

export const COOKIE_NAMES = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
} as const;

interface CookieConfig {
  accessToken: CookieOptions;
  refreshToken: CookieOptions;
}

export function getCookieOptions(isProduction: boolean): CookieConfig {
  return {
    accessToken: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    refreshToken: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  };
}
