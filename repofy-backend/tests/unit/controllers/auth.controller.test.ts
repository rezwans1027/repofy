import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

// ── Hoisted mocks (available inside vi.mock factories) ──────────────

const mocks = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getGitHubUser: vi.fn(),
  getGitHubUserEmail: vi.fn(),
  refreshSession: vi.fn(),
  invalidateToken: vi.fn(),
  encryptToken: vi.fn((v: string) => `encrypted:${v}`),
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
  extractAccessToken: vi.fn(),
  extractRefreshToken: vi.fn(),
  // Supabase admin
  getUser: vi.fn(),
  adminSignOut: vi.fn().mockResolvedValue({}),
  getUserById: vi.fn(),
  updateUserById: vi.fn().mockResolvedValue({}),
  generateLink: vi.fn(),
  createUser: vi.fn(),
  upsert: vi.fn().mockResolvedValue({ error: null }),
  maybeSingle: vi.fn(),
  // Supabase auth (anon)
  verifyOtp: vi.fn(),
}));

vi.mock("../../../src/services/github-oauth.service", () => ({
  exchangeCodeForToken: mocks.exchangeCodeForToken,
  getGitHubUser: mocks.getGitHubUser,
  getGitHubUserEmail: mocks.getGitHubUserEmail,
}));

vi.mock("../../../src/services/auth.service", () => ({
  refreshSession: mocks.refreshSession,
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
  invalidateToken: mocks.invalidateToken,
}));

vi.mock("../../../src/lib/encryption", () => ({
  encryptToken: mocks.encryptToken,
  decryptToken: (v: string) => v.replace("encrypted:", ""),
  isEncrypted: (v: string) => v.startsWith("encrypted:"),
}));

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: () => ({
    auth: {
      getUser: mocks.getUser,
      admin: {
        signOut: mocks.adminSignOut,
        getUserById: mocks.getUserById,
        updateUserById: mocks.updateUserById,
        generateLink: mocks.generateLink,
        createUser: mocks.createUser,
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      upsert: mocks.upsert,
    }),
  }),
}));

vi.mock("../../../src/config/supabase-auth", () => ({
  getSupabaseAuth: () => ({
    auth: { verifyOtp: mocks.verifyOtp },
  }),
}));

vi.mock("../../../src/lib/cookie-utils", () => ({
  setAuthCookies: mocks.setAuthCookies,
  clearAuthCookies: mocks.clearAuthCookies,
  extractAccessToken: mocks.extractAccessToken,
  extractRefreshToken: mocks.extractRefreshToken,
}));

import {
  handleGitHubCallback,
  handleRefresh,
  handleMe,
  handleLogout,
} from "../../../src/controllers/auth.controller";
import { AuthError } from "../../../src/services/auth.service";

// Default GitHub user
const defaultGhUser = {
  id: 12345,
  login: "testuser",
  avatar_url: "https://example.com/avatar.png",
  name: "Test User",
  email: "test@example.com",
};

function defaultBody() {
  return {
    code: "auth-code",
    redirect_uri: "http://localhost:3000/callback",
    code_verifier: "verifier123",
  };
}

describe("handleGitHubCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: exchange succeeds
    mocks.exchangeCodeForToken.mockResolvedValue("gho_testtoken123");
    mocks.getGitHubUser.mockResolvedValue(defaultGhUser);

    // Default: no existing user in github_tokens
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    // Default: createUser succeeds (new user)
    mocks.createUser.mockResolvedValue({
      data: { user: { id: "u1", email: "test@example.com" } },
      error: null,
    });

    // Default: generateLink succeeds
    mocks.generateLink.mockResolvedValue({
      data: {
        user: { id: "u1", email: "test@example.com" },
        properties: { hashed_token: "magic-hash" },
      },
      error: null,
    });

    // Default: verifyOtp succeeds
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: { access_token: "new-at", refresh_token: "new-rt" },
        user: { id: "u1" },
      },
      error: null,
    });

    // Default: upsert + updateUserById succeed
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.updateUserById.mockResolvedValue({});
  });

  it("returns 400 when code is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = {};

    await handleGitHubCallback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when redirect_uri is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { code: "abc", code_verifier: "v" };

    await handleGitHubCallback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when code_verifier is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { code: "abc", redirect_uri: "http://localhost:3000/callback" };

    await handleGitHubCallback(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates new user and mints session on first login", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = defaultBody();

    await handleGitHubCallback(req, res, next);

    expect(mocks.exchangeCodeForToken).toHaveBeenCalledWith(
      "auth-code", "http://localhost:3000/callback", "verifier123",
    );
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "test@example.com",
      email_confirm: true,
      user_metadata: { display_name: "Test User" },
    });
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "test@example.com" });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "magic-hash", type: "magiclink" });
    expect(mocks.setAuthCookies).toHaveBeenCalledWith(res, "new-at", "new-rt");

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        user: {
          id: "u1",
          email: "test@example.com",
          display_name: "Test User",
          github_username: "testuser",
          avatar_url: "https://example.com/avatar.png",
        },
      },
    });
  });

  it("finds existing user by github_user_id", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { user_id: "existing-u1" }, error: null });
    mocks.getUserById.mockResolvedValue({
      data: { user: { email: "existing@example.com", user_metadata: {} } },
    });

    const { req, res, next } = createControllerMocks();
    (req as any).body = defaultBody();

    await handleGitHubCallback(req, res, next);

    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: "existing@example.com" });
    expect(mocks.setAuthCookies).toHaveBeenCalledWith(res, "new-at", "new-rt");
  });

  it("handles createUser conflict by resolving via generateLink", async () => {
    mocks.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    mocks.generateLink
      .mockResolvedValueOnce({
        data: { user: { id: "legacy-u1", email: "test@example.com" }, properties: { hashed_token: "hash-1" } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { user: { id: "legacy-u1", email: "test@example.com" }, properties: { hashed_token: "hash-2" } },
        error: null,
      });

    const { req, res, next } = createControllerMocks();
    (req as any).body = defaultBody();

    await handleGitHubCallback(req, res, next);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "legacy-u1" }),
      expect.any(Object),
    );
    expect(mocks.setAuthCookies).toHaveBeenCalled();
  });

  it("encrypts github token before upserting", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = defaultBody();

    await handleGitHubCallback(req, res, next);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ github_token: "encrypted:gho_testtoken123" }),
      expect.any(Object),
    );
  });

  it("writes github_user_id to upsert", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = defaultBody();

    await handleGitHubCallback(req, res, next);

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ github_user_id: 12345 }),
      expect.any(Object),
    );
  });

  it("fetches email from /user/emails when public email is null", async () => {
    mocks.getGitHubUser.mockResolvedValue({ ...defaultGhUser, email: null });
    mocks.getGitHubUserEmail.mockResolvedValue("private@example.com");
    mocks.createUser.mockResolvedValue({
      data: { user: { id: "u1", email: "private@example.com" } },
      error: null,
    });
    mocks.generateLink.mockResolvedValue({
      data: {
        user: { id: "u1", email: "private@example.com" },
        properties: { hashed_token: "magic-hash" },
      },
      error: null,
    });

    const { req, res, next } = createControllerMocks();
    (req as any).body = defaultBody();

    await handleGitHubCallback(req, res, next);

    expect(mocks.getGitHubUserEmail).toHaveBeenCalledWith("gho_testtoken123");
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "private@example.com" }),
    );
  });
});

describe("handleRefresh", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refreshes session and sets new cookies", async () => {
    const { req, res, next } = createControllerMocks();
    mocks.extractRefreshToken.mockReturnValue("rt");
    mocks.refreshSession.mockResolvedValue({
      session: { access_token: "new-at", refresh_token: "new-rt" },
      user: { id: "u1", email: "a@b.com" },
    });

    await handleRefresh(req, res, next);

    expect(mocks.setAuthCookies).toHaveBeenCalledWith(res, "new-at", "new-rt");
  });

  it("returns 401 when no refresh token", async () => {
    const { req, res, next } = createControllerMocks();
    mocks.extractRefreshToken.mockReturnValue(undefined);

    await handleRefresh(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("clears cookies on refresh failure", async () => {
    const { req, res, next } = createControllerMocks();
    mocks.extractRefreshToken.mockReturnValue("rt");
    mocks.refreshSession.mockRejectedValue(new AuthError("Session expired", 401));

    await handleRefresh(req, res, next);

    expect(mocks.clearAuthCookies).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("handleMe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // handleMe reads github_tokens then getUserById
    mocks.maybeSingle.mockResolvedValue({
      data: { github_username: "testuser", github_avatar_url: "https://example.com/avatar.png" },
      error: null,
    });
    mocks.getUserById.mockResolvedValue({
      data: { user: { user_metadata: { display_name: "Test User" } } },
    });
  });

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
    mocks.extractAccessToken.mockReturnValue(undefined);

    await handleLogout(req, res, next);

    expect(mocks.clearAuthCookies).toHaveBeenCalledWith(res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { message: "Logged out successfully." },
    });
  });

  it("invalidates token cache when token present", async () => {
    const { req, res, next } = createControllerMocks();
    mocks.extractAccessToken.mockReturnValue("some-token");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    await handleLogout(req, res, next);

    expect(mocks.invalidateToken).toHaveBeenCalledWith("some-token");
    expect(mocks.clearAuthCookies).toHaveBeenCalledWith(res);
  });
});
