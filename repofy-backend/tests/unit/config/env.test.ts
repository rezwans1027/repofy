import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Prevent dotenv from loading a local .env file during tests
vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

const ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "MOCK_AI",
  "NODE_ENV",
  "PORT",
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

  it("allows missing OPENAI_API_KEY when MOCK_AI is enabled", async () => {
    process.env.MOCK_AI = "true";
    process.env.NODE_ENV = "test";
    delete process.env.OPENAI_API_KEY;

    const { env } = await import("../../../src/config/env");

    expect(env.openaiApiKey).toBe("");
    expect(env.mockAi).toBe(true);
  });

  it("requires OPENAI_API_KEY when MOCK_AI is disabled", async () => {
    process.env.MOCK_AI = "false";
    delete process.env.OPENAI_API_KEY;

    await expect(import("../../../src/config/env")).rejects.toThrow(
      "Missing required environment variable: OPENAI_API_KEY",
    );
  });

  it("disables MOCK_AI in production even when set", async () => {
    process.env.MOCK_AI = "true";
    process.env.NODE_ENV = "production";
    process.env.OPENAI_API_KEY = "sk-real-key";

    const { env } = await import("../../../src/config/env");

    expect(env.mockAi).toBe(false);
  });

  it("parses PORT from env", async () => {
    process.env.PORT = "4000";

    const { env } = await import("../../../src/config/env");

    expect(env.port).toBe(4000);
  });

  it("defaults port to 3003", async () => {
    delete process.env.PORT;

    const { env } = await import("../../../src/config/env");

    expect(env.port).toBe(3003);
  });
});
