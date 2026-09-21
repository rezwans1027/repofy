export const INGESTION_CODES = ["INVALID_REQUEST", "ACCESS_REVOKED", "CANCELED", "TIMED_OUT", "PROVIDER_FAILURE", "UNSAFE_REDIRECT",
  "ARCHIVE_INVALID", "ARCHIVE_LIMIT", "UNSAFE_PATH", "UNSAFE_ENTRY", "INVALID_IGNORE", "SCANNER_FAILURE", "CONTEXT_LIMIT",
  "WORKSPACE_FAILURE", "DATABASE_FAILURE", "POLICY_MISMATCH", "LEASE_LOST", "CONTEXT_DISPOSED"] as const;
export type IngestionCode = typeof INGESTION_CODES[number];
/** Intentionally carries no cause, source path, upstream text, response body, or token. */
export class IngestionError extends Error {
  constructor(readonly code: IngestionCode) { super(`Snapshot ingestion failed: ${code}`); this.name = "IngestionError"; }
}
export function safeError(error: unknown, fallback: IngestionCode = "PROVIDER_FAILURE"): IngestionError {
  return new IngestionError(error instanceof IngestionError && INGESTION_CODES.includes(error.code) ? error.code : fallback);
}
export function checkSignal(signal: AbortSignal): void {
  if (signal.aborted) throw safeError(signal.reason, "CANCELED");
}

/** A stalled infrastructure call cannot hold a raw workspace indefinitely. Late
 * RPC responses are ignored; durable lease/state checks still fence mutations. */
export async function bounded<T>(promise: PromiseLike<T>, ms: number, code: IngestionCode = "TIMED_OUT"): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([Promise.resolve(promise), new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new IngestionError(code)), ms);
  })]); } finally { clearTimeout(timer); }
}
