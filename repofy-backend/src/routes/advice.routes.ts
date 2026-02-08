import { Router } from "express";
import { adviseUser } from "../controllers/advice.controller";

const router = Router();

router.post("/advice/:username", adviseUser);

export default router;
