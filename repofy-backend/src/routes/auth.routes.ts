import { Router } from "express";
import {
  handleGitHubCallback,
  handleLogout,
  handleRefresh,
  handleMe,
} from "../controllers/auth.controller";
import { handleExportData, handleDeleteAccount } from "../controllers/account.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { authRateLimit, accountRateLimit } from "../middleware/rateLimit";

const router = Router();

router.post("/auth/github-callback", authRateLimit, asyncHandler(handleGitHubCallback));
router.post("/auth/refresh", authRateLimit, asyncHandler(handleRefresh));
router.get("/auth/me", requireAuth, asyncHandler(handleMe));
router.post("/auth/logout", authRateLimit, asyncHandler(handleLogout));
router.get("/auth/export-data", requireAuth, accountRateLimit, asyncHandler(handleExportData));
router.delete("/auth/account", requireAuth, accountRateLimit, asyncHandler(handleDeleteAccount));

export default router;
