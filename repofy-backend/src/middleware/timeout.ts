import type { RequestHandler } from "express";

/**
 * Middleware that sets a response timeout.
 * If the response hasn't finished within `ms`, sends a 504 error.
 */
export function timeout(ms: number): RequestHandler {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ success: false, error: "Request timed out" });
      }
    }, ms);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  };
}
