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
  generateAnalysis: vi.fn(),
}));
vi.mock("../../../src/services/analyze.service", () => ({
  buildReportData: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
const mockEnv: Record<string, unknown> = {
  mockAi: false,
  openaiApiKey: "sk-test",
};
vi.mock("../../../src/config/env", () => ({
  env: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => mockEnv[prop],
  }),
}));

import { analyzeUser } from "../../../src/controllers/analyze.controller";
import { fetchGitHubUserData, GitHubError } from "../../../src/services/github.service";
import { generateAnalysis } from "../../../src/services/openai.service";
import { buildReportData } from "../../../src/services/analyze.service";

const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockGenerateAnalysis = generateAnalysis as ReturnType<typeof vi.fn>;
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
    const githubData = { profile: { name: "Octocat" } };
    const aiResult = { overallScore: 75 };
    const report = { candidateLevel: "Senior" };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockGenerateAnalysis.mockResolvedValue(aiResult);
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
    const githubData = { profile: { name: "Octocat" } };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockBuildReportData.mockReturnValue({ mock: true });

    const { req, res, next } = createControllerMocks();

    await analyzeUser(req, res, next);

    expect(mockGenerateAnalysis).not.toHaveBeenCalled();
    expect(mockBuildReportData).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Mock User (octocat)", report: { mock: true } },
    });
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
