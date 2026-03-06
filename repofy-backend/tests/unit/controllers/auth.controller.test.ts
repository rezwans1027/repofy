import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/auth.service", () => ({
  initiateSignup: vi.fn(),
  verifySignup: vi.fn(),
  resendOtp: vi.fn(),
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

import {
  handleInitiateSignup,
  handleVerifySignup,
  handleResendOtp,
} from "../../../src/controllers/auth.controller";
import { initiateSignup, verifySignup, resendOtp, AuthError } from "../../../src/services/auth.service";

const mockInitiateSignup = initiateSignup as ReturnType<typeof vi.fn>;
const mockVerifySignup = verifySignup as ReturnType<typeof vi.fn>;
const mockResendOtp = resendOtp as ReturnType<typeof vi.fn>;

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

  it("returns success for valid input", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { email: "a@b.com", otp: "123456", password: "Pass1234" };
    mockVerifySignup.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });

    await handleVerifySignup(req, res, next);

    expect(mockVerifySignup).toHaveBeenCalledWith("a@b.com", "123456", "Pass1234");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: { id: "u1", email: "a@b.com" } },
    });
  });

  it("returns 400 for missing email", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).body = { otp: "123456", password: "Pass1234" };

    await handleVerifySignup(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "Email is required." });
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
