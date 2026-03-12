import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { getApp } from "../helpers/supertest-app";
import { setupGitHubMocks, setupAuthMock, setupEngineAnalyzeMock } from "../helpers/integration-setup";
import { sharedAuthEndpointTests } from "../helpers/authenticated-endpoint";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

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
    setupEngineAnalyzeMock(fetchMock);
    await setupAuthMock(true);

    const app = getApp();
    const res = await request(app)
      .post("/api/analyze/octocat")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analyzedName).toBe("The Octocat");
    const report = res.body.data.report;
    expect(report.candidateLevel).toBeDefined();
    expect(report.overallScore).toBeDefined();
    expect(report.recommendation).toBeDefined();
    expect(typeof report.narrativeReport).toBe("string");
    expect(report.narrativeReport.length).toBeGreaterThan(0);

    // Should be 3-paragraph prose from engine response
    const paragraphs = report.narrativeReport.split("\n\n");
    expect(paragraphs).toHaveLength(3);
    expect(report.narrativeReport).toContain("A capable developer");

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

    // Verify new metadata fields
    expect(report.riskSignals).toBeDefined();
    expect(report.confidenceScore).toBeDefined();
    expect(report.rubricVersion).toBe("v1.1");
    expect(report.dataQualityWarnings).toBeDefined();

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
});
