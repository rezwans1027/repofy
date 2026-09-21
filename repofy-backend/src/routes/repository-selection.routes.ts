import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { suppressTracing } from "@sentry/node";
import { sendError, sendSuccess } from "../lib/response";
import { requireConnectionSession } from "./github-app.routes";
import { repositorySelectionService } from "../domain/github-app/runtime";
import { RepositorySelectionService, SelectionError } from "../domain/github-app/selection";
import { GitHubAppError } from "../domain/github-app/errors";
import { analysisAvailable } from "../domain/jobs/runtime";

export function createRepositorySelectionRoutes(gate: RequestHandler, factory: () => RepositorySelectionService = repositorySelectionService) {
  const router = Router();
  const handle = (operation: "read" | "save" | "remove"): RequestHandler => async (req, res) => {
    try {
      const result = await suppressTracing(async () => {
        const service = factory(); const actor = res.locals.githubActor;
        // HTTP correlation IDs also allow readable strings; audit storage uses UUIDs.
        const auditId = z.uuid().safeParse(req.requestId).success ? req.requestId : randomUUID();
        if (operation === "save") return service.save(actor, req.body, auditId);
        if (operation === "remove") return service.remove(actor, req.params.grantId as string, auditId);
        return service.read(actor);
      });
      result.policy.analysisAvailable = analysisAvailable(res.locals.githubActor);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof SelectionError) { sendError(res, error.status, error.message, { code: error.code, retryable: error.status === 503 }); return; }
      if (error instanceof GitHubAppError) {
        const unavailable = ["provider_unavailable", "database_failure", "rate_limited"].includes(error.code);
        if (error.retryAfterSeconds) res.setHeader("Retry-After", error.retryAfterSeconds);
        sendError(res, unavailable ? 503 : 403, error.message, { code: unavailable ? "INTERNAL_ERROR" : "REPOSITORY_ACCESS_REVOKED", retryable: unavailable }); return;
      }
      sendError(res, 503, "Repository selection is temporarily unavailable.", { code: "INTERNAL_ERROR", retryable: true });
    }
  };
  // Owner reads and withdrawal stay available when intake is disabled.
  router.get("/repository-selections", requireConnectionSession, handle("read"));
  router.post("/repository-selections", gate, requireConnectionSession, handle("save"));
  router.delete("/repository-selections/:grantId", requireConnectionSession, handle("remove"));
  return router;
}
