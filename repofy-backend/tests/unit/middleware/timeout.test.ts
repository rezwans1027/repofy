import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { timeout } from "../../../src/middleware/timeout";

function createMocks() {
  const listeners: Record<string, Function> = {};
  const req = {} as Request;
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, cb: Function) => {
      listeners[event] = cb;
    }),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, listeners };
}

describe("timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls next immediately and attaches signal to req", () => {
    const { req, res, next } = createMocks();
    const mw = timeout(1000);

    mw(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.signal).toBeDefined();
    expect(req.signal!.aborted).toBe(false);
  });

  it("sends 504 and aborts signal after timeout", () => {
    const { req, res, next } = createMocks();
    const mw = timeout(100);

    mw(req, res, next);
    vi.advanceTimersByTime(100);

    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Request timed out",
    });
    expect(req.signal!.aborted).toBe(true);
  });

  it("does not send 504 if headers already sent", () => {
    const { req, res, next } = createMocks();
    const mw = timeout(100);

    mw(req, res, next);
    (res as any).headersSent = true;
    vi.advanceTimersByTime(100);

    expect(res.status).not.toHaveBeenCalled();
  });

  it("clears timer on response finish", () => {
    const { req, res, next, listeners } = createMocks();
    const mw = timeout(100);

    mw(req, res, next);
    listeners["finish"]();
    vi.advanceTimersByTime(200);

    expect(res.status).not.toHaveBeenCalled();
  });

  it("clears timer and aborts on response close", () => {
    const { req, res, next, listeners } = createMocks();
    const mw = timeout(100);

    mw(req, res, next);
    listeners["close"]();

    vi.advanceTimersByTime(200);

    expect(res.status).not.toHaveBeenCalled();
    expect(req.signal!.aborted).toBe(true);
  });
});
