import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { setupAuthMock } from "../helpers/integration-setup";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../../src/config/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/config/env")>();
  return {
    env: {
      ...original.env,
      mockAi: true,
    },
  };
});

describe("MOCK_AI mode", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("POST /api/advice/:username returns mock v2 advice without calling engine", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.adviceId).toBeDefined();

    // Mock AI path uses buildMockGitHubData — no real GitHub or engine fetch calls
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
