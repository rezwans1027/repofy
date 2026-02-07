import { Router } from "express";
import healthRoutes from "./health.routes";

const router = Router();

router.use(healthRoutes);

export default router;
