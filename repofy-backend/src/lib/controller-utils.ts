import type { Request, Response, NextFunction } from "express";
import { GitHubError } from "../services/github.service";
import { InsufficientCreditsError } from "../services/advice-persistence.service";
import { sendError } from "./response";
import { logger } from "./logger";

/**
 * Shared error handler for AI-powered controller endpoints (analyze, advice).
 * Returns `true` if the error was handled (response sent or skipped), `false` otherwise.
 */
export function handleControllerError(
  err: unknown,
  req: Request,
  res: Response,
  context: string,
  fallbackMessage: string,
): boolean {
  if (req.signal?.aborted || res.headersSent) return true;

  if (err instanceof InsufficientCreditsError) {
    sendError(res, 402, err.message);
    return true;
  }

  if (err instanceof GitHubError) {
    sendError(res, err.statusCode, err.message);
    return true;
  }

  logger.error(`${context} error:`, err);
  sendError(res, 500, fallbackMessage);
  return true;
}
