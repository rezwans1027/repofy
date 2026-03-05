import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { setupGitHubMocks, setupAuthMock } from "../helpers/integration-setup";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("GET /api/github/:username", () => {
  beforeEach(async () => {
    // Explicit reset — vi.stubGlobal mocks need manual reset despite config-level mockReset
    fetchMock.mockReset();
    await setupAuthMock(true);
  });

  it("returns 401 without auth", async () => {
    const app = getApp();
    const res = await request(app).get("/api/github/octocat");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns full user data for valid username", async () => {
    setupGitHubMocks(fetchMock);

    const app = getApp();
    const res = await request(app)
      .get("/api/github/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.username).toBe("octocat");
    expect(res.body.data.repositories).toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/users\/octocat$/), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/users/octocat/repos"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/users/octocat/events"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/graphql"), expect.anything());
  });

  it("returns 400 for invalid username", async () => {
    const app = getApp();
    const res = await request(app)
      .get("/api/github/-invalid")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Invalid");
  });

  it("returns 404 for nonexistent user", async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );

    const app = getApp();
    const res = await request(app)
      .get("/api/github/nonexistent")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
