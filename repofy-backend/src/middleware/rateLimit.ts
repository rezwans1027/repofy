/**
 * Rate limiters for various API routes.
 *
 * All limiters use the default MemoryStore from express-rate-limit v8,
 * which is **per-process**. The v8 MemoryStore handles TTL expiry
 * internally (entries are pruned each `windowMs` cycle), so there is
 * no memory-leak risk from stale entries.
 *
 * Limitation: In a single-instance deployment (e.g. one Railway service)
 * this works correctly. If the backend is scaled horizontally to multiple
 * replicas, each instance will track limits independently — a client
 * could get N × max requests by hitting different instances.
 *
 * TODO(scaling): When scaling beyond a single replica, switch to a shared
 * store such as `rate-limit-redis` (or `@rate-limit/redis` for v8):
 *
 *   1. `npm install rate-limit-redis ioredis`
 *   2. Create a shared RedisStore and pass it via the `store` option in
 *      `createLimiter()` below.
 *   3. Ensure REDIS_URL is set in the environment.
 *
 * For a single Railway instance this is unnecessary overhead — the
 * built-in MemoryStore is faster, simpler, and sufficient.
 */
import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** Derive a per-user key from the authenticated user ID, falling back to IP. */
function userKeyGenerator(req: Request): string {
  if (req.userId) return req.userId;
  return req.ip ?? "unknown";
}

/** Derive a compound key from IP + email (from POST body) for auth routes. */
function authKeyGenerator(req: Request): string {
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.toLowerCase().trim()
      : "";
  return email ? `${req.ip ?? "unknown"}:${email}` : req.ip ?? "unknown";
}

interface LimiterOptions {
  max: number;
  windowMs?: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

function createLimiter({
  max,
  windowMs = 60_000,
  keyGenerator,
  message = "Too many requests. Please try again later.",
}: LimiterOptions) {
  return rateLimit({
    windowMs,
    max,
    ...(keyGenerator && {
      keyGenerator,
      validate: { keyGeneratorIpFallback: false },
    }),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: message },
  });
}

/** Strict limiter for AI-powered routes (analyze, advice): 5 req/min per user */
export const aiRateLimit = createLimiter({ max: 5, keyGenerator: userKeyGenerator });

/** Tight limiter for Stripe checkout: 10 req/min per user */
export const stripeRateLimit = createLimiter({ max: 10, keyGenerator: userKeyGenerator });

/** Generous limiter for Stripe webhook: 100 req/min per IP */
export const webhookRateLimit = createLimiter({ max: 100, message: "Too many requests." });

/** Auth signup/verify limiter: 10 req/min per IP+email */
export const authRateLimit = createLimiter({ max: 10, keyGenerator: authKeyGenerator });

/** Tight limiter for OTP resend: 3 req/min per IP+email */
export const resendRateLimit = createLimiter({ max: 3, keyGenerator: authKeyGenerator });

/** Admin endpoint limiter: 20 req/min per IP */
export const adminRateLimit = createLimiter({ max: 20 });

/** Credit balance endpoint limiter: 30 req/min per user */
export const creditRateLimit = createLimiter({ max: 30, keyGenerator: userKeyGenerator });

/** Moderate limiter for GitHub proxy routes: 30 req/min per user */
export const githubRateLimit = createLimiter({ max: 30, keyGenerator: userKeyGenerator });

/** Read endpoint limiter: 60 req/min per user */
export const readRateLimit = createLimiter({ max: 60, keyGenerator: userKeyGenerator });

/**
 * Global IP-based rate limiter applied to ALL routes.
 * 100 requests per 15-minute window per IP.
 * Acts as a safety net above the per-route limiters.
 */
export const globalRateLimit = createLimiter({
  max: 100,
  windowMs: 15 * 60_000,
  message: "Too many requests from this IP. Please try again later.",
});
