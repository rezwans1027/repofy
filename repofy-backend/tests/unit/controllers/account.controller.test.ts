import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/services/account.service", () => ({
  exportUserData: vi.fn(),
  deleteUserAccount: vi.fn(),
}));
vi.mock("../../../src/middleware/auth", () => ({
  invalidateToken: vi.fn(),
}));
vi.mock("../../../src/lib/cookie-utils", () => ({
  clearAuthCookies: vi.fn(),
  extractAccessToken: vi.fn().mockReturnValue("mock-token"),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleExportData, handleDeleteAccount } from "../../../src/controllers/account.controller";
import { exportUserData, deleteUserAccount } from "../../../src/services/account.service";
import { invalidateToken } from "../../../src/middleware/auth";
import { clearAuthCookies, extractAccessToken } from "../../../src/lib/cookie-utils";

const mockExportUserData = exportUserData as ReturnType<typeof vi.fn>;
const mockDeleteUserAccount = deleteUserAccount as ReturnType<typeof vi.fn>;
const mockInvalidateToken = invalidateToken as ReturnType<typeof vi.fn>;
const mockClearAuthCookies = clearAuthCookies as ReturnType<typeof vi.fn>;
const mockExtractAccessToken = extractAccessToken as ReturnType<typeof vi.fn>;

describe("account.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractAccessToken.mockReturnValue("mock-token");
  });

  describe("handleExportData", () => {
    it("returns exported data on success", async () => {
      const { req, res, next } = createControllerMocks();
      (req as any).userId = "user-123";
      const mockData = { account: {}, exported_at: "2024-01-01" };
      mockExportUserData.mockResolvedValue(mockData);

      await handleExportData(req, res, next);

      expect(mockExportUserData).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    it("returns 500 when service throws", async () => {
      const { req, res, next } = createControllerMocks();
      (req as any).userId = "user-123";
      mockExportUserData.mockRejectedValue(new Error("DB error"));

      await handleExportData(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Failed to export user data",
      });
    });
  });

  describe("handleDeleteAccount", () => {
    it("returns 400 when confirmation is missing", async () => {
      const { req, res, next } = createControllerMocks();
      (req as any).userId = "user-123";
      (req as any).userEmail = "test@example.com";
      (req as any).body = {};

      await handleDeleteAccount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: "Confirmation email does not match your account email.",
      });
    });

    it("returns 400 when confirmation does not match email", async () => {
      const { req, res, next } = createControllerMocks();
      (req as any).userId = "user-123";
      (req as any).userEmail = "test@example.com";
      (req as any).body = { confirmation: "wrong@example.com" };

      await handleDeleteAccount(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("matches confirmation case-insensitively", async () => {
      const { req, res, next } = createControllerMocks();
      (req as any).userId = "user-123";
      (req as any).userEmail = "Test@Example.com";
      (req as any).body = { confirmation: "test@example.com" };
      mockDeleteUserAccount.mockResolvedValue(undefined);

      await handleDeleteAccount(req, res, next);

      expect(mockDeleteUserAccount).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: "Account deleted successfully." },
      });
    });

    it("clears cookies and invalidates token on success", async () => {
      const { req, res, next } = createControllerMocks();
      (req as any).userId = "user-123";
      (req as any).userEmail = "test@example.com";
      (req as any).body = { confirmation: "test@example.com" };
      mockDeleteUserAccount.mockResolvedValue(undefined);

      await handleDeleteAccount(req, res, next);

      expect(mockInvalidateToken).toHaveBeenCalledWith("mock-token");
      expect(mockClearAuthCookies).toHaveBeenCalledWith(res);
    });

    it("does NOT clear cookies when deletion fails", async () => {
      const { req, res, next } = createControllerMocks();
      (req as any).userId = "user-123";
      (req as any).userEmail = "test@example.com";
      (req as any).body = { confirmation: "test@example.com" };
      mockDeleteUserAccount.mockRejectedValue(new Error("DB error"));

      await handleDeleteAccount(req, res, next);

      expect(mockInvalidateToken).not.toHaveBeenCalled();
      expect(mockClearAuthCookies).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
