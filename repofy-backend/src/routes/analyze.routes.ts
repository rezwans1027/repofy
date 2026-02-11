import { Router } from "express";
import { analyzeUser } from "../controllers/analyze.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.post("/analyze/:username", aiRateLimit, timeout(120_000), requireAuth, asyncHandler(analyzeUser));

export default router;
