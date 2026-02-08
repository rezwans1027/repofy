import { Router } from "express";
import { postAnalyze } from "../controllers/analyze.controller";

const router = Router();
router.post("/", postAnalyze);

export default router;
