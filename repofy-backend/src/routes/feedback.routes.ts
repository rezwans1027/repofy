import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { submitFeedback } from "../controllers/feedback.controller";

const router = Router();

router.post("/feedback", requireAuth, submitFeedback);

export default router;
