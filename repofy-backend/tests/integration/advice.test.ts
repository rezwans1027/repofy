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

  it("returns 200 with adviceId when authenticated", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);
    await setupOpenAIMock(() => createAdviceV2Raw());

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.adviceId).toBeDefined();

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
