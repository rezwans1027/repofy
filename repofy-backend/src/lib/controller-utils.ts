import type { Request, Response, NextFunction } from "express";
import { GitHubError } from "../services/github.service";
import { InsufficientCreditsError } from "../services/advice-persistence.service";
import { sendError } from "./response";
import { logger } from "./logger";

/** Duck-type check for errors with a numeric status (e.g. AuthError). */
function hasStatus(err: unknown): err is Error & { status: number } {
  return err instanceof Error && typeof (err as any).status === "number";
}

/**
 * Shared error handler for controller endpoints.
 * Handles the error by sending a response. Returns early if the response was already sent.
 */
export function handleControllerError(
  err: unknown,
  req: Request,
  res: Response,
  context: string,
  fallbackMessage: string,
): void {
  if (req.signal?.aborted || res.headersSent) return;

  if (err instanceof InsufficientCreditsError) {
    sendError(res, 402, err.message);
    return;
  }

  if (err instanceof GitHubError) {
    sendError(res, err.statusCode, err.message);
    return;
  }

  if (hasStatus(err)) {
    sendError(res, err.status, err.message);
    return;
  }

  logger.error(`${context} error:`, err);
  sendError(res, 500, fallbackMessage);
}
