import { Router } from "express";
import { searchGitHub, getGitHubUser } from "../controllers/github.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { githubRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.get("/github/search", requireAuth, githubRateLimit, timeout(30_000), asyncHandler(searchGitHub));
router.get("/github/:username", requireAuth, githubRateLimit, timeout(30_000), asyncHandler(getGitHubUser));

export default router;
