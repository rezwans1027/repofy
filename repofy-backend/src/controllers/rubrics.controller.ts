import type { RequestHandler } from "express";
import { KeySchema } from "@repofy/contracts";
import { getSupabaseAdmin } from "../config/supabase";
import { RubricRepository } from "../domain/rubrics/repository";
import { sendError, sendSuccess } from "../lib/response";

export const discoverRubrics: RequestHandler = async (req, res, next) => {
  const releaseId = req.params.releaseId;
  if (Object.keys(req.query).length || (releaseId !== undefined && !KeySchema.safeParse(releaseId).success)) {
    sendError(res, 400, "Invalid rubric request."); return;
  }
  try {
    const catalog = await new RubricRepository(getSupabaseAdmin()).read(req.userId!, releaseId);
    if (!catalog) {
      if (releaseId) sendError(res, 404, "Rubric release not found.");
      else sendError(res, 503, "Role rubric definitions are not available yet.", { code: "FEATURE_NOT_IMPLEMENTED", retryable: false });
      return;
    }
    sendSuccess(res, catalog);
  } catch (error) { next(error); }
};
