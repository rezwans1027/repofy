/**
 * Returns true for errors that warrant a credit refund:
 * AI service 5xx, network timeout, unexpected internal errors.
 * Returns false for 4xx-class errors.
 */
export function isRefundableError(err: unknown): boolean {
  // Abort signal = client disconnect or timeout
  if (err instanceof DOMException && err.name === "AbortError") return true;

  // Explicit HTTP status from AI provider SDK
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    return status >= 500;
  }

  // Any other unexpected exception — refund to be safe
  // GitHubError is a known 4xx but can't reach here (thrown before deduction)
  return true;
}
