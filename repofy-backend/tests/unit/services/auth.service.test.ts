import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase-auth", () => ({
  getSupabaseAuth: vi.fn(),
}));

import { refreshSession, AuthError } from "../../../src/services/auth.service";
import { getSupabaseAuth } from "../../../src/config/supabase-auth";

const mockGetSupabaseAuth = getSupabaseAuth as ReturnType<typeof vi.fn>;

describe("refreshSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns session and user on success", async () => {
    mockGetSupabaseAuth.mockReturnValue({
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: {
            session: { access_token: "new-at", refresh_token: "new-rt" },
            user: { id: "u1", email: "a@b.com", user_metadata: { display_name: "Alice" } },
          },
          error: null,
        }),
      },
    });

    const result = await refreshSession("old-rt");

    expect(result.session.access_token).toBe("new-at");
    expect(result.session.refresh_token).toBe("new-rt");
    expect(result.user.id).toBe("u1");
    expect(result.user.email).toBe("a@b.com");
    expect(result.user.display_name).toBe("Alice");
  });

  it("throws AuthError when refresh fails", async () => {
    mockGetSupabaseAuth.mockReturnValue({
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new Error("token revoked"),
        }),
      },
    });

    await expect(refreshSession("bad-rt")).rejects.toThrow(AuthError);
    await expect(refreshSession("bad-rt")).rejects.toThrow("Session expired");
  });
});
