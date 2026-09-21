import { Router, type RequestHandler } from "express";
import { suppressTracing } from "@sentry/node";
import { sendError, sendSuccess } from "../lib/response";
import { requireConnectionSession } from "./github-app.routes";
import { JobError, type ExecutionPolicy } from "../domain/jobs/policy";
import { ReportReadError } from "../domain/readiness/reader";
import { rescanService } from "../domain/rescans/runtime";
import type { RescanService } from "../domain/rescans/service";
import { analysisAvailable, productionHandlers } from "../domain/jobs/runtime";
import { env } from "../config/env";

export interface RescanRouteServices { service(): RescanService; available(actor: string): boolean; policy(): ExecutionPolicy | null; maxRepositories: number }
export function createRescanRoutes(gate: RequestHandler, services: RescanRouteServices = {
  service: rescanService, available: actor => !!env.featureOne?.flags.rescansEnabled && analysisAvailable(actor),
  policy: () => productionHandlers()?.policy ?? null, maxRepositories: env.featureOne?.maxRepositories ?? 5,
}) {
  const router = Router();
  const handler = (op: "focus" | "saveFocus" | "start" | "history" | "compare" | "availability"): RequestHandler => async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store"); res.setHeader("Referrer-Policy", "no-referrer");
    try {
      const actor = res.locals.githubActor, report = String(req.params.reportId);
      const result = await suppressTracing(async () => {
        if (op === "availability") return { available: services.available(actor) };
        const service = services.service();
        if (op === "focus") return service.focus(actor, report);
        if (op === "saveFocus") return service.focus(actor, report, req.body);
        if (op === "start") {
          if (!services.available(actor)) throw new JobError("FEATURE_NOT_IMPLEMENTED");
          const policy = services.policy(); if (!policy) throw new JobError("FEATURE_NOT_IMPLEMENTED");
          return service.start(actor, report, req.body, policy, services.maxRepositories);
        }
        const query: Record<string, unknown> = { ...req.query };
        for (const key of ["limit", "offset"]) if (query[key] !== undefined) {
          if (typeof query[key] !== "string" || !/^\d{1,5}$/.test(query[key])) throw new JobError("INVALID_REQUEST"); query[key] = Number(query[key]);
        }
        return op === "history" ? service.history(actor, report, query) : service.compare(actor, report, query);
      });
      res.status(op === "start" && "state" in result && result.state === "queued" ? 202 : 200); sendSuccess(res, result);
    } catch (error) {
      const code = error instanceof JobError || error instanceof ReportReadError ? error.code : "DATABASE_FAILURE";
      sendError(res, code === "NOT_FOUND" ? 404 : code === "INVALID_REQUEST" || code === "CONSENT_REQUIRED" ? 400 : code === "REPOSITORY_ACCESS_REVOKED" || code === "FORBIDDEN" ? 403
        : ["IDEMPOTENCY_CONFLICT", "ANALYSIS_ALREADY_RUNNING"].includes(code) ? 409 : 503,
      code === "NOT_FOUND" ? "The report or comparison is unavailable. It may have been deleted or belong to another account."
        : code === "REPOSITORY_ACCESS_REVOKED" ? "Repository access changed. Review your saved selection before rescanning."
          : code === "IDEMPOTENCY_CONFLICT" ? "This request key was already used. Review the selected repositories and try a new request."
            : code === "INVALID_REQUEST" ? "Invalid role focus or rescan request."
              : code === "FEATURE_NOT_IMPLEMENTED" ? "New rescans are unavailable. Your saved reports remain readable."
                : "This operation could not complete. Your saved reports have not changed. Try again.", { code, retryable: code === "DATABASE_FAILURE" || code === "PROVIDER_FAILURE" });
    }
  };
  router.get("/readiness-reports/:reportId/focus", requireConnectionSession, handler("focus"));
  router.put("/readiness-reports/:reportId/focus", requireConnectionSession, handler("saveFocus"));
  router.get("/readiness-reports/:reportId/rescans/availability", requireConnectionSession, handler("availability"));
  router.get("/readiness-reports/:reportId/rescans", requireConnectionSession, handler("history"));
  router.post("/readiness-reports/:reportId/rescans", gate, requireConnectionSession, handler("start"));
  router.get("/readiness-reports/:reportId/comparisons", gate, requireConnectionSession, handler("compare"));
  return router;
}
