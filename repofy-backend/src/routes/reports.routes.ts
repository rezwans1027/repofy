import { Router } from "express";
import { getReports, getReport, checkReportExists, removeReports } from "../controllers/reports.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { readRateLimit } from "../middleware/rateLimit";

const router = Router();

router.get("/reports", requireAuth, readRateLimit, asyncHandler(getReports));
router.get("/reports/exists/:username", requireAuth, readRateLimit, asyncHandler(checkReportExists));
router.get("/reports/:id", requireAuth, readRateLimit, asyncHandler(getReport));
router.delete("/reports", requireAuth, readRateLimit, asyncHandler(removeReports));

export default router;
