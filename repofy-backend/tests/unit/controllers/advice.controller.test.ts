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
vi.mock("../../../src/services/advice.service", () => ({
  generateAdvice: vi.fn(),
}));
vi.mock("../../../src/services/advice-builder.service", () => ({
  buildAdviceData: vi.fn(),
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

import { adviseUser } from "../../../src/controllers/advice.controller";
import { fetchGitHubUserData, GitHubError } from "../../../src/services/github.service";
import { generateAdvice } from "../../../src/services/advice.service";
import { buildAdviceData } from "../../../src/services/advice-builder.service";

const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockGenerateAdvice = generateAdvice as ReturnType<typeof vi.fn>;
const mockBuildAdviceData = buildAdviceData as ReturnType<typeof vi.fn>;

describe("adviseUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.mockAi = false;
    mockEnv.openaiApiKey = "sk-test";
  });

  sharedControllerBehaviorTests({
    handler: adviseUser,
    mockFetchGitHubUserData,
    mockEnv,
    GitHubError,
  });

  it("returns advice on happy path", async () => {
    const githubData = { profile: { name: "Octocat" } };
    const aiResult = { summary: "Good profile" };
    const advice = { summary: "Good profile" };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockGenerateAdvice.mockResolvedValue(aiResult);
    mockBuildAdviceData.mockReturnValue(advice);

    const { req, res, next } = createControllerMocks();

    await adviseUser(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Octocat", advice },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("uses mock AI when env.mockAi is true", async () => {
    mockEnv.mockAi = true;
    const githubData = { profile: { name: "Octocat" } };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockBuildAdviceData.mockReturnValue({ mock: true });

    const { req, res, next } = createControllerMocks();

    await adviseUser(req, res, next);

    expect(mockGenerateAdvice).not.toHaveBeenCalled();
    expect(mockBuildAdviceData).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Mock User (octocat)", advice: { mock: true } },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("handles generic error with 500", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("boom"));
    const { req, res, next } = createControllerMocks();

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Advice generation failed. Please try again.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
