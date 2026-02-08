import { Router } from "express";
import { analyzeUser } from "../controllers/analyze.controller";

const router = Router();

router.post("/analyze/:username", analyzeUser);

export default router;
