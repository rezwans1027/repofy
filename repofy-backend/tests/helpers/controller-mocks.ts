import { vi } from "vitest";
import type { Request, Response } from "express";

export function createControllerMocks(
  params: Record<string, string> = {},
  query: Record<string, string> = {},
) {
  const req = {
    params,
    query,
    signal: { aborted: false },
  } as unknown as Request;
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return { req, res };
}
