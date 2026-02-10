import rateLimit from "express-rate-limit";

/** Strict limiter for AI-powered routes (analyze, advice): 5 req/min per IP */
export const aiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});

/** Moderate limiter for GitHub proxy routes: 30 req/min per IP */
export const githubRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests. Please try again later." },
});
