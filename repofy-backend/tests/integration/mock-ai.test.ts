import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { setupAuthMock } from "../helpers/integration-setup";
import { getMockCreate } from "../helpers/mock-openai";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("openai");

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

  it("POST /api/analyze/:username returns mock analysis without calling OpenAI", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("Mock User (octocat)");
    const report = res.body.data.report;
    expect(report.candidateLevel).toBeDefined();
    expect(report.overallScore).toBeDefined();
    expect(report.recommendation).toBeDefined();
    expect(report.radarAxes).toHaveLength(6);
    expect(report.narrativeReport).toBeDefined();

    // Mock AI path uses buildMockGitHubData — no real GitHub fetch calls
    expect(fetchMock).not.toHaveBeenCalled();

    const mockCreate = await getMockCreate();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("POST /api/advice/:username returns mock v2 advice without calling OpenAI", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.adviceId).toBeDefined();

    // Mock AI path uses buildMockGitHubData — no real GitHub fetch calls
    expect(fetchMock).not.toHaveBeenCalled();

    const mockCreate = await getMockCreate();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
