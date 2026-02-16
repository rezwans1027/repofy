import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../../../src/middleware/asyncHandler";

function createMocks() {
  const req = {} as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("asyncHandler", () => {
  it("calls the wrapped handler", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const { req, res, next } = createMocks();

    await asyncHandler(handler)(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
  });

  it("passes rejected promise errors to next", async () => {
    const err = new Error("async failure");
    const handler = vi.fn().mockRejectedValue(err);
    const { req, res, next } = createMocks();

    await asyncHandler(handler)(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it("does not call next with an error when handler resolves", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const { req, res, next } = createMocks();

    await asyncHandler(handler)(req, res, next);

    // asyncHandler's catch branch should not fire on success
    expect(next).not.toHaveBeenCalled();
  });
});
