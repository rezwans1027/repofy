import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { setupGitHubMocks } from "../helpers/integration-setup";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("GET /api/github/:username", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns full user data for valid username", async () => {
    setupGitHubMocks(fetchMock);

    const app = getApp();
    const res = await request(app).get("/api/github/octocat");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.username).toBe("octocat");
    expect(res.body.data.repositories).toHaveLength(1);
  });

  it("returns 400 for invalid username", async () => {
    const app = getApp();
    const res = await request(app).get("/api/github/-invalid");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Invalid");
  });

  it("returns 404 for nonexistent user", async () => {
    fetchMock.mockReturnValue(
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }),
    );

    const app = getApp();
    const res = await request(app).get("/api/github/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
