import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/credit.service", () => ({
  getCreditBalance: vi.fn(),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getBalance } from "../../../src/controllers/credit.controller";
import { getCreditBalance } from "../../../src/services/credit.service";

const mockGetCreditBalance = getCreditBalance as ReturnType<typeof vi.fn>;

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
