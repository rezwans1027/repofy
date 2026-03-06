import { Router } from "express";
import { getBalance } from "../controllers/credit.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { creditRateLimit } from "../middleware/rateLimit";

const router = Router();

router.get("/credits/balance", requireAuth, creditRateLimit, asyncHandler(getBalance));

export default router;
