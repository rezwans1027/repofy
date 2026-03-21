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
vi.mock("../../../src/services/engine.service", () => ({
  callEngine: vi.fn(),
}));
vi.mock("../../../src/services/advice-builder.service", () => ({
  buildAdviceData: vi.fn(),
}));
vi.mock("../../../src/services/credit.service", () => ({
  getCreditBalance: vi.fn(),
  deductGrowthCredit: vi.fn(),
}));
const mockSupabaseUpsert = vi.fn();
vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      upsert: (...args: unknown[]) => {
        const result = mockSupabaseUpsert(...args);
        return {
          select: () => ({
            single: () => result,
          }),
        };
      },
    }),
  }),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../../src/lib/usage-logger", () => ({
  logTokenUsage: vi.fn(),
}));
const mockEnv: Record<string, unknown> = {
  mockAi: false,
};
vi.mock("../../../src/config/env", () => ({
  env: new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => mockEnv[prop],
  }),
}));

import { adviseUser } from "../../../src/controllers/advice.controller";
import { fetchGitHubUserData, GitHubError } from "../../../src/services/github.service";
import { callEngine } from "../../../src/services/engine.service";
import { buildAdviceData } from "../../../src/services/advice-builder.service";
import { getCreditBalance, deductGrowthCredit } from "../../../src/services/credit.service";

const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockCallEngine = callEngine as ReturnType<typeof vi.fn>;
const mockBuildAdviceData = buildAdviceData as ReturnType<typeof vi.fn>;
const mockGetCreditBalance = getCreditBalance as ReturnType<typeof vi.fn>;
const mockDeductGrowthCredit = deductGrowthCredit as ReturnType<typeof vi.fn>;

describe("adviseUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.mockAi = false;
    mockGetCreditBalance.mockResolvedValue({ growth_balance: 5, eval_balance: 0 });
    mockDeductGrowthCredit.mockResolvedValue(true);
    mockSupabaseUpsert.mockReturnValue({ data: { id: "advice-row-1" }, error: null });
  });

  sharedControllerBehaviorTests({
    handler: adviseUser,
    mockFetchGitHubUserData,
    mockEnv,
    GitHubError,
  });

  it("returns adviceId on happy path (engine succeeds, then deduct + persist)", async () => {
    const githubData = { profile: { name: "Octocat" } };
    const engineResponse = { advice: { schemaVersion: "v2", summary: "Good profile" }, tokenUsage: [] };
    const advice = { schemaVersion: "v2", summary: "Good profile" };
    mockFetchGitHubUserData.mockResolvedValue(githubData);
    mockCallEngine.mockResolvedValue(engineResponse);
    mockBuildAdviceData.mockReturnValue(advice);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).toHaveBeenCalledWith(
      "user-123",
      expect.any(String),
      { username: "octocat", endpoint: "/advice" },
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { adviceId: "advice-row-1" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("pre-checks balance, then GitHub, then engine, then deducts (verifies order)", async () => {
    const callOrder: string[] = [];
    mockGetCreditBalance.mockImplementation(async () => {
      callOrder.push("precheck");
      return { growth_balance: 1, eval_balance: 0 };
    });
    mockFetchGitHubUserData.mockImplementation(async () => {
      callOrder.push("github");
      return { profile: { name: "Octocat" } };
    });
    mockCallEngine.mockImplementation(async () => {
      callOrder.push("engine");
      return { advice: { summary: "result" }, tokenUsage: [] };
    });
    mockBuildAdviceData.mockReturnValue({ summary: "result" });
    mockDeductGrowthCredit.mockImplementation(async () => {
      callOrder.push("deduct");
      return true;
    });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(callOrder).toEqual(["precheck", "github", "engine", "deduct"]);
  });

  it("returns 402 early when pre-check shows zero balance (no GitHub call)", async () => {
    mockGetCreditBalance.mockResolvedValue({ growth_balance: 0, eval_balance: 0 });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(mockFetchGitHubUserData).not.toHaveBeenCalled();
    expect(mockDeductGrowthCredit).not.toHaveBeenCalled();
    expect(mockCallEngine).not.toHaveBeenCalled();
  });

  it("returns 402 when atomic deduct returns false (race condition)", async () => {
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockCallEngine.mockResolvedValue({ advice: { summary: "Good" }, tokenUsage: [] });
    mockBuildAdviceData.mockReturnValue({ summary: "Good" });
    mockDeductGrowthCredit.mockResolvedValue(false);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Insufficient growth credits",
    });
  });

  it("does NOT deduct credit when engine fails", async () => {
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockCallEngine.mockRejectedValue(new Error("Engine service down"));

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("does NOT deduct credit when buildAdviceData throws", async () => {
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockCallEngine.mockResolvedValue({ advice: { summary: "Good" }, tokenUsage: [] });
    mockBuildAdviceData.mockImplementation(() => {
      throw new Error("Build failed");
    });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("does NOT deduct credit on timeout/abort", async () => {
    const ac = new AbortController();
    mockFetchGitHubUserData.mockImplementation(async () => {
      ac.abort();
      throw new DOMException("Aborted", "AbortError");
    });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";
    (req as any).signal = ac.signal;

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).not.toHaveBeenCalled();
  });

  it("skips credit deduction in mockAi mode but still persists and returns adviceId", async () => {
    mockEnv.mockAi = true;
    mockBuildAdviceData.mockReturnValue({ mock: true });

    const { req, res, next } = createControllerMocks();

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { adviceId: "advice-row-1" },
    });
  });

  it("handles generic error with 500", async () => {
    mockFetchGitHubUserData.mockRejectedValue(new Error("boom"));
    const { req, res, next } = createControllerMocks();
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Advice generation failed. Please try again.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
