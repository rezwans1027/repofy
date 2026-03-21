import { Router } from "express";
import {
  handleGitHubCallback,
  handleLogout,
  handleRefresh,
  handleMe,
} from "../controllers/auth.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { authRateLimit } from "../middleware/rateLimit";

const router = Router();

router.post("/auth/github-callback", authRateLimit, asyncHandler(handleGitHubCallback));
router.post("/auth/refresh", authRateLimit, asyncHandler(handleRefresh));
router.get("/auth/me", requireAuth, asyncHandler(handleMe));
router.post("/auth/logout", authRateLimit, asyncHandler(handleLogout));

export default router;
