import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { createAdviceV2Raw } from "../fixtures/ai";
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
    // Re-stub global fetch since vi.restoreAllMocks() in afterEach undoes vi.stubGlobal
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  it("returns 200 with v2 advice data when authenticated", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAdviceV2Raw());

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    const advice = res.body.data.advice;

    // V2 shape validation
    expect(advice.schemaVersion).toBe("v2");
    expect(advice.generationWarnings).toEqual(expect.any(Array));
    expect(advice.summary).toBeDefined();

    // Trajectory
    expect(advice.trajectory).toBeDefined();
    expect(advice.trajectory.currentEstimate).toBeDefined();
    expect(advice.trajectory.confidence).toBeDefined();
    expect(advice.trajectory.calibration).toBeDefined();

    // Build roadmap
    expect(advice.buildRoadmap).toHaveLength(3);
    for (const build of advice.buildRoadmap) {
      expect(build).toMatchObject({
        title: expect.any(String),
        techStack: expect.any(Array),
        difficulty: expect.any(String),
        estimatedWeeks: expect.any(Number),
        milestones: expect.any(Array),
      });
    }
    const weeksSum = advice.buildRoadmap.reduce((s: number, b: { estimatedWeeks: number }) => s + b.estimatedWeeks, 0);
    expect(weeksSum).toBeLessThanOrEqual(12);

    // Weekly roadmap
    expect(advice.weeklyRoadmap).toHaveLength(12);
    const buildTitles = advice.buildRoadmap.map((b: { title: string }) => b.title);
    for (const week of advice.weeklyRoadmap) {
      expect(week.week).toBeGreaterThanOrEqual(1);
      expect(week.week).toBeLessThanOrEqual(12);
      expect(buildTitles).toContain(week.activeBuildTitle);
    }

    // Skill roadmap
    expect(advice.skillRoadmap.length).toBeGreaterThan(0);
    for (const skill of advice.skillRoadmap) {
      expect(skill).toMatchObject({
        skill: expect.any(String),
        reason: expect.any(String),
        priority: expect.any(String),
      });
    }

    // Success metrics
    expect(advice.successMetrics).toEqual(expect.any(Array));

    // GitHub API calls
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/users/octocat/repos"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/users/octocat/events"), expect.anything());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/graphql"), expect.anything());
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
    const { adviseUser } = await import("../../src/controllers/advice.controller");

    const app = express();
    app.use(express.json());
    app.post("/api/advice/:username", requireAuth, asyncHandler(adviseUser));
    app.use(errorHandler);

    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe("OpenAI API key is not configured");

    Object.defineProperty(envModule.env, "mockAi", { value: originalMockAi, configurable: true });
    Object.defineProperty(envModule.env, "openaiApiKey", { value: originalKey, configurable: true });
  });
});
