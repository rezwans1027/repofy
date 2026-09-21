import { Router, type RequestHandler } from "express";
import { suppressTracing } from "@sentry/node";
import { requireConnectionSession } from "./github-app.routes";
import { requireAdminKey } from "../middleware/adminAuth";
import { adminRateLimit } from "../middleware/rateLimit";
import { getSupabaseAdmin } from "../config/supabase";
import { sendError, sendSuccess } from "../lib/response";
import { JobError } from "../domain/jobs/policy";
import { FindingFeedbackService } from "../domain/feedback/service";
export function createFindingFeedbackRoutes(gate: RequestHandler, enabled: () => boolean, factory = () => new FindingFeedbackService(getSupabaseAdmin())) {
  const router = Router();
  const handle = (op: "read" | "save" | "queue" | "review"): RequestHandler => async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store"); res.setHeader("Referrer-Policy", "no-referrer");
    try {
      const data = await suppressTracing(async () => {
        const service = factory(), actor = res.locals.githubActor;
        if (op === "review") return service.review(actor, String(req.params.feedbackId), req.body);
        if (op === "queue") {
          const query: Record<string, unknown> = { ...req.query };
          if (query.limit !== undefined) { if (typeof query.limit !== "string" || !/^\d{1,2}$/.test(query.limit)) throw new JobError("INVALID_REQUEST"); query.limit = Number(query.limit); }
          return service.queue(actor, query);
        }
        return { feedback: await service.feedback(actor, String(req.params.reportId), { kind: req.params.kind, id: req.params.findingId }, op === "save" ? req.body : undefined), writable: enabled() };
      }); sendSuccess(res, data);
    } catch (error) {
      const code = error instanceof JobError ? error.code : "DATABASE_FAILURE";
      sendError(res, code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : code === "INVALID_REQUEST" ? 400 : code === "IDEMPOTENCY_CONFLICT" ? 409 : 503,
        code === "NOT_FOUND" ? "This finding or feedback is unavailable." : code === "FORBIDDEN" ? "Review access is unavailable."
          : code === "IDEMPOTENCY_CONFLICT" ? "Feedback changed. Reload the current response before editing."
            : code === "INVALID_REQUEST" ? "Use a supported choice and a short comment without credentials or personal details." : "Feedback could not be confirmed. Try again.", { code, retryable: code === "DATABASE_FAILURE" });
    }
  };
  const path = "/readiness-reports/:reportId/findings/:kind/:findingId/feedback";
  router.get(path, requireConnectionSession, handle("read"));
  router.post(path, gate, requireConnectionSession, handle("save"));
  // Existing constant-time secret check is necessary but insufficient: also require
  // a real session and an active database reviewer grant. No private free text/source.
  router.get("/finding-feedback/review", adminRateLimit, requireAdminKey, requireConnectionSession, handle("queue"));
  router.post("/finding-feedback/review/:feedbackId", adminRateLimit, requireAdminKey, requireConnectionSession, handle("review"));
  return router;
}
