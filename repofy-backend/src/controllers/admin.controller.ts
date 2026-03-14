import { RequestHandler } from "express";
import { getUsageStats } from "../services/admin.service";
import { sendSuccess, sendError } from "../lib/response";

export const handleGetUsageStats: RequestHandler = async (req, res) => {
  const rawPage = req.query.page ? parseInt(String(req.query.page), 10) : NaN;
  const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : NaN;
  const page = !Number.isNaN(rawPage) ? Math.max(1, rawPage) : 1;
  const limit = !Number.isNaN(rawLimit) ? Math.min(200, Math.max(1, rawLimit)) : 50;

  try {
    const stats = await getUsageStats(page, limit);
    sendSuccess(res, stats);
  } catch {
    sendError(res, 500, "Failed to fetch usage data");
  }
};
