import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { createAIAdviceResponse } from "../fixtures/ai";
import { setupGitHubMocks, setupAuthMock, setupOpenAIMock } from "../helpers/integration-setup";
import { sharedAuthEndpointTests } from "../helpers/authenticated-endpoint";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("openai");

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("POST /api/advice/:username", () => {
  beforeEach(() => {
    // Explicit reset — vi.stubGlobal mocks need manual reset despite config-level mockReset
    fetchMock.mockReset();
  });

  it("returns 200 with advice data when authenticated", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAIAdviceResponse());

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    expect(res.body.data.advice).toMatchObject({
      summary: "Focus on testing and documentation.",
      projectIdeas: expect.any(Array),
      skillsToLearn: expect.any(Array),
      actionPlan: expect.any(Array),
    });
  });

  sharedAuthEndpointTests({
    basePath: "/api/advice",
    routePattern: "/api/advice/:username",
    fetchMock,
    importHandler: async () => {
      const { adviseUser } = await import("../../src/controllers/advice.controller");
      return adviseUser;
    },
  });
});
