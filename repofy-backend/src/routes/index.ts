import { Router } from "express";
import healthRoutes from "./health.routes";
import githubRoutes from "./github.routes";
import analyzeRoutes from "./analyze.routes";
import adviceRoutes from "./advice.routes";

const router = Router();

router.use(healthRoutes);
router.use(githubRoutes);
router.use(analyzeRoutes);
router.use(adviceRoutes);

export default router;
