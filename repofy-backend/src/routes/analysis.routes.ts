import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { suppressTracing } from "@sentry/node";
import { z } from "zod";
import { sendError, sendSuccess } from "../lib/response";
import { requireConnectionSession } from "./github-app.routes";
import { JobRepository } from "../domain/jobs/repository";
import { JobError, type ExecutionPolicy } from "../domain/jobs/policy";
import { analysisAvailable, jobRepository, productionHandlers } from "../domain/jobs/runtime";
import { env } from "../config/env";

export interface AnalysisRouteServices { jobs(): JobRepository; available(actor: string): boolean; policy(): ExecutionPolicy | null; maxRepositories: number }
export function createAnalysisRoutes(gate: RequestHandler, services: AnalysisRouteServices = {
  jobs: jobRepository, available: analysisAvailable, policy: () => productionHandlers()?.policy ?? null, maxRepositories: env.featureOne?.maxRepositories ?? 5,
}) {
  const router = Router();
  const handler = (op: "start" | "read" | "list" | "cancel" | "retry" | "delete"): RequestHandler => async (req, res) => {
    try {
      const actor = res.locals.githubActor;
      const result = await suppressTracing(async () => {
        if (op === "start") {
          const policy = services.policy();
          if (!services.available(actor) || !policy) throw new JobError("FEATURE_NOT_IMPLEMENTED");
          return services.jobs().start(actor, req.body, policy, services.maxRepositories, randomUUID());
        }
        const jobs = services.jobs();
        if (op === "list") return jobs.list(actor);
        const id = z.uuid().safeParse(req.params.jobId ?? req.params.reportId);
        if (!id.success) throw new JobError("INVALID_REQUEST");
        if (op === "read") return jobs.read(actor, id.data);
        if (op === "retry") return jobs.retry(actor, id.data);
        if (op === "cancel") return jobs.cancel(actor, id.data, randomUUID());
        if (op === "delete") { await jobs.delete(actor, id.data, randomUUID()); return { deleted: true }; }
      });
      res.status(op === "start" ? 202 : 200); sendSuccess(res, result);
    } catch (error) {
      const code = error instanceof JobError ? error.code : "DATABASE_FAILURE";
      const status = code === "NOT_FOUND" ? 404 : code === "INVALID_REQUEST" || code === "CONSENT_REQUIRED" ? 400
        : code === "FORBIDDEN" || code === "REPOSITORY_ACCESS_REVOKED" ? 403 : code === "FEATURE_NOT_IMPLEMENTED" ? 501
          : code === "DATABASE_FAILURE" ? 503 : 409;
      const message = code === "FEATURE_NOT_IMPLEMENTED" ? "Analysis is not available yet. Your saved selection is retained."
        : code === "REPOSITORY_ACCESS_REVOKED" ? "Repository access changed. Refresh your saved selection."
          : code === "IDEMPOTENCY_CONFLICT" ? "This request key was already used for different analysis options."
            : code === "RETRY_NOT_ALLOWED" ? "This analysis cannot be retried. Start a new analysis from your saved selection."
              : code === "NOT_FOUND" ? "Analysis not found." : code === "DATABASE_FAILURE" ? "Analysis is temporarily unavailable. Try again."
                : "The analysis request could not be accepted.";
      sendError(res, status, message, { code, retryable: code === "DATABASE_FAILURE" });
    }
  };
  router.get("/analyses/availability", requireConnectionSession, (_req, res) => sendSuccess(res, { available: services.available(res.locals.githubActor) }));
  router.post("/analyses", gate, requireConnectionSession, handler("start"));
  router.get("/analyses", requireConnectionSession, handler("list"));
  router.get("/analyses/:jobId", requireConnectionSession, handler("read"));
  router.post("/analyses/:jobId/cancel", requireConnectionSession, handler("cancel"));
  router.post("/analyses/:jobId/retry", requireConnectionSession, handler("retry"));
  router.delete("/analyses/:jobId", requireConnectionSession, handler("delete"));
  return router;
}
