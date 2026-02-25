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
vi.mock("../../../src/services/credit.service", () => ({
  deductGrowthCredit: vi.fn(),
  refundGrowthCredit: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/lib/errors", () => ({
  isRefundableError: vi.fn(),
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
import { deductGrowthCredit, refundGrowthCredit } from "../../../src/services/credit.service";
import { isRefundableError } from "../../../src/lib/errors";
import { logger } from "../../../src/lib/logger";

const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockGenerateAdvice = generateAdvice as ReturnType<typeof vi.fn>;
const mockBuildAdviceData = buildAdviceData as ReturnType<typeof vi.fn>;
const mockDeductGrowthCredit = deductGrowthCredit as ReturnType<typeof vi.fn>;
const mockRefundGrowthCredit = refundGrowthCredit as ReturnType<typeof vi.fn>;
const mockIsRefundableError = isRefundableError as ReturnType<typeof vi.fn>;

describe("adviseUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.mockAi = false;
    mockEnv.openaiApiKey = "sk-test";
    mockDeductGrowthCredit.mockResolvedValue(true);
    mockRefundGrowthCredit.mockResolvedValue(true);
    mockIsRefundableError.mockReturnValue(true);
  });

  sharedControllerBehaviorTests({
    handler: adviseUser,
    mockFetchGitHubUserData,
    mockEnv,
    GitHubError,
  });

  it("returns advice on happy path (deduct succeeds)", async () => {
    const githubData = { profile: { name: "Octocat" } };
    const aiResult = { summary: "Good profile" };
    const advice = { summary: "Good profile" };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockGenerateAdvice.mockResolvedValue(aiResult);
    mockBuildAdviceData.mockReturnValue(advice);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).toHaveBeenCalledWith(
      "user-123",
      expect.any(String),
      { username: "octocat", endpoint: "/advice" },
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Octocat", advice },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("deducts AFTER GitHub fetch (verifies order)", async () => {
    const callOrder: string[] = [];
    mockFetchGitHubUserData.mockImplementation(async () => {
      callOrder.push("github");
      return { profile: { name: "Octocat" } };
    });
    mockDeductGrowthCredit.mockImplementation(async () => {
      callOrder.push("deduct");
      return true;
    });
    mockGenerateAdvice.mockImplementation(async () => {
      callOrder.push("ai");
      return { summary: "result" };
    });
    mockBuildAdviceData.mockReturnValue({ summary: "result" });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(callOrder).toEqual(["github", "deduct", "ai"]);
  });

  it("returns 402 when deduct returns false", async () => {
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockDeductGrowthCredit.mockResolvedValue(false);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Insufficient growth credits",
    });
    expect(mockGenerateAdvice).not.toHaveBeenCalled();
  });

  it("skips credit deduction in mockAi mode", async () => {
    mockEnv.mockAi = true;
    mockBuildAdviceData.mockReturnValue({ mock: true });

    const { req, res, next } = createControllerMocks();

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { analyzedName: "Mock User (octocat)", advice: { mock: true } },
    });
  });

  it("refunds on AI failure when isRefundableError returns true", async () => {
    const aiError = new Error("AI service down");
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockGenerateAdvice.mockRejectedValue(aiError);
    mockIsRefundableError.mockReturnValue(true);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(mockRefundGrowthCredit).toHaveBeenCalledWith(
      "user-123",
      expect.any(String),
      { reason: "post_deduction_failure" },
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("refunds when buildAdviceData throws (post-AI failure)", async () => {
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockGenerateAdvice.mockResolvedValue({ summary: "Good" });
    mockBuildAdviceData.mockImplementation(() => {
      throw new Error("Build failed");
    });
    mockIsRefundableError.mockReturnValue(true);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(mockRefundGrowthCredit).toHaveBeenCalledWith(
      "user-123",
      expect.any(String),
      { reason: "post_deduction_failure" },
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("does NOT refund when isRefundableError returns false", async () => {
    const aiError = Object.assign(new Error("Bad request"), { status: 400 });
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockGenerateAdvice.mockRejectedValue(aiError);
    mockIsRefundableError.mockReturnValue(false);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(mockRefundGrowthCredit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("logs CRITICAL error when refund fails", async () => {
    const aiError = new Error("AI timeout");
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockGenerateAdvice.mockRejectedValue(aiError);
    mockIsRefundableError.mockReturnValue(true);
    mockRefundGrowthCredit.mockResolvedValue(false);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(logger.error).toHaveBeenCalledWith(
      "CRITICAL: refund failed",
      expect.objectContaining({
        userId: "user-123",
        requestId: expect.any(String),
        error: "AI timeout",
      }),
    );
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
