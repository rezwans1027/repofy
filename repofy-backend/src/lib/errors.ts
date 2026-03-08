import { logger } from "./logger";

/**
 * Sanitised database error — the message shown to clients never
 * exposes internal schema details. The raw Supabase error is
 * logged server-side via `cause`.
 */
export class DatabaseError extends Error {
  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "DatabaseError";
    logger.error(message, cause);
  }
}

/**
 * Replaces the common `if (error) throw error` pattern for Supabase calls.
 * Wraps the raw error in a DatabaseError with a sanitised client-facing message.
 */
export function throwIfDbError(error: unknown, context: string): void {
  if (error) {
    throw new DatabaseError(`Database operation failed: ${context}`, error);
  }
}
