import { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";
import { DatabaseError } from "../lib/errors";
import { sendError } from "../lib/response";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  // DatabaseError already logged the raw cause in its constructor;
  // surface only the sanitised message to the client.
  if (err instanceof DatabaseError) {
    sendError(res, 500, err.message);
    return;
  }

  const status = err.status || 500;

  logger.error("Unhandled error", { status, message: err.message, stack: err.stack });

  const message = status >= 500 ? "Internal server error" : err.message;
  const body: Record<string, unknown> = { success: false, error: message };
  if (process.env.NODE_ENV !== "production" && err.stack) {
    body.stack = err.stack;
  }
  res.status(status).json(body);
};
