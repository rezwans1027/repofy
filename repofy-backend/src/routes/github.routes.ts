import { Router } from "express";
import { searchGitHub, getGitHubUser } from "../controllers/github.controller";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

router.get("/github/search", asyncHandler(searchGitHub));
router.get("/github/:username", asyncHandler(getGitHubUser));

export default router;
