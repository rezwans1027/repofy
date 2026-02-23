import { Router } from "express";
import { requireAdminKey } from "../middleware/adminAuth";
import { getUsageStats } from "../controllers/admin.controller";

const router = Router();

router.get("/admin/usage", requireAdminKey, getUsageStats);

export default router;
