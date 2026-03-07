import { Router } from "express";
import { adminRateLimit } from "../middleware/rateLimit";
import { requireAdminKey } from "../middleware/adminAuth";
import { getUsageStats } from "../controllers/admin.controller";

const router = Router();

router.get("/admin/usage", adminRateLimit, requireAdminKey, getUsageStats);

export default router;
