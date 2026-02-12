import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/github.service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../src/services/github.service")>();
  return {
    ...original,
    fetchGitHubUserData: vi.fn(),
  };
});
vi.mock("../../../src/services/advice.service", () => ({
  generateAdvice: vi.fn(),
}));
vi.mock("../../../src/services/advice-builder.service", () => ({
  buildAdviceData: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/config/env", () => ({
  env: { mockAi: false, openaiApiKey: "sk-test" },
}));

import { adviseUser } from "../../../src/controllers/advice.controller";
import { fetchGitHubUserData, GitHubError } from "../../../src/services/github.service";
import { generateAdvice } from "../../../src/services/advice.service";
import { buildAdviceData } from "../../../src/services/advice-builder.service";
import { env } from "../../../src/config/env";

const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockGenerateAdvice = generateAdvice as ReturnType<typeof vi.fn>;
const mockBuildAdviceData = buildAdviceData as ReturnType<typeof vi.fn>;

describe("adviseUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).mockAi = false;
    (env as any).openaiApiKey = "sk-test";
  });

  it("returns 400 for invalid username", async () => {
    const { req, res } = createControllerMocks({ username: "-invalid" });

    await adviseUser(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid GitHub username format",
    });
  });

  it("returns advice on happy path", async () => {
    const githubData = { profile: { name: "Octocat" } };
    const aiResult = { summary: "Good profile" };
    const advice = { summary: "Good profile" };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockGenerateAdvice.mockResolvedValue(aiResult);
    mockBuildAdviceData.mockReturnValue(advice);

    const { req, res } = createControllerMocks();

    await adviseUser(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Octocat", advice },
    });
  });

  it("uses mock AI when env.mockAi is true", async () => {
    (env as any).mockAi = true;
    const githubData = { profile: { name: "Octocat" } };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockBuildAdviceData.mockReturnValue({ mock: true });

    const { req, res } = createControllerMocks();

    await adviseUser(req, res, vi.fn());

    expect(mockGenerateAdvice).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("returns 500 when openaiApiKey is missing", async () => {
    (env as any).openaiApiKey = "";

    const { req, res } = createControllerMocks();

    await adviseUser(req, res, vi.fn());

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

    await adviseUser(req, res, vi.fn());

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("handles GitHubError with correct status", async () => {
    mockFetchGitHubUserData.mockRejectedValue(
      new GitHubError("User not found", 404),
    );
    const { req, res } = createControllerMocks();

    await adviseUser(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "User not found",
    });
  });

  it("handles generic error with 500", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("boom"));
    const { req, res } = createControllerMocks();

    await adviseUser(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Advice generation failed. Please try again.",
    });
  });
});
