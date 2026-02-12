import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

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
vi.mock("../../../src/config/env", () => ({
  env: { mockAi: false, openaiApiKey: "sk-test" },
}));

import { analyzeUser } from "../../../src/controllers/analyze.controller";
import { fetchGitHubUserData, GitHubError } from "../../../src/services/github.service";
import { generateAnalysis } from "../../../src/services/openai.service";
import { buildReportData } from "../../../src/services/analyze.service";
import { env } from "../../../src/config/env";

const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockGenerateAnalysis = generateAnalysis as ReturnType<typeof vi.fn>;
const mockBuildReportData = buildReportData as ReturnType<typeof vi.fn>;

describe("analyzeUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).mockAi = false;
    (env as any).openaiApiKey = "sk-test";
  });

  it("returns 400 for invalid username", async () => {
    const { req, res } = createControllerMocks({ username: "-invalid" });

    await analyzeUser(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid GitHub username format",
    });
  });

  it("returns report on happy path", async () => {
    const githubData = { profile: { name: "Octocat" } };
    const aiResult = { overallScore: 75 };
    const report = { candidateLevel: "Senior" };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockGenerateAnalysis.mockResolvedValue(aiResult);
    mockBuildReportData.mockReturnValue(report);

    const { req, res } = createControllerMocks();

    await analyzeUser(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Octocat", report },
    });
  });

  it("uses mock AI when env.mockAi is true", async () => {
    (env as any).mockAi = true;
    const githubData = { profile: { name: "Octocat" } };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockBuildReportData.mockReturnValue({ mock: true });

    const { req, res } = createControllerMocks();

    await analyzeUser(req, res, vi.fn());

    expect(mockGenerateAnalysis).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("returns 500 when openaiApiKey is missing", async () => {
    (env as any).openaiApiKey = "";

    const { req, res } = createControllerMocks();

    await analyzeUser(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "OpenAI API key is not configured",
    });
  });

  it("returns early when signal is aborted", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("aborted"));
    const { req, res } = createControllerMocks();
    (req as any).signal = { aborted: true };

    await analyzeUser(req, res, vi.fn());

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("handles GitHubError with correct status", async () => {
    mockFetchGitHubUserData.mockRejectedValue(
      new GitHubError("User not found", 404),
    );
    const { req, res } = createControllerMocks();

    await analyzeUser(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "User not found",
    });
  });

  it("handles generic error with 500", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("boom"));
    const { req, res } = createControllerMocks();

    await analyzeUser(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Analysis failed. Please try again.",
    });
  });
});
