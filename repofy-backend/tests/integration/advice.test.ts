import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { setupGitHubMocks, setupAuthMock, setupEngineAdviceMock } from "../helpers/integration-setup";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("POST /api/advice/:username", () => {
  beforeEach(() => {
    // Re-stub global fetch since vi.restoreAllMocks() in afterEach undoes vi.stubGlobal
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  it("returns 202 with jobId when authenticated", async () => {
    setupGitHubMocks(fetchMock);
    setupEngineAdviceMock(fetchMock);
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
  });

  it("returns 401 without auth", async () => {
    const app = getApp();
    const res = await request(app).post("/api/advice/octocat");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for invalid username", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/-invalid")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
