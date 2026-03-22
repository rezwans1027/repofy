import { Router } from "express";
import { getBalance, getHistory } from "../controllers/credit.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { creditRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.get("/credits/balance", creditRateLimit, requireAuth, timeout(30_000), asyncHandler(getBalance));
router.get("/credits/history", creditRateLimit, requireAuth, timeout(30_000), asyncHandler(getHistory));

export default router;
