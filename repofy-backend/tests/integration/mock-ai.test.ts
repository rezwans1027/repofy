import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { setupGitHubMocks, setupAuthMock } from "../helpers/integration-setup";
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
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);

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
    });

    const mockCreate = await getMockCreate();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("POST /api/advice/:username returns mock advice without calling OpenAI", async () => {
    setupGitHubMocks(fetchMock);
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/advice/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    expect(res.body.data.advice).toMatchObject({
      summary: expect.any(String),
      projectIdeas: expect.any(Array),
      skillsToLearn: expect.any(Array),
      actionPlan: expect.any(Array),
    });

    const mockCreate = await getMockCreate();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
