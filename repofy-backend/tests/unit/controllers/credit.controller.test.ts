import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/credit.service", () => ({
  getCreditBalance: vi.fn(),
  getTransactionHistory: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getBalance, getHistory } from "../../../src/controllers/credit.controller";
import { getCreditBalance, getTransactionHistory } from "../../../src/services/credit.service";

const mockGetCreditBalance = getCreditBalance as ReturnType<typeof vi.fn>;
const mockGetTransactionHistory = getTransactionHistory as ReturnType<typeof vi.fn>;

describe("getBalance controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns balance on success", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    mockGetCreditBalance.mockResolvedValue({
      growth_balance: 3,
      eval_balance: 0,
    });

    await getBalance(req, res, next);

    expect(mockGetCreditBalance).toHaveBeenCalledWith("user-123");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { growth_balance: 3, eval_balance: 0 },
    });
  });

  it("returns 500 when service throws", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    mockGetCreditBalance.mockRejectedValue(new Error("DB error"));

    await getBalance(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Failed to fetch credit balance",
    });
  });
});

describe("getHistory controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns transactions on success", async () => {
    const { req, res, next } = createControllerMocks({}, { limit: "10", offset: "0" });
    (req as any).userId = "user-123";
    const mockResult = {
      transactions: [
        { id: "tx-1", credit_type: "growth", amount: 2, source: "purchase", description: null, metadata: null, created_at: "2024-01-01" },
      ],
      total: 1,
    };
    mockGetTransactionHistory.mockResolvedValue(mockResult);

    await getHistory(req, res, next);

    expect(mockGetTransactionHistory).toHaveBeenCalledWith("user-123", 10, 0);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: mockResult,
    });
  });

  it("caps limit at 100", async () => {
    const { req, res, next } = createControllerMocks({}, { limit: "500", offset: "0" });
    (req as any).userId = "user-123";
    mockGetTransactionHistory.mockResolvedValue({ transactions: [], total: 0 });

    await getHistory(req, res, next);

    expect(mockGetTransactionHistory).toHaveBeenCalledWith("user-123", 100, 0);
  });

  it("defaults limit to 20 and offset to 0", async () => {
    const { req, res, next } = createControllerMocks({}, {});
    (req as any).userId = "user-123";
    mockGetTransactionHistory.mockResolvedValue({ transactions: [], total: 0 });

    await getHistory(req, res, next);

    expect(mockGetTransactionHistory).toHaveBeenCalledWith("user-123", 20, 0);
  });

  it("returns 500 when service throws", async () => {
    const { req, res, next } = createControllerMocks({}, {});
    (req as any).userId = "user-123";
    mockGetTransactionHistory.mockRejectedValue(new Error("DB error"));

    await getHistory(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Failed to fetch transaction history",
    });
  });
});
