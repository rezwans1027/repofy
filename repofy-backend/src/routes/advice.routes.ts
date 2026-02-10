import { Router } from "express";
import { adviseUser } from "../controllers/advice.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.post("/advice/:username", aiRateLimit, requireAuth, timeout(120_000), asyncHandler(adviseUser));

export default router;
