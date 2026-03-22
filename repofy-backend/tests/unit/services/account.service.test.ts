import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { exportUserData, deleteUserAccount } from "../../../src/services/account.service";
import { getSupabaseAdmin } from "../../../src/config/supabase";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;

function createChainable(resolvedValue: unknown) {
  // The terminal object is both thenable (for array queries) and has .maybeSingle() (for single-row queries)
  const terminal: Record<string, any> = {
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject),
  };
  const chain: Record<string, any> = {
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(terminal) }),
  };
  return chain;
}

function mockSuccessfulExport() {
  const client = {
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: {
            user: {
              email: "test@example.com",
              user_metadata: { display_name: "Test User" },
              created_at: "2024-01-01T00:00:00Z",
            },
          },
          error: null,
        }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "github_tokens") {
        return createChainable({
          data: { github_username: "testuser", github_avatar_url: "https://avatar.url", updated_at: "2024-06-01T00:00:00Z" },
          error: null,
        });
      }

      if (table === "credit_wallets") {
        return createChainable({
          data: { growth_balance: 3, eval_balance: 0 },
          error: null,
        });
      }

      // Array-returning tables (advice, advice_jobs, reports)
      return createChainable({ data: [], error: null });
    }),
  };
  mockGetSupabaseAdmin.mockReturnValue(client);
  return client;
}

describe("account.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exportUserData", () => {
    it("returns correct shape with all user data", async () => {
      mockSuccessfulExport();

      const result = await exportUserData("user-1");

      expect(result.account.email).toBe("test@example.com");
      expect(result.account.metadata).toEqual({ display_name: "Test User" });
      expect(result.account.created_at).toBe("2024-01-01T00:00:00Z");
      expect(result.github).toEqual({
        username: "testuser",
        avatar_url: "https://avatar.url",
        updated_at: "2024-06-01T00:00:00Z",
      });
      expect(result.credits).toEqual({ growth_balance: 3, eval_balance: 0 });
      expect(result.exported_at).toBeDefined();
    });

    it("never exposes github_token in export", async () => {
      mockSuccessfulExport();

      const result = await exportUserData("user-1");

      const json = JSON.stringify(result);
      expect(json).not.toContain("github_token");
      expect(json).not.toContain("token");
    });

    it("throws when auth user fetch fails", async () => {
      const client = {
        auth: {
          admin: {
            getUserById: vi.fn().mockResolvedValue({
              data: { user: null },
              error: new Error("Not found"),
            }),
          },
        },
        from: vi.fn(),
      };
      mockGetSupabaseAdmin.mockReturnValue(client);

      await expect(exportUserData("user-1")).rejects.toThrow("Failed to fetch user account");
    });
  });

  describe("deleteUserAccount", () => {
    it("calls admin.deleteUser with userId", async () => {
      const client = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockResolvedValue({ error: null }),
          },
        },
      };
      mockGetSupabaseAdmin.mockReturnValue(client);

      await deleteUserAccount("user-1");

      expect(client.auth.admin.deleteUser).toHaveBeenCalledWith("user-1");
    });

    it("throws on deletion failure", async () => {
      const client = {
        auth: {
          admin: {
            deleteUser: vi.fn().mockResolvedValue({ error: new Error("Cannot delete") }),
          },
        },
      };
      mockGetSupabaseAdmin.mockReturnValue(client);

      await expect(deleteUserAccount("user-1")).rejects.toThrow("Failed to delete user account");
    });
  });
});
