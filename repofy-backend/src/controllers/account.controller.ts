import { RequestHandler } from "express";
import { exportUserData, deleteUserAccount } from "../services/account.service";
import { sendSuccess, sendError } from "../lib/response";
import { handleControllerError } from "../lib/controller-utils";
import { invalidateToken } from "../middleware/auth";
import { clearAuthCookies, extractAccessToken } from "../lib/cookie-utils";
import type { AuthenticatedRequest } from "../types";

export const handleExportData: RequestHandler = async (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  try {
    const data = await exportUserData(userId);
    sendSuccess(res, data);
  } catch (err) {
    handleControllerError(err, req, res, "Export Data", "Failed to export user data");
  }
};

export const handleDeleteAccount: RequestHandler = async (req, res) => {
  const { userId, userEmail } = req as AuthenticatedRequest;
  const { confirmation } = req.body ?? {};

  if (typeof confirmation !== "string" || confirmation.toLowerCase() !== userEmail.toLowerCase()) {
    sendError(res, 400, "Confirmation email does not match your account email.");
    return;
  }

  try {
    await deleteUserAccount(userId);

    // Only clear session after successful deletion
    const token = extractAccessToken(req);
    if (token) invalidateToken(token);
    clearAuthCookies(res);

    sendSuccess(res, { message: "Account deleted successfully." });
  } catch (err) {
    // Do NOT clear cookies on failure — user needs session to retry
    handleControllerError(err, req, res, "Delete Account", "Failed to delete account");
  }
};
