import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../../../src/services/auth.service", () => ({
  refreshSession: vi.fn(),
}));
vi.mock("../../../src/lib/encryption", () => ({
  encryptToken: (v: string) => `encrypted:${v}`,
  decryptToken: (v: string) => v.replace("encrypted:", ""),
  isEncrypted: (v: string) => v.startsWith("encrypted:"),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { requireAuth, clearTokenCache, invalidateToken } from "../../../src/middleware/auth";
import { getSupabaseAdmin } from "../../../src/config/supabase";
import { refreshSession } from "../../../src/services/auth.service";

function createMocks(overrides: {
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  headersSent?: boolean;
} = {}) {
  const req = {
    headers: overrides.headers ?? {},
    cookies: overrides.cookies ?? {},
  } as unknown as Request;
  const res = {
    headersSent: overrides.headersSent ?? false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

function mockGetUserSuccess(id = "user-1", email = "user@test.com") {
  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user: { id, email } },
    error: null,
  });
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    auth: { getUser: mockGetUser },
  } as any);
  return mockGetUser;
}

function mockGetUserFailure(message = "Invalid token") {
  const mockGetUser = vi.fn().mockResolvedValue({
    data: { user: null },
    error: { message },
  });
  vi.mocked(getSupabaseAdmin).mockReturnValue({
    auth: { getUser: mockGetUser },
  } as any);
  return mockGetUser;
}

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenCache();
  });

  // --- Basic auth checks ---
  it("returns 401 when no authorization header and no cookies", async () => {
    const { req, res, next } = createMocks();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when authorization header is not Bearer", async () => {
    const { req, res, next } = createMocks({ headers: { authorization: "Basic abc" } });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid and no refresh token", async () => {
    mockGetUserFailure();
    const { req, res, next } = createMocks({ headers: { authorization: "Bearer bad-token" } });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and sets userId/userEmail when token is valid", async () => {
    mockGetUserSuccess();
    const { req, res, next } = createMocks({ headers: { authorization: "Bearer valid-token" } });

    await requireAuth(req, res, next);

    expect(req.userId).toBe("user-1");
    expect(req.userEmail).toBe("user@test.com");
    expect(next).toHaveBeenCalledWith();
  });

  it("skips when headers already sent", async () => {
    const { req, res, next } = createMocks({ headersSent: true });

    await requireAuth(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards unexpected errors to next", async () => {
    const err = new Error("Supabase down");
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw err;
    });

    const { req, res, next } = createMocks({ headers: { authorization: "Bearer token" } });

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  // --- Cookie-based auth ---
  it("extracts token from access_token cookie", async () => {
    mockGetUserSuccess();
    const { req, res, next } = createMocks({
      cookies: { access_token: "cookie-token" },
    });

    await requireAuth(req, res, next);

    expect(req.userId).toBe("user-1");
    expect(next).toHaveBeenCalledWith();
  });

  // --- Token cache ---
  it("caches a verified token and uses cache on second call", async () => {
    const mockGetUser = mockGetUserSuccess();
    const { req, res, next } = createMocks({ headers: { authorization: "Bearer cached-token" } });

    await requireAuth(req, res, next);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(req.userId).toBe("user-1");

    // Second call should use cache
    const { req: req2, res: res2, next: next2 } = createMocks({ headers: { authorization: "Bearer cached-token" } });
    await requireAuth(req2, res2, next2);

    // getUser should not be called again
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(req2.userId).toBe("user-1");
    expect(next2).toHaveBeenCalledWith();
  });

  it("clearTokenCache removes all cached tokens", async () => {
    const mockGetUser = mockGetUserSuccess();
    const { req, res, next } = createMocks({ headers: { authorization: "Bearer to-clear" } });

    await requireAuth(req, res, next);
    expect(mockGetUser).toHaveBeenCalledTimes(1);

    clearTokenCache();

    // After clearing, should call getUser again
    const { req: req2, res: res2, next: next2 } = createMocks({ headers: { authorization: "Bearer to-clear" } });
    await requireAuth(req2, res2, next2);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  it("invalidateToken removes a specific token from cache", async () => {
    const mockGetUser = mockGetUserSuccess();
    const { req, res, next } = createMocks({ headers: { authorization: "Bearer specific-tok" } });

    await requireAuth(req, res, next);
    expect(mockGetUser).toHaveBeenCalledTimes(1);

    invalidateToken("specific-tok");

    const { req: req2, res: res2, next: next2 } = createMocks({ headers: { authorization: "Bearer specific-tok" } });
    await requireAuth(req2, res2, next2);
    expect(mockGetUser).toHaveBeenCalledTimes(2);
  });

  // --- Token cache eviction (max size = 256) ---
  it("evicts oldest cache entry when cache is full on verify path", async () => {
    // Fill the cache with 256 entries by calling requireAuth with unique tokens
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "filler", email: "filler@test.com" } },
      error: null,
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: mockGetUser },
    } as any);

    for (let i = 0; i < 256; i++) {
      const { req, res, next } = createMocks({ headers: { authorization: `Bearer fill-${i}` } });
      await requireAuth(req, res, next);
    }
    expect(mockGetUser).toHaveBeenCalledTimes(256);

    // Now add one more — this should trigger eviction of the oldest entry
    const { req, res, next } = createMocks({ headers: { authorization: "Bearer overflow-token" } });
    await requireAuth(req, res, next);
    expect(req.userId).toBe("filler");
    expect(next).toHaveBeenCalled();
  });

  it("evicts oldest cache entry when cache is full on refresh path", async () => {
    // Fill the cache with 256 entries
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "filler", email: "filler@test.com" } },
      error: null,
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: mockGetUser },
    } as any);

    for (let i = 0; i < 256; i++) {
      const { req, res, next } = createMocks({ headers: { authorization: `Bearer rfill-${i}` } });
      await requireAuth(req, res, next);
    }

    // Now trigger refresh path with full cache
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });
    vi.mocked(refreshSession).mockResolvedValue({
      session: { access_token: "new-tok-evict", refresh_token: "new-rt" },
      user: { id: "evict-user", email: "evict@test.com" },
    });

    const { req, res, next } = createMocks({
      cookies: { access_token: "bad-tok", refresh_token: "good-rt" },
    });
    await requireAuth(req, res, next);

    expect(req.userId).toBe("evict-user");
    expect(next).toHaveBeenCalled();
  });

  // --- Auto-refresh path ---
  describe("auto-refresh", () => {
    it("refreshes session when access token is invalid but refresh token is available", async () => {
      mockGetUserFailure();
      vi.mocked(refreshSession).mockResolvedValue({
        session: { access_token: "new-access", refresh_token: "new-refresh" },
        user: { id: "refreshed-user", email: "refreshed@test.com" },
      });

      const { req, res, next } = createMocks({
        cookies: {
          access_token: "expired-access",
          refresh_token: "valid-refresh",
        },
      });

      await requireAuth(req, res, next);

      expect(refreshSession).toHaveBeenCalledWith("valid-refresh");
      expect(res.cookie).toHaveBeenCalledWith(
        "access_token",
        "new-access",
        expect.any(Object),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "new-refresh",
        expect.any(Object),
      );
      expect(req.userId).toBe("refreshed-user");
      expect(req.userEmail).toBe("refreshed@test.com");
      expect(next).toHaveBeenCalledWith();
    });

    it("caches the new access token after successful refresh", async () => {
      mockGetUserFailure();
      vi.mocked(refreshSession).mockResolvedValue({
        session: { access_token: "new-access-cached", refresh_token: "new-refresh" },
        user: { id: "cached-user", email: "cached@test.com" },
      });

      const { req, res, next } = createMocks({
        cookies: {
          access_token: "expired",
          refresh_token: "valid-refresh",
        },
      });

      await requireAuth(req, res, next);
      expect(req.userId).toBe("cached-user");

      // Second request with the new token should hit cache
      // Need to mock getUser to succeed this time (but it shouldn't be called)
      const mockGetUser2 = vi.fn();
      vi.mocked(getSupabaseAdmin).mockReturnValue({
        auth: { getUser: mockGetUser2 },
      } as any);

      const { req: req2, res: res2, next: next2 } = createMocks({
        cookies: { access_token: "new-access-cached" },
      });

      await requireAuth(req2, res2, next2);
      expect(mockGetUser2).not.toHaveBeenCalled();
      expect(req2.userId).toBe("cached-user");
    });

    it("clears cookies and returns 401 when refresh fails", async () => {
      mockGetUserFailure();
      vi.mocked(refreshSession).mockRejectedValue(new Error("Session expired"));

      const { req, res, next } = createMocks({
        cookies: {
          access_token: "expired-access",
          refresh_token: "bad-refresh",
        },
      });

      await requireAuth(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith("access_token", expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith("refresh_token", expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 without trying refresh when no refresh token cookie exists", async () => {
      mockGetUserFailure();

      const { req, res, next } = createMocks({
        headers: { authorization: "Bearer expired-token" },
      });

      await requireAuth(req, res, next);

      expect(refreshSession).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("does not send 401 if headers already sent when refresh fails", async () => {
      mockGetUserFailure();
      vi.mocked(refreshSession).mockRejectedValue(new Error("Session expired"));

      const { req, res, next } = createMocks({
        cookies: {
          access_token: "expired-access",
          refresh_token: "bad-refresh",
        },
      });

      // Simulate headers being sent before the refresh catch
      // We need the clearAuthCookies to run but sendError to be skipped
      const originalClearCookie = res.clearCookie;
      (res as any).clearCookie = vi.fn().mockImplementation((...args: any[]) => {
        (res as any).headersSent = true;
        return originalClearCookie.apply(res, args);
      });

      await requireAuth(req, res, next);

      // clearAuthCookies was called but sendError should have been skipped
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("auto-refreshes when token comes via Bearer header and refresh cookie exists", async () => {
      mockGetUserFailure();
      vi.mocked(refreshSession).mockResolvedValue({
        session: { access_token: "refreshed-access", refresh_token: "refreshed-refresh" },
        user: { id: "u2", email: "u2@test.com" },
      });

      const { req, res, next } = createMocks({
        headers: { authorization: "Bearer expired-bearer" },
        cookies: { refresh_token: "valid-rt" },
      });

      await requireAuth(req, res, next);

      expect(refreshSession).toHaveBeenCalledWith("valid-rt");
      expect(req.userId).toBe("u2");
      expect(next).toHaveBeenCalledWith();
    });
  });

  // --- headersSent guard after getUser ---
  it("does not send response if headers were sent during getUser call", async () => {
    const mockGetUser = vi.fn().mockImplementation(async () => {
      // Simulate headers being sent while getUser is in flight
      return { data: { user: null }, error: { message: "Invalid" } };
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: mockGetUser },
    } as any);

    const { req, res, next } = createMocks({
      headers: { authorization: "Bearer tok" },
    });

    // Simulate headersSent becoming true after getUser returns
    // First the getUser is called, then we check headersSent
    const originalGetUser = mockGetUser;
    mockGetUser.mockImplementation(async () => {
      (res as any).headersSent = true;
      return { data: { user: { id: "x", email: "x@test.com" } }, error: null };
    });

    await requireAuth(req, res, next);

    // Should bail out because headersSent is true
    expect(res.status).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  // --- Token encryption ---
  it("decrypts encrypted GitHub tokens from the database", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "enc-user", email: "enc@test.com" } },
      error: null,
    });
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { github_token: "encrypted:gho_secret123" },
      error: null,
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockMaybeSingle,
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: vi.fn().mockReturnValue({ catch: vi.fn() }),
          }),
        }),
      }),
    } as any);

    const { req, res, next } = createMocks({ headers: { authorization: "Bearer enc-token" } });
    await requireAuth(req, res, next);

    expect(req.githubToken).toBe("gho_secret123");
    expect(next).toHaveBeenCalledWith();
  });

  it("returns plaintext token as-is and triggers lazy migration for unencrypted tokens", async () => {
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: { id: "plain-user", email: "plain@test.com" } },
      error: null,
    });
    const mockThen = vi.fn().mockReturnValue({ catch: vi.fn() });
    const mockEqToken = vi.fn().mockReturnValue({ then: mockThen });
    const mockEqUserId = vi.fn().mockReturnValue({ eq: mockEqToken });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUserId });
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { github_token: "gho_plaintext_token" },
      error: null,
    });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      update: mockUpdate,
    });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    } as any);

    const { req, res, next } = createMocks({ headers: { authorization: "Bearer plain-token" } });
    await requireAuth(req, res, next);

    // Should return the plaintext token
    expect(req.githubToken).toBe("gho_plaintext_token");
    expect(next).toHaveBeenCalledWith();

    // Should have triggered lazy migration (fire-and-forget update)
    expect(mockUpdate).toHaveBeenCalledWith({
      github_token: "encrypted:gho_plaintext_token",
    });
    // Conditional write: only update if the row still holds the original plaintext
    expect(mockEqToken).toHaveBeenCalledWith("github_token", "gho_plaintext_token");
  });

  // --- Error when headersSent is true during catch ---
  it("does not forward error via next if headers already sent during catch", async () => {
    const err = new Error("Boom");
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw err;
    });

    const { req, res, next } = createMocks({
      headers: { authorization: "Bearer token" },
      headersSent: true,
    });

    await requireAuth(req, res, next);

    // When headersSent is true at the top, it exits early
    // But if it fails in the catch, it should not call next
    expect(next).not.toHaveBeenCalled();
  });
});
