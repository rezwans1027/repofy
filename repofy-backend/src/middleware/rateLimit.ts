import crypto from "crypto";
import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** Derive a per-user key from the Bearer token (hashed), falling back to IP. */
function userKeyGenerator(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
  }
  return req.ip ?? "unknown";
}

/** Strict limiter for AI-powered routes (analyze, advice): 5 req/min per user */
export const aiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: userKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

/** Tight limiter for Stripe checkout: 10 req/min per user */
export const stripeRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: userKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

/** Generous limiter for Stripe webhook: 100 req/min per IP */
export const webhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests." },
});

/** Auth signup/verify limiter: 10 req/min per IP */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

/** Admin endpoint limiter: 20 req/min per IP */
export const adminRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

/** Credit balance endpoint limiter: 30 req/min per user */
export const creditRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: userKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

/** Moderate limiter for GitHub proxy routes: 30 req/min per user */
export const githubRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: userKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});
