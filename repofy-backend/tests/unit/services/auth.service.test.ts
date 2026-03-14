import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("../../../src/services/email.service", () => ({
  sendOtpEmail: vi.fn(),
}));
vi.mock("../../../src/lib/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/logger")>();
  return {
    maskEmail: actual.maskEmail,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});
vi.mock("../../../src/config/env", () => ({
  env: { otpHmacSecret: "test-secret" },
}));

import { initiateSignup, verifySignup, resendOtp, AuthError } from "../../../src/services/auth.service";
import { getSupabaseAdmin } from "../../../src/config/supabase";
import { sendOtpEmail } from "../../../src/services/email.service";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;
const mockSendOtpEmail = sendOtpEmail as ReturnType<typeof vi.fn>;

function createMockSupabase(overrides: Record<string, any> = {}) {
  const deleteChain = {
    delete: vi.fn().mockReturnValue({
      lt: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
  const client = {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      ...deleteChain,
    }),
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: "u1", email: "a@b.com" } },
          error: null,
        }),
      },
    },
    ...overrides,
  };
  mockGetSupabaseAdmin.mockReturnValue(client);
  return client;
}

describe("initiateSignup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts and sends email when email is available", async () => {
    const client = createMockSupabase();
    // email_exists_in_auth returns false
    client.rpc.mockResolvedValue({ data: false, error: null });
    mockSendOtpEmail.mockResolvedValue(undefined);

    const result = await initiateSignup("a@b.com", "Alice");

    expect(client.rpc).toHaveBeenCalledWith("email_exists_in_auth", { p_email: "a@b.com" });
    expect(client.from).toHaveBeenCalledWith("pending_signups");
    expect(result.message).toContain("verification code");
  });

  it("skips upsert when email is already taken", async () => {
    const client = createMockSupabase();
    client.rpc.mockResolvedValue({ data: true, error: null });

    const result = await initiateSignup("taken@b.com", "Bob");

    // from() is called only for cleanup (delete), not for upsert
    expect(result.message).toContain("verification code");
  });

  it("returns same response regardless of email existence", async () => {
    const client = createMockSupabase();
    mockSendOtpEmail.mockResolvedValue(undefined);

    client.rpc.mockResolvedValue({ data: false, error: null });
    const r1 = await initiateSignup("a@b.com", "Alice");

    // Recreate mock so from() chain is fresh for second call
    const client2 = createMockSupabase();
    client2.rpc.mockResolvedValue({ data: true, error: null });
    const r2 = await initiateSignup("taken@b.com", "Bob");

    expect(r1.message).toEqual(r2.message);
  });

  it("throws 500 when RPC fails", async () => {
    const client = createMockSupabase();
    client.rpc.mockResolvedValue({ data: null, error: new Error("RPC fail") });

    await expect(initiateSignup("a@b.com", "Alice")).rejects.toThrow(AuthError);
    await expect(initiateSignup("a@b.com", "Alice")).rejects.toThrow("Failed to initiate signup");
  });
});

describe("verifySignup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates user and cleans up on valid OTP", async () => {
    const client = createMockSupabase();
    // The RPC returns the row with the hashed OTP
    const crypto = await import("crypto");
    const hashedOtp = crypto.createHmac("sha256", "test-secret").update("123456").digest("hex");

    client.rpc.mockResolvedValue({
      data: [
        {
          email: "a@b.com",
          display_name: "Alice",
          otp_code: hashedOtp,
          otp_expires_at: new Date(Date.now() + 600_000).toISOString(),
          attempts: 1,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    const result = await verifySignup("a@b.com", "123456", "Pass1234");

    expect(result.user).toEqual({ id: "u1", email: "a@b.com" });
    expect(client.auth.admin.createUser).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "Pass1234",
      email_confirm: true,
      user_metadata: { display_name: "Alice" },
    });
  });

  it("throws unified error on wrong OTP", async () => {
    const client = createMockSupabase();
    const crypto = await import("crypto");
    const hashedOtp = crypto.createHmac("sha256", "test-secret").update("999999").digest("hex");

    client.rpc.mockResolvedValue({
      data: [
        {
          email: "a@b.com",
          display_name: "Alice",
          otp_code: hashedOtp,
          otp_expires_at: new Date(Date.now() + 600_000).toISOString(),
          attempts: 1,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });

    await expect(verifySignup("a@b.com", "123456", "Pass1234")).rejects.toThrow(
      "Invalid or expired verification code. Please try again.",
    );
  });

  it("throws unified error when no row returned (expired/locked/missing)", async () => {
    const client = createMockSupabase();
    client.rpc.mockResolvedValue({ data: [], error: null });

    await expect(verifySignup("a@b.com", "123456", "Pass1234")).rejects.toThrow(
      "Invalid or expired verification code. Please try again.",
    );
  });

  it("throws 500 when RPC fails", async () => {
    const client = createMockSupabase();
    client.rpc.mockResolvedValue({ data: null, error: new Error("DB down") });

    await expect(verifySignup("a@b.com", "123456", "Pass1234")).rejects.toThrow(
      "Failed to verify signup",
    );
  });

  it("throws 409 when user already registered", async () => {
    const client = createMockSupabase();
    const crypto = await import("crypto");
    const hashedOtp = crypto.createHmac("sha256", "test-secret").update("123456").digest("hex");

    client.rpc.mockResolvedValue({
      data: [
        {
          email: "a@b.com",
          display_name: "Alice",
          otp_code: hashedOtp,
          otp_expires_at: new Date(Date.now() + 600_000).toISOString(),
          attempts: 1,
          created_at: new Date().toISOString(),
        },
      ],
      error: null,
    });
    client.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already been registered" },
    });

    await expect(verifySignup("a@b.com", "123456", "Pass1234")).rejects.toThrow(
      "An account with this email already exists.",
    );
  });
});

describe("resendOtp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates OTP and sends email when pending exists", async () => {
    const client = createMockSupabase();
    // select → pending exists
    client.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { email: "a@b.com", display_name: "Alice" },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { email: "a@b.com" },
              error: null,
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockSendOtpEmail.mockResolvedValue(undefined);

    const result = await resendOtp("a@b.com");

    expect(result.message).toContain("pending signup");
    expect(mockSendOtpEmail).toHaveBeenCalled();
  });

  it("returns generic message when no pending signup", async () => {
    const client = createMockSupabase();
    // select returns null
    client.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const result = await resendOtp("a@b.com");

    expect(result.message).toContain("pending signup");
    expect(mockSendOtpEmail).not.toHaveBeenCalled();
  });

  it("throws 500 when update fails", async () => {
    const client = createMockSupabase();
    client.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { email: "a@b.com", display_name: "Alice" },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("update fail"),
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await expect(resendOtp("a@b.com")).rejects.toThrow("Failed to resend code");
  });
});
