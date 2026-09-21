import { Response } from "express";
import { ApiResponse } from "../types";
import { ApiErrorEnvelopeSchema, type ErrorCode } from "@repofy/contracts";

export function sendError(res: Response, status: number, message: string, details?: { code: ErrorCode; retryable: boolean }): void {
  if (res.locals?.apiVersion === "v1") {
    const code = details?.code ?? (
      status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" :
      status === 429 ? "RATE_LIMITED" : status >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST"
    );
    const response = ApiErrorEnvelopeSchema.parse({
      success: false, error: message, code,
      retryable: details?.retryable ?? (status === 429 || status === 503),
      requestId: res.locals.requestId,
    });
    res.status(status).json(response);
    return;
  }
  const response: ApiResponse = { success: false, error: message };
  res.status(status).json(response);
}

export function sendSuccess<T>(res: Response, data: T): void {
  const response: ApiResponse<T> = { success: true, data };
  res.json(response);
}
