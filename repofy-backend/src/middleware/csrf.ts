import type { RequestHandler } from "express";
import { COOKIE_NAMES } from "../config/cookies";
import { env } from "../config/env";
import { sendError } from "../lib/response";

const MUTATING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);
const SKIP_PATHS = ["/api/stripe/webhook"];

const allowedOrigins = env.corsOrigin.split(",").map((o) => o.trim());

export const csrfProtection: RequestHandler = (req, res, next) => {
  // Only check mutating methods
  if (!MUTATING_METHODS.has(req.method)) return next();

  // Skip paths that don't need CSRF (server-to-server)
  if (SKIP_PATHS.some((p) => req.path === p || req.originalUrl === p)) return next();

  // Only enforce when auth cookies are present
  const hasAccessCookie = !!req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  const hasRefreshCookie = !!req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
  if (!hasAccessCookie && !hasRefreshCookie) return next();

  // 1. Require X-Requested-With header (blocks simple cross-origin form posts)
  if (!req.headers["x-requested-with"]) {
    sendError(res, 403, "Forbidden");
    return;
  }

  // 2. Validate Origin header against allowlist
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    sendError(res, 403, "Forbidden");
    return;
  }

  // 3. Check Sec-Fetch-Site (modern browsers send this automatically, unforgeable)
  const secFetchSite = req.headers["sec-fetch-site"];
  if (secFetchSite === "cross-site") {
    sendError(res, 403, "Forbidden");
    return;
  }

  next();
};
