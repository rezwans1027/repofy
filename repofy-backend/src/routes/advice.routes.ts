import { Router } from "express";
import { adviseUser } from "../controllers/advice.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/advice/:username", asyncHandler(requireAuth), asyncHandler(adviseUser));

export default router;
