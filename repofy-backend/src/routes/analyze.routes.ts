import { Router } from "express";
import { analyzeUser } from "../controllers/analyze.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/analyze/:username", asyncHandler(requireAuth), asyncHandler(analyzeUser));

export default router;
