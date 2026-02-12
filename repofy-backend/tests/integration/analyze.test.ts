import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { createAIAnalysisResponse } from "../fixtures/ai";
import { setupGitHubMocks, setupAuthMock, setupOpenAIMock } from "../helpers/integration-setup";
import { sharedAuthEndpointTests } from "../helpers/authenticated-endpoint";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("openai");

vi.mock("../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

describe("POST /api/analyze/:username", () => {
  beforeEach(() => {
    // Explicit reset — vi.stubGlobal mocks need manual reset despite config-level mockReset
    fetchMock.mockReset();
  });

  it("returns 200 with report data when authenticated", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAIAnalysisResponse());

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    expect(res.body.data.report).toMatchObject({
      candidateLevel: "Mid-Level",
      overallScore: expect.any(Number),
      radarAxes: expect.any(Array),
      strengths: expect.any(Array),
      weaknesses: expect.any(Array),
    });
  });

  sharedAuthEndpointTests({
    basePath: "/api/analyze",
    routePattern: "/api/analyze/:username",
    fetchMock,
    importHandler: async () => {
      const { analyzeUser } = await import("../../src/controllers/analyze.controller");
      return analyzeUser;
    },
  });
});
