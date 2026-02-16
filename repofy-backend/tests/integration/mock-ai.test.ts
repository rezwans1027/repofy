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
    expect(report.candidateLevel).toBe("Mid-Level");
    expect(report.overallScore).toBe(62);
    expect(report.recommendation).toBe("Hire");
    expect(report.radarAxes).toHaveLength(6);

    // Mock AI path uses buildMockGitHubData — no real GitHub fetch calls
    expect(fetchMock).not.toHaveBeenCalled();

    const mockCreate = await getMockCreate();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("POST /api/advice/:username returns mock advice without calling OpenAI", async () => {
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("Mock User (octocat)");
    const advice = res.body.data.advice;
    expect(advice.summary).toBe("Focus on testing and documentation to level up your profile.");
    expect(advice.projectIdeas).toHaveLength(3);
    expect(advice.skillsToLearn).toHaveLength(3);
    expect(advice.actionPlan).toHaveLength(3);

    // Mock AI path uses buildMockGitHubData — no real GitHub fetch calls
    expect(fetchMock).not.toHaveBeenCalled();

    const mockCreate = await getMockCreate();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
