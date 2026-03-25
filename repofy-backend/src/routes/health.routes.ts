import { Router } from "express";
import { getHealth, getReady } from "../controllers/health.controller";

const router = Router();

router.get("/health", getHealth);
router.get("/health/ready", getReady);

export default router;
