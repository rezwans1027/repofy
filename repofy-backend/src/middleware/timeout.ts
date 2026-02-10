import type { RequestHandler } from "express";

/**
 * Middleware that sets a response timeout.
 * If the response hasn't finished within `ms`, sends a 504 error and
 * aborts downstream work via an AbortSignal exposed on `req.signal`.
 */
export function timeout(ms: number): RequestHandler {
  return (req, res, next) => {
    const ac = new AbortController();
    // Expose abort signal so controllers/services can pass it to fetch/OpenAI calls
    req.signal = ac.signal;

    const timer = setTimeout(() => {
      ac.abort();
      if (!res.headersSent) {
        res.status(504).json({ success: false, error: "Request timed out" });
      }
    }, ms);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => {
      clearTimeout(timer);
      ac.abort();
    });
    next();
  };
}
