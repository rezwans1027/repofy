import { Router } from "express";
import { getBalance } from "../controllers/credit.controller";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/credits/balance", requireAuth, asyncHandler(getBalance));

export default router;
