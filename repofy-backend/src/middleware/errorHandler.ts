import { ErrorRequestHandler } from "express";
import { logger } from "../lib/logger";
import { sendError } from "../lib/response";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  const status = err.status || 500;

  logger.error("Unhandled error", { status, message: err.message, stack: err.stack });

  const message = status >= 500 ? "Internal server error" : err.message;
  sendError(res, status, message);
};
