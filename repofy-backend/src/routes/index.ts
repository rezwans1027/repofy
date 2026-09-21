import { Router } from "express";
import healthRoutes from "./health.routes";
import githubRoutes from "./github.routes";
// import analyzeRoutes from "./analyze.routes"; // disabled — feature not yet launched
import adviceRoutes from "./advice.routes";
import reportRoutes from "./reports.routes";
import adminRoutes from "./admin.routes";
import stripeRoutes from "./stripe.routes";
import creditRoutes from "./credit.routes";
import feedbackRoutes from "./feedback.routes";
import authRoutes from "./auth.routes";
import { DISABLED_FEATURE_FLAGS } from "@repofy/contracts";
import { env } from "../config/env";
import { createFeatureOneRoutes } from "./feature-one.routes";

const router = Router();
router.use("/v1", createFeatureOneRoutes(env.featureOne?.flags ?? DISABLED_FEATURE_FLAGS));

router.use(healthRoutes);
router.use(authRoutes);
router.use(githubRoutes);
// router.use(analyzeRoutes); // disabled — feature not yet launched
router.use(adviceRoutes);
router.use(reportRoutes);
router.use(adminRoutes);
router.use(stripeRoutes);
router.use(creditRoutes);
router.use(feedbackRoutes);

export default router;
