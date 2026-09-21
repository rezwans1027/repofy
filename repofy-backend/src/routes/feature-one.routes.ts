import { Router, type RequestHandler } from "express";
import { ClientCapabilitiesSchema, type FeatureFlags } from "@repofy/contracts";
import { clientCapabilities } from "../config/feature-one";
import { sendError, sendSuccess } from "../lib/response";
import { requireAuth } from "../middleware/auth";
import { discoverRubrics } from "../controllers/rubrics.controller";
import { createGitHubAppRoutes } from "./github-app.routes";
import type { GitHubConnectionService } from "../domain/github-app/service";
import { createRepositorySelectionRoutes } from "./repository-selection.routes";
import { createAnalysisRoutes } from "./analysis.routes";
import { createReadinessRoutes } from "./readiness.routes";
import { createRescanRoutes } from "./rescans.routes";
import { createFindingFeedbackRoutes } from "./finding-feedback.routes";

export function createFeatureOneRoutes(flags: FeatureFlags, githubFactory?: () => GitHubConnectionService): Router {
  const router = Router();
  const requireFlag = (name: keyof FeatureFlags): RequestHandler => (_req, res, next) => {
    if (!flags.featureOneEnabled || !flags[name]) {
      sendError(res, 503, "Project evidence and role readiness is not available yet.", { code: "FEATURE_DISABLED", retryable: false });
      return;
    }
    next();
  };
  const unfinished: RequestHandler = (_req, res) => {
    sendError(res, 501, "Project evidence and role readiness is not available yet.", { code: "FEATURE_NOT_IMPLEMENTED", retryable: false });
  };

  // This public endpoint contains deployment capabilities only, never credentials or user data.
  router.get("/capabilities", (_req, res) => {
    sendSuccess(res, ClientCapabilitiesSchema.parse(clientCapabilities(flags)));
  });
  router.get(["/role-rubrics", "/role-rubrics/:releaseId"], requireFlag("featureOneEnabled"), requireAuth, discoverRubrics);
  router.use(createGitHubAppRoutes(requireFlag("githubAppRepositoriesEnabled"), githubFactory));
  router.use(createRepositorySelectionRoutes(requireFlag("githubAppRepositoriesEnabled")));
  router.use(createAnalysisRoutes(requireFlag("githubAppRepositoriesEnabled")));
  router.use(createRescanRoutes(requireFlag("rescansEnabled")));
  router.use(createFindingFeedbackRoutes(requireFlag("findingFeedbackEnabled"), () => flags.featureOneEnabled && flags.findingFeedbackEnabled));
  router.use(createReadinessRoutes());
  router.use("/analyses/:jobId/rescan", requireFlag("rescansEnabled"), unfinished);
  router.use("/analyses/:jobId/feedback", requireFlag("findingFeedbackEnabled"), unfinished);
  router.use("/analyses", requireFlag("featureOneEnabled"), unfinished);
  router.use("/readiness-reports", requireFlag("featureOneEnabled"), unfinished);
  router.use("/repositories", requireFlag("githubAppRepositoriesEnabled"), unfinished);
  router.use("/github/installations", requireFlag("githubAppRepositoriesEnabled"), unfinished);
  return router;
}
