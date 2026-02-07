import { Router } from "express";
import healthRoutes from "./health.routes";
import githubRoutes from "./github.routes";

const router = Router();

router.use(healthRoutes);
router.use(githubRoutes);

export default router;
