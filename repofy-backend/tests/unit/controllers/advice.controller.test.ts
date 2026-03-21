import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

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
  refundGrowthCredit: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../../src/services/advice-job.service", () => ({
  createJob: vi.fn(),
  getActiveJob: vi.fn(),
  completeJob: vi.fn().mockResolvedValue(undefined),
  failJob: vi.fn().mockResolvedValue(undefined),
}));
const mockSupabaseInsert = vi.fn();
vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert: (...args: unknown[]) => {
        const result = mockSupabaseInsert(...args);
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
import { getCreditBalance, deductGrowthCredit, refundGrowthCredit } from "../../../src/services/credit.service";
import { createJob, getActiveJob, completeJob, failJob } from "../../../src/services/advice-job.service";
import { buildAdviceData } from "../../../src/services/advice-builder.service";
import { fetchGitHubUserData } from "../../../src/services/github.service";
import { callEngine } from "../../../src/services/engine.service";

const mockGetCreditBalance = getCreditBalance as ReturnType<typeof vi.fn>;
const mockDeductGrowthCredit = deductGrowthCredit as ReturnType<typeof vi.fn>;
const mockRefundGrowthCredit = refundGrowthCredit as ReturnType<typeof vi.fn>;
const mockCreateJob = createJob as ReturnType<typeof vi.fn>;
const mockGetActiveJob = getActiveJob as ReturnType<typeof vi.fn>;
const mockCompleteJob = completeJob as ReturnType<typeof vi.fn>;
const mockFailJob = failJob as ReturnType<typeof vi.fn>;
const mockBuildAdviceData = buildAdviceData as ReturnType<typeof vi.fn>;
const mockFetchGitHubUserData = fetchGitHubUserData as ReturnType<typeof vi.fn>;
const mockCallEngine = callEngine as ReturnType<typeof vi.fn>;

const MOCK_JOB = {
  id: "job-1",
  user_id: "user-123",
  analyzed_username: "octocat",
  status: "processing",
  advice_id: null,
  error: null,
  created_at: "2026-03-21T10:00:00Z",
  updated_at: "2026-03-21T10:00:00Z",
};

describe("adviseUser controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.mockAi = false;
    mockGetCreditBalance.mockResolvedValue({ growth_balance: 5, eval_balance: 0 });
    mockDeductGrowthCredit.mockResolvedValue(true);
    mockRefundGrowthCredit.mockResolvedValue(true);
    mockGetActiveJob.mockResolvedValue(null);
    mockCreateJob.mockResolvedValue(MOCK_JOB);
    mockCompleteJob.mockResolvedValue(undefined);
    mockFailJob.mockResolvedValue(undefined);
    mockSupabaseInsert.mockReturnValue({ data: { id: "advice-row-1" }, error: null });
    // Background processing mocks — prevent unhandled rejections
    mockFetchGitHubUserData.mockResolvedValue({ profile: { name: "Octocat" } });
    mockCallEngine.mockResolvedValue({ advice: { schemaVersion: "v2", summary: "Good" }, tokenUsage: [] });
    mockBuildAdviceData.mockReturnValue({ schemaVersion: "v2", summary: "Good" });
  });

  it("returns 400 for invalid username", async () => {
    const { req, res, next } = createControllerMocks({ username: "-invalid" });

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid GitHub username format",
    });
  });

  it("returns 403 when githubToken is missing", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 202 with jobId on happy path", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).toHaveBeenCalledWith(
      "user-123",
      expect.any(String),
      { username: "octocat", endpoint: "/advice" },
    );
    expect(mockCreateJob).toHaveBeenCalledWith("user-123", "octocat");
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { jobId: "job-1", createdAt: "2026-03-21T10:00:00Z" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("deducts credit upfront before creating job (verifies order)", async () => {
    const callOrder: string[] = [];
    mockGetCreditBalance.mockImplementation(async () => {
      callOrder.push("precheck");
      return { growth_balance: 1, eval_balance: 0 };
    });
    mockDeductGrowthCredit.mockImplementation(async () => {
      callOrder.push("deduct");
      return true;
    });
    mockCreateJob.mockImplementation(async () => {
      callOrder.push("createJob");
      return MOCK_JOB;
    });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(callOrder).toEqual(["precheck", "deduct", "createJob"]);
  });

  it("returns 402 early when pre-check shows zero balance (no GitHub call)", async () => {
    mockGetCreditBalance.mockResolvedValue({ growth_balance: 0, eval_balance: 0 });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(mockDeductGrowthCredit).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("returns 402 when atomic deduct returns false (race condition)", async () => {
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
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("returns existing active job idempotently", async () => {
    mockGetActiveJob.mockResolvedValue(MOCK_JOB);

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).githubToken = "fake-token";

    await adviseUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { jobId: "job-1", createdAt: "2026-03-21T10:00:00Z" },
    });
    expect(mockDeductGrowthCredit).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });

  it("returns 202 in mockAi mode with credit deduction", async () => {
    mockEnv.mockAi = true;
    mockBuildAdviceData.mockReturnValue({ mock: true });

    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";

    await adviseUser(req, res, next);

    expect(mockDeductGrowthCredit).toHaveBeenCalled();
    expect(mockCreateJob).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { jobId: "job-1", createdAt: "2026-03-21T10:00:00Z" },
    });
  });

  it("handles generic error with 500", async () => {
    mockGetCreditBalance.mockRejectedValue(new Error("boom"));
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
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
