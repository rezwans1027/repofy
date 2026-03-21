import { Router } from "express";
import { adviseUser } from "../controllers/advice.controller";
import { getAdviceList, getAdviceDetail, checkAdviceCount, removeAdvice } from "../controllers/advice-read.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { aiRateLimit, readRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.get("/advice", readRateLimit, requireAuth, asyncHandler(getAdviceList));
router.get("/advice/exists/:username", readRateLimit, requireAuth, asyncHandler(checkAdviceCount));
router.get("/advice/:id", readRateLimit, requireAuth, asyncHandler(getAdviceDetail));
router.delete("/advice", readRateLimit, requireAuth, asyncHandler(removeAdvice));
router.post("/advice/:username", aiRateLimit, requireAuth, timeout(300_000), asyncHandler(adviseUser));

export default router;
