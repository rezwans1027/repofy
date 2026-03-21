import { Router } from "express";
import { getReports, getReport, checkReportCount, removeReports } from "../controllers/reports.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { readRateLimit } from "../middleware/rateLimit";
import { timeout } from "../middleware/timeout";

const router = Router();

router.get("/reports", readRateLimit, requireAuth, timeout(30_000), asyncHandler(getReports));
router.get("/reports/exists/:username", readRateLimit, requireAuth, timeout(30_000), asyncHandler(checkReportCount));
router.get("/reports/:id", readRateLimit, requireAuth, timeout(30_000), asyncHandler(getReport));
router.delete("/reports", readRateLimit, requireAuth, timeout(30_000), asyncHandler(removeReports));

export default router;
