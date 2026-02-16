import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateClient = vi.fn(() => ({ fake: "client" }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

const mockEnv: Record<string, string | undefined> = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "test-service-role-key",
};

vi.mock("../../../src/config/env", () => ({
  env: new Proxy({} as Record<string, string | undefined>, {
    get: (_target, prop: string) => mockEnv[prop],
  }),
}));

describe("getSupabaseAdmin", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateClient.mockClear();
    mockEnv.supabaseUrl = "https://example.supabase.co";
    mockEnv.supabaseServiceRoleKey = "test-service-role-key";
  });

  it("creates a Supabase client on first call", async () => {
    const { getSupabaseAdmin } = await import("../../../src/config/supabase");
    const client = getSupabaseAdmin();

    expect(mockCreateClient).toHaveBeenCalledOnce();
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-service-role-key",
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );
    expect(client).toEqual({ fake: "client" });
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    const { getSupabaseAdmin } = await import("../../../src/config/supabase");
    const first = getSupabaseAdmin();
    const second = getSupabaseAdmin();

    expect(first).toBe(second);
    expect(mockCreateClient).toHaveBeenCalledOnce();
  });

  it("throws when SUPABASE_URL is missing", async () => {
    mockEnv.supabaseUrl = undefined;
    const { getSupabaseAdmin } = await import("../../../src/config/supabase");

    expect(() => getSupabaseAdmin()).toThrow("Missing SUPABASE_URL");
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    mockEnv.supabaseServiceRoleKey = undefined;
    const { getSupabaseAdmin } = await import("../../../src/config/supabase");

    expect(() => getSupabaseAdmin()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });
});
