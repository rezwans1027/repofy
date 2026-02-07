import { Router } from "express";
import { searchGitHub, getGitHubUser } from "../controllers/github.controller";

const router = Router();

router.get("/github/search", searchGitHub);
router.get("/github/:username", getGitHubUser);

export default router;
