import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/auth.service", () => ({
  refreshSession: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/middleware/auth", () => ({
  invalidateToken: vi.fn(),
}));
vi.mock("../../../src/lib/encryption", () => ({
  encryptToken: (v: string) => `encrypted:${v}`,
  decryptToken: (v: string) => v.replace("encrypted:", ""),
  isEncrypted: (v: string) => v.startsWith("encrypted:"),
}));
vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      admin: {
        signOut: vi.fn().mockResolvedValue({}),
        getUserById: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { display_name: "Test User" } } } }),
        updateUserById: vi.fn().mockResolvedValue({}),
      },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: { github_username: "testuser", github_avatar_url: "https://example.com/avatar.png" }, error: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  })),
}));
vi.mock("../../../src/lib/cookie-utils", () => ({
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
  extractAccessToken: vi.fn(),
  extractRefreshToken: vi.fn(),
}));

import {
  handleGitHubCallback,
  handleRefresh,
  handleMe,
  handleLogout,
} from "../../../src/controllers/auth.controller";
import { refreshSession, AuthError } from "../../../src/services/auth.service";
import { setAuthCookies, clearAuthCookies, extractAccessToken, extractRefreshToken } from "../../../src/lib/cookie-utils";

const mockRefreshSession = refreshSession as ReturnType<typeof vi.fn>;
const mockSetAuthCookies = setAuthCookies as ReturnType<typeof vi.fn>;
const mockClearAuthCookies = clearAuthCookies as ReturnType<typeof vi.fn>;
const mockExtractAccessToken = extractAccessToken as ReturnType<typeof vi.fn>;
const mockExtractRefreshToken = extractRefreshToken as ReturnType<typeof vi.fn>;

describe("handleGitHubCallback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when tokens are missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = {};

    await handleGitHubCallback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Missing required tokens." });
  });

  it("returns 400 when provider_token is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { access_token: "at", refresh_token: "rt" };

    await handleGitHubCallback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("encrypts provider_token before upserting to github_tokens", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = {
      access_token: "valid-at",
      refresh_token: "valid-rt",
      provider_token: "gho_testtoken123",
    };

    // Mock global fetch for GitHub /user call
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        login: "testuser",
        avatar_url: "https://example.com/avatar.png",
        name: "Test User",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    // getUser returns a user with matching GitHub identity
    const { getSupabaseAdmin } = await import("../../../src/config/supabase");
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "u1",
              identities: [{
                provider: "github",
                identity_data: { user_name: "testuser" },
              }],
            },
          },
          error: null,
        }),
        admin: {
          updateUserById: vi.fn().mockResolvedValue({}),
        },
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    } as any);

    await handleGitHubCallback(req, res, next);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        github_token: "encrypted:gho_testtoken123",
      }),
      expect.any(Object),
    );
    vi.unstubAllGlobals();
  });
});

describe("handleRefresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refreshes session and sets new cookies", async () => {
    const { req, res, next } = createControllerMocks();
    mockExtractRefreshToken.mockReturnValue("rt");
    mockRefreshSession.mockResolvedValue({
      session: { access_token: "new-at", refresh_token: "new-rt" },
      user: { id: "u1", email: "a@b.com" },
    });

    await handleRefresh(req, res, next);

    expect(mockSetAuthCookies).toHaveBeenCalledWith(res, "new-at", "new-rt");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: { id: "u1", email: "a@b.com" } },
    });
  });

  it("returns 401 when no refresh token", async () => {
    const { req, res, next } = createControllerMocks();
    mockExtractRefreshToken.mockReturnValue(undefined);

    await handleRefresh(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("clears cookies on refresh failure", async () => {
    const { req, res, next } = createControllerMocks();
    mockExtractRefreshToken.mockReturnValue("rt");
    mockRefreshSession.mockRejectedValue(new AuthError("Session expired", 401));

    await handleRefresh(req, res, next);

    expect(mockClearAuthCookies).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("handleMe", () => {
  it("returns user data with GitHub info", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "u1";
    (req as any).userEmail = "a@b.com";

    await handleMe(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        user: {
          id: "u1",
          email: "a@b.com",
          display_name: "Test User",
          github_username: "testuser",
          avatar_url: "https://example.com/avatar.png",
        },
      },
    });
  });
});

describe("handleLogout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears cookies and returns success", async () => {
    const { req, res, next } = createControllerMocks();
    mockExtractAccessToken.mockReturnValue(undefined);

    await handleLogout(req, res, next);

    expect(mockClearAuthCookies).toHaveBeenCalledWith(res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: "Logged out successfully." },
    });
  });

  it("invalidates token cache when token present", async () => {
    const { req, res, next } = createControllerMocks();
    mockExtractAccessToken.mockReturnValue("some-token");

    await handleLogout(req, res, next);

    const { invalidateToken } = await import("../../../src/middleware/auth");
    expect(invalidateToken).toHaveBeenCalledWith("some-token");
    expect(mockClearAuthCookies).toHaveBeenCalledWith(res);
  });
});
