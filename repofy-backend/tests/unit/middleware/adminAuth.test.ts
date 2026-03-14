import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const VALID_ADMIN_SECRET = "test-admin-secret-key-2024";

const mockEnv: Record<string, unknown> = {
  adminSecret: VALID_ADMIN_SECRET,
};
vi.mock("../../../src/config/env", () => ({
  env: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => mockEnv[prop],
  }),
}));

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

describe("requireAdminKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.adminSecret = VALID_ADMIN_SECRET;
  });

  describe("when admin secret is configured", () => {
    let requireAdminKey: typeof import("../../../src/middleware/adminAuth").requireAdminKey;

    beforeEach(async () => {
      vi.resetModules();
      mockEnv.adminSecret = VALID_ADMIN_SECRET;
      const mod = await import("../../../src/middleware/adminAuth");
      requireAdminKey = mod.requireAdminKey;
    });

    it("calls next() when x-admin-key header matches the admin secret", () => {
      const { req, res, next } = createMocks({ "x-admin-key": VALID_ADMIN_SECRET });

      requireAdminKey(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 401 when x-admin-key header is missing", () => {
      const { req, res, next } = createMocks();

      requireAdminKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Unauthorized" }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when x-admin-key header is wrong", () => {
      const { req, res, next } = createMocks({ "x-admin-key": "wrong-key" });

      requireAdminKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Unauthorized" }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when x-admin-key header is an empty string", () => {
      const { req, res, next } = createMocks({ "x-admin-key": "" });

      requireAdminKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("uses crypto.timingSafeEqual for comparison", () => {
      const spy = vi.spyOn(crypto, "timingSafeEqual");
      const { req, res, next } = createMocks({ "x-admin-key": VALID_ADMIN_SECRET });

      requireAdminKey(req, res, next);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Buffer),
      );
      spy.mockRestore();
    });

    it("uses timing-safe comparison even for wrong keys", () => {
      const spy = vi.spyOn(crypto, "timingSafeEqual");
      const { req, res, next } = createMocks({ "x-admin-key": "wrong-key" });

      requireAdminKey(req, res, next);

      expect(spy).toHaveBeenCalledOnce();
      expect(res.status).toHaveBeenCalledWith(401);
      spy.mockRestore();
    });
  });

  describe("when admin secret is not configured", () => {
    let requireAdminKey: typeof import("../../../src/middleware/adminAuth").requireAdminKey;

    beforeEach(async () => {
      vi.resetModules();
      mockEnv.adminSecret = undefined;
      const mod = await import("../../../src/middleware/adminAuth");
      requireAdminKey = mod.requireAdminKey;
    });

    it("returns 401 even when a valid-looking key is provided", () => {
      const { req, res, next } = createMocks({ "x-admin-key": "any-key" });

      requireAdminKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: "Unauthorized" }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when no key is provided", () => {
      const { req, res, next } = createMocks();

      requireAdminKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
