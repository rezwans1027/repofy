import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { requireAuth } from "../../../src/middleware/auth";
import { getSupabaseAdmin } from "../../../src/config/supabase";

function createMocks(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const res = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no authorization header", async () => {
    const { req, res, next } = createMocks();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is not Bearer", async () => {
    const { req, res, next } = createMocks({ authorization: "Basic abc" });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: mockGetUser },
    } as any);

    const { req, res, next } = createMocks({ authorization: "Bearer bad-token" });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets userId/userEmail when token is valid", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1", email: "user@test.com" } },
      error: null,
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: mockGetUser },
    } as any);

    const { req, res, next } = createMocks({ authorization: "Bearer valid-token" });

    await requireAuth(req, res, next);

    expect(req.userId).toBe("user-1");
    expect(req.userEmail).toBe("user@test.com");
    expect(next).toHaveBeenCalledWith();
  });

  it("skips when headers already sent", async () => {
    const { req, res, next } = createMocks();
    (res as any).headersSent = true;

    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards unexpected errors to next", async () => {
    const err = new Error("Supabase down");
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw err;
    });

    const { req, res, next } = createMocks({ authorization: "Bearer token" });

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
