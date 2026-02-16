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
    // Re-stub global fetch since vi.restoreAllMocks() in afterEach undoes vi.stubGlobal
    vi.stubGlobal("fetch", fetchMock);
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
    const report = res.body.data.report;
    expect(report.candidateLevel).toBe("Mid-Level");
    expect(report.overallScore).toBe(62);
    expect(report.recommendation).toBe("Hire");
    expect(typeof report.summary).toBe("string");
    expect(report.summary.length).toBeGreaterThan(0);

    expect(report.radarAxes).toHaveLength(6);
    for (const axis of report.radarAxes) {
      expect(axis).toMatchObject({ axis: expect.any(String), value: expect.any(Number) });
    }

    expect(report.strengths.length).toBeGreaterThan(0);
    for (const s of report.strengths) {
      expect(s).toMatchObject({ text: expect.any(String), evidence: expect.any(String) });
    }

    expect(report.weaknesses.length).toBeGreaterThan(0);
    for (const w of report.weaknesses) {
      expect(w).toMatchObject({ text: expect.any(String), evidence: expect.any(String) });
    }

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/users/octocat/repos"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/users/octocat/events"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/graphql"), expect.anything());
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

  it("returns 500 when openaiApiKey is not configured and mockAi is false", async () => {
    const envModule = await import("../../src/config/env");
    const originalMockAi = envModule.env.mockAi;
    const originalKey = envModule.env.openaiApiKey;

    Object.defineProperty(envModule.env, "mockAi", { value: false, writable: true, configurable: true });
    Object.defineProperty(envModule.env, "openaiApiKey", { value: "", writable: true, configurable: true });

    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);

    // Use a dedicated app without aiRateLimit to avoid rate limit exhaustion from prior tests
    const express = (await import("express")).default;
    const { requireAuth } = await import("../../src/middleware/auth");
    const { asyncHandler } = await import("../../src/middleware/asyncHandler");
    const { errorHandler } = await import("../../src/middleware/errorHandler");
    const { analyzeUser } = await import("../../src/controllers/analyze.controller");

    const app = express();
    app.use(express.json());
    app.post("/api/analyze/:username", requireAuth, asyncHandler(analyzeUser));
    app.use(errorHandler);

    const res = await request(app)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("OpenAI API key is not configured");

    Object.defineProperty(envModule.env, "mockAi", { value: originalMockAi, configurable: true });
    Object.defineProperty(envModule.env, "openaiApiKey", { value: originalKey, configurable: true });
  });
});
