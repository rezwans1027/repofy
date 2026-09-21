import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { suppressTracing } from "@sentry/node";
import { z } from "zod";
import { ReportReadError, type ReadinessReader } from "../domain/readiness/reader";
import { readinessReader } from "../domain/readiness/runtime";
import { requireConnectionSession } from "./github-app.routes";
import { sendError, sendSuccess } from "../lib/response";

export function createReadinessRoutes(factory: () => ReadinessReader = readinessReader) {
  const router = Router();
  router.use("/readiness-reports", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store"); res.setHeader("Referrer-Policy", "no-referrer"); next();
  }, requireConnectionSession);
  const handle = (op: "history" | "view" | "report" | "evidence" | "location" | "improvement" | "delete" | "event"): RequestHandler => async (req, res) => {
    try {
      const result = await suppressTracing(async () => {
        const reader = factory(), actor = res.locals.githubActor, report = String(req.params.reportId ?? "");
        const query: Record<string, unknown> = { ...req.query };
        if (query.limit !== undefined) {
          const value = z.string().regex(/^\d{1,3}$/).safeParse(query.limit);
          if (!value.success) throw new ReportReadError("INVALID_REQUEST"); query.limit = Number(value.data);
        }
        if (op === "history") return reader.history(actor, query);
        if (op === "view") return reader.view(actor, report);
        if (op === "report") return (await reader.view(actor, report)).report;
        if (op === "evidence") return reader.evidence(actor, report, req.params.evidenceId ? { evidenceId: req.params.evidenceId } : query);
        if (op === "location") return reader.location(actor, report, String(req.params.evidenceId));
        if (op === "improvement") return reader.improvement(actor, report, String(req.params.improvementId));
        if (op === "delete") return reader.remove(actor, report, randomUUID());
        return reader.event(actor, report, req.body, randomUUID());
      });
      sendSuccess(res, result);
    } catch (error) {
      const code = error instanceof ReportReadError ? error.code : "DATABASE_FAILURE";
      sendError(res, code === "NOT_FOUND" ? 404 : code === "INVALID_REQUEST" ? 400 : code === "REPOSITORY_ACCESS_REVOKED" ? 403 : 503,
        code === "NOT_FOUND" ? "Report or evidence not found." : code === "INVALID_REQUEST" ? "Invalid report request."
          : code === "REPOSITORY_ACCESS_REVOKED" ? "Repository access changed. Reconnect GitHub to inspect locations."
            : "Saved reports are temporarily unavailable. Try again.", { code, retryable: code === "DATABASE_FAILURE" });
    }
  };
  router.get("/readiness-reports", handle("history"));
  router.get("/readiness-reports/:reportId", handle("report"));
  router.get("/readiness-reports/:reportId/view", handle("view"));
  router.get(["/readiness-reports/:reportId/evidence", "/readiness-reports/:reportId/evidence/:evidenceId"], handle("evidence"));
  router.post("/readiness-reports/:reportId/evidence/:evidenceId/location", handle("location"));
  router.get("/readiness-reports/:reportId/improvements/:improvementId", handle("improvement"));
  router.post("/readiness-reports/:reportId/events", handle("event"));
  router.delete("/readiness-reports/:reportId", handle("delete"));
  return router;
}
