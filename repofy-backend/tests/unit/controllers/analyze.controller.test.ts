import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";
import { sharedControllerBehaviorTests } from "../../helpers/shared-controller-tests";

vi.mock("../../../src/services/github.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../src/services/github.service")>();
  return {
    ...original,
    fetchGitHubUserData: vi.fn(),
  };
});
vi.mock("../../../src/services/openai.service", () => ({
  generateScorerResponse: vi.fn(),
  generateNarrativeReport: vi.fn(),
}));
vi.mock("../../../src/services/scoring.service", () => ({
  computeScoring: vi.fn(),
}));
vi.mock("../../../src/services/analyze.service", () => ({
  buildReportData: vi.fn(),
}));
vi.mock("../../../src/services/cache.service", () => ({
  computeSnapshotHash: vi.fn().mockReturnValue("hash123"),
  buildCacheKey: vi.fn().mockReturnValue("cachekey123"),
  getCachedAnalysis: vi.fn().mockResolvedValue(null),
  setCachedAnalysis: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const mockEnv: Record<string, unknown> = {
  mockAi: false,
  openaiApiKey: "sk-test",
  openaiModel: "gpt-5.1",
};
vi.mock("../../../src/config/env", () => ({
  env: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => mockEnv[prop],
  }),
}));

import { analyzeUser } from "../../../src/controllers/analyze.controller";
import { fetchGitHubUserData, GitHubError } from "../../../src/services/github.service";
import { generateScorerResponse, generateNarrativeReport } from "../../../src/services/openai.service";
import { computeScoring } from "../../../src/services/scoring.service";
import { buildReportData } from "../../../src/services/analyze.service";

const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockGenerateScorerResponse = generateScorerResponse as ReturnType<typeof vi.fn>;
const mockGenerateNarrativeReport = generateNarrativeReport as ReturnType<typeof vi.fn>;
const mockComputeScoring = computeScoring as ReturnType<typeof vi.fn>;
const mockBuildReportData = buildReportData as ReturnType<typeof vi.fn>;

describe("analyzeUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.mockAi = false;
    mockEnv.openaiApiKey = "sk-test";
  });

  sharedControllerBehaviorTests({
    handler: analyzeUser,
    mockFetchGitHubUserData,
    mockEnv,
    GitHubError,
  });

  it("returns report on happy path", async () => {
    const githubData = { profile: { name: "Octocat" }, repoSnapshots: [], aggregateMetrics: { medianLatestPushDaysAgo: 30, hasCode: true } };
    const scorerResult = { radarAxes: [] };
    const scoringResult = { overallScore: 75 };
    const narrative = "Test narrative.";
    const report = { candidateLevel: "Senior" };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockGenerateScorerResponse.mockResolvedValue(scorerResult);
    mockComputeScoring.mockReturnValue(scoringResult);
    mockGenerateNarrativeReport.mockResolvedValue(narrative);
    mockBuildReportData.mockReturnValue(report);

    const { req, res, next } = createControllerMocks();

    await analyzeUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Octocat", report },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("uses mock AI when env.mockAi is true", async () => {
    mockEnv.mockAi = true;

    const { req, res, next } = createControllerMocks();

    await analyzeUser(req, res, next);

    expect(mockGenerateScorerResponse).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          analyzedName: "Mock User (octocat)",
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("handles generic error with 500", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("boom"));
    const { req, res, next } = createControllerMocks();

    await analyzeUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Analysis failed. Please try again.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
