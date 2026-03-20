import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/auth.service", () => ({
  initiateSignup: vi.fn(),
  verifySignup: vi.fn(),
  resendOtp: vi.fn(),
  loginWithPassword: vi.fn(),
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
vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      admin: { signOut: vi.fn().mockResolvedValue({}) },
    },
  })),
}));
vi.mock("../../../src/lib/cookie-utils", () => ({
  setAuthCookies: vi.fn(),
  clearAuthCookies: vi.fn(),
  extractAccessToken: vi.fn(),
  extractRefreshToken: vi.fn(),
}));

import {
  handleInitiateSignup,
  handleVerifySignup,
  handleResendOtp,
  handleLogin,
  handleRefresh,
  handleMe,
  handleLogout,
} from "../../../src/controllers/auth.controller";
import { initiateSignup, verifySignup, resendOtp, loginWithPassword, refreshSession, AuthError } from "../../../src/services/auth.service";
import { setAuthCookies, clearAuthCookies, extractAccessToken, extractRefreshToken } from "../../../src/lib/cookie-utils";

const mockInitiateSignup = initiateSignup as ReturnType<typeof vi.fn>;
const mockVerifySignup = verifySignup as ReturnType<typeof vi.fn>;
const mockResendOtp = resendOtp as ReturnType<typeof vi.fn>;
const mockLoginWithPassword = loginWithPassword as ReturnType<typeof vi.fn>;
const mockRefreshSession = refreshSession as ReturnType<typeof vi.fn>;
const mockSetAuthCookies = setAuthCookies as ReturnType<typeof vi.fn>;
const mockClearAuthCookies = clearAuthCookies as ReturnType<typeof vi.fn>;
const mockExtractAccessToken = extractAccessToken as ReturnType<typeof vi.fn>;
const mockExtractRefreshToken = extractRefreshToken as ReturnType<typeof vi.fn>;

describe("handleInitiateSignup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success when input is valid", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", displayName: "Alice" };
    mockInitiateSignup.mockResolvedValue({ message: "sent" });

    await handleInitiateSignup(req, res, next);

    expect(mockInitiateSignup).toHaveBeenCalledWith("a@b.com", "Alice");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { message: "sent" } });
  });

  it("returns 400 for missing email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { displayName: "Alice" };

    await handleInitiateSignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "A valid email is required." });
  });

  it("returns 400 for invalid email format", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "not-an-email", displayName: "Alice" };

    await handleInitiateSignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for missing displayName", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com" };

    await handleInitiateSignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Display name is required (max 100 characters).",
    });
  });

  it("propagates AuthError with correct status", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", displayName: "Alice" };
    mockInitiateSignup.mockRejectedValue(new AuthError("Failed to initiate signup", 500));

    await handleInitiateSignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Failed to initiate signup" });
  });

  it("returns 500 for unexpected errors", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", displayName: "Alice" };
    mockInitiateSignup.mockRejectedValue(new Error("boom"));

    await handleInitiateSignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "An unexpected error occurred." });
  });
});

describe("handleVerifySignup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success and sets cookies when session is returned", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "Pass1234" };
    mockVerifySignup.mockResolvedValue({
      user: { id: "u1", email: "a@b.com" },
      session: { access_token: "at", refresh_token: "rt" },
    });

    await handleVerifySignup(req, res, next);

    expect(mockVerifySignup).toHaveBeenCalledWith("a@b.com", "123456", "Pass1234");
    expect(mockSetAuthCookies).toHaveBeenCalledWith(res, "at", "rt");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: { id: "u1", email: "a@b.com" } },
    });
  });

  it("returns success without cookies when no session returned", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "Pass1234" };
    mockVerifySignup.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });

    await handleVerifySignup(req, res, next);

    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });

  it("returns 400 for missing email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { otp: "123456", password: "Pass1234" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "A valid email is required." });
  });

  it("returns 400 for invalid OTP format", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "12345", password: "Pass1234" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "A valid 6-digit verification code is required.",
    });
  });

  it("returns 400 for non-digit OTP", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "abcdef", password: "Pass1234" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when password is too short", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "Pass1" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Password must be 8–128 characters." });
  });

  it("returns 400 when password is too long", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "A1a" + "x".repeat(126) };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Password must be 8–128 characters." });
  });

  it("returns 400 when password missing lowercase", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "PASS1234" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Password must include at least 1 lowercase letter, 1 uppercase letter, and 1 number.",
    });
  });

  it("returns 400 when password missing uppercase", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "pass1234" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when password missing number", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "Password" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("propagates AuthError 409 for duplicate email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "Pass1234" };
    mockVerifySignup.mockRejectedValue(
      new AuthError("An account with this email already exists.", 409),
    );

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("propagates AuthError 400 for invalid OTP", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "Pass1234" };
    mockVerifySignup.mockRejectedValue(
      new AuthError("Invalid or expired verification code. Please try again.", 400),
    );

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("handleResendOtp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success for valid email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com" };
    mockResendOtp.mockResolvedValue({ message: "sent" });

    await handleResendOtp(req, res, next);

    expect(mockResendOtp).toHaveBeenCalledWith("a@b.com");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { message: "sent" } });
  });

  it("returns 400 for missing email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = {};

    await handleResendOtp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for invalid email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "bad" };

    await handleResendOtp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("propagates AuthError with correct status", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com" };
    mockResendOtp.mockRejectedValue(new AuthError("Failed to resend code. Please try again.", 500));

    await handleResendOtp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("handleLogin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user and sets cookies on success", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", password: "Pass1234" };
    mockLoginWithPassword.mockResolvedValue({
      session: { access_token: "at", refresh_token: "rt" },
      user: { id: "u1", email: "a@b.com" },
    });

    await handleLogin(req, res, next);

    expect(mockLoginWithPassword).toHaveBeenCalledWith("a@b.com", "Pass1234");
    expect(mockSetAuthCookies).toHaveBeenCalledWith(res, "at", "rt");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: { id: "u1", email: "a@b.com" } },
    });
  });

  it("returns 400 for missing email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { password: "Pass1234" };

    await handleLogin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for missing password", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com" };

    await handleLogin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 for invalid credentials", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", password: "wrong" };
    mockLoginWithPassword.mockRejectedValue(new AuthError("Invalid email or password", 401));

    await handleLogin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
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
  it("returns user id and email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "u1";
    (req as any).userEmail = "a@b.com";

    await handleMe(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: { id: "u1", email: "a@b.com" } },
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
