import { Router } from "express";
import healthRoutes from "./health.routes";
import githubRoutes from "./github.routes";
import analyzeRoutes from "./analyze.routes";

const router = Router();

router.use(healthRoutes);
router.use(githubRoutes);
router.use("/analyze", analyzeRoutes);

export default router;
