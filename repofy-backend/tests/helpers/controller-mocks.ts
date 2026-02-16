import { vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

export function createControllerMocks(
  params: Record<string, string> = { username: "octocat" },
  query: Record<string, string> = {},
) {
  const abortController = new AbortController();
  const req = {
    params,
    query,
    signal: abortController.signal,
  } as unknown as Request;
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next, abortController };
}
