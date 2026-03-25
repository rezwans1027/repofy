import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Prevent dotenv from loading a local .env file during tests
vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "FEEDBACK_NOTIFICATION_EMAIL",
  "ADMIN_SECRET",
  "ENGINE_INTERNAL_KEY",
  "ENGINE_URL",
  "MOCK_AI",
  "NODE_ENV",
  "PORT",
  "CORS_ORIGIN",
] as const;

describe("env config", () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const val = saved.get(key);
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    // ENGINE_INTERNAL_KEY is required when MOCK_AI is off
    process.env.ENGINE_INTERNAL_KEY ??= "test-engine-key";
    vi.resetModules();
  });

  it("throws when a required env var is missing", async () => {
    delete process.env.SUPABASE_URL;

    await expect(import("../../../src/config/env")).rejects.toThrow(
      "Missing required environment variable: SUPABASE_URL",
    );
  });

  it("throws when env var contains a placeholder value", async () => {
    process.env.SUPABASE_URL = "<your-supabase-url>";

    await expect(import("../../../src/config/env")).rejects.toThrow(
      "contains a placeholder value",
    );
  });

  it("disables MOCK_AI in production even when set", async () => {
    process.env.MOCK_AI = "true";
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://example.com";
    process.env.ENGINE_URL = "https://engine.example.com";

    const { env } = await import("../../../src/config/env");

    expect(env.mockAi).toBe(false);
  });

  it("parses PORT from env", async () => {
    process.env.PORT = "4000";

    const { env } = await import("../../../src/config/env");

    expect(env.port).toBe(4000);
  });

  it("defaults port to 3001", async () => {
    delete process.env.PORT;

    const { env } = await import("../../../src/config/env");

    expect(env.port).toBe(3001);
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(import("../../../src/config/env")).rejects.toThrow(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it("throws when FEEDBACK_NOTIFICATION_EMAIL is missing", async () => {
    delete process.env.FEEDBACK_NOTIFICATION_EMAIL;

    await expect(import("../../../src/config/env")).rejects.toThrow(
      "Missing required environment variable: FEEDBACK_NOTIFICATION_EMAIL",
    );
  });

  it("handles non-numeric PORT by returning NaN", async () => {
    process.env.PORT = "abc";

    const { env } = await import("../../../src/config/env");

    expect(env.port).toBeNaN();
  });
});
