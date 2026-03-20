import { Router } from "express";
import { adminRateLimit } from "../middleware/rateLimit";
import { requireAdminKey } from "../middleware/adminAuth";
import { asyncHandler } from "../middleware/asyncHandler";
import { handleGetUsageStats } from "../controllers/admin.controller";

const router = Router();

router.get("/admin/usage", adminRateLimit, requireAdminKey, asyncHandler(handleGetUsageStats));

export default router;
