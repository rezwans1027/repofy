import { Router } from "express";
import healthRoutes from "./health.routes";
import githubRoutes from "./github.routes";
import analyzeRoutes from "./analyze.routes";
import adviceRoutes from "./advice.routes";
import adminRoutes from "./admin.routes";
import stripeRoutes from "./stripe.routes";
import creditRoutes from "./credit.routes";
import authRoutes from "./auth.routes";

const router = Router();

router.use(healthRoutes);
router.use(authRoutes);
router.use(githubRoutes);
router.use(analyzeRoutes);
router.use(adviceRoutes);
router.use(adminRoutes);
router.use(stripeRoutes);
router.use(creditRoutes);

export default router;
