import { Router } from "express";
import { adviseUser } from "../controllers/advice.controller";
import { getAdviceList, getAdviceDetail, checkAdviceExists, removeAdvice } from "../controllers/advice-read.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { aiRateLimit, readRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.get("/advice", requireAuth, readRateLimit, asyncHandler(getAdviceList));
router.get("/advice/exists/:username", requireAuth, readRateLimit, asyncHandler(checkAdviceExists));
router.get("/advice/:id", requireAuth, readRateLimit, asyncHandler(getAdviceDetail));
router.delete("/advice", requireAuth, readRateLimit, asyncHandler(removeAdvice));
router.post("/advice/:username", requireAuth, aiRateLimit, timeout(300_000), asyncHandler(adviseUser));

export default router;
