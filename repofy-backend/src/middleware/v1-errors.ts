import type { ErrorRequestHandler } from "express";
import { sendError } from "../lib/response";
import { logger } from "../lib/logger";

// Handle v1 failures before generic logging/Sentry: parser and provider errors may embed input.
export const v1Errors: ErrorRequestHandler = (error, req, res, next) => {
  if (res.locals.apiVersion !== "v1") return next(error);
  if (res.headersSent) return;
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
  logger.error("Feature 1 request failed", { requestId: req.requestId, status, contractVersion: "1.0.0" });
  sendError(res, status, status < 500 ? "Invalid request." : "Internal server error");
};
