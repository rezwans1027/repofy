import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockEnv: Record<string, unknown> = {
  isProduction: false,
};
vi.mock("../../../src/config/env", () => ({
  env: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => mockEnv[prop],
  }),
}));

import { errorHandler } from "../../../src/middleware/errorHandler";

function createMocks() {
  const req = {} as Request;
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("errorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.isProduction = false;
  });

  it("sends error with status from err.status", () => {
    const { req, res, next } = createMocks();
    const err = Object.assign(new Error("Bad request"), { status: 400 });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Bad request",
    });
  });

  it("defaults to 500 when err.status is missing", () => {
    const { req, res, next } = createMocks();

    errorHandler(new Error("Unexpected"), req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("hides error message in production", () => {
    mockEnv.isProduction = true;
    const { req, res, next } = createMocks();

    errorHandler(new Error("secret detail"), req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal server error",
    });
  });

  it("hides error message in production even for 400-level errors", () => {
    mockEnv.isProduction = true;
    const { req, res, next } = createMocks();
    const err = Object.assign(new Error("Validation failed"), { status: 400 });

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal server error",
    });
  });

  it("does nothing when headers already sent", () => {
    const { req, res, next } = createMocks();
    (res as any).headersSent = true;

    errorHandler(new Error("ignored"), req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
