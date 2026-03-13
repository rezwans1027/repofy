import { RequestHandler } from "express";
import { getUsageStats } from "../services/admin.service";
import { sendSuccess, sendError } from "../lib/response";

export const handleGetUsageStats: RequestHandler = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));

  try {
    const stats = await getUsageStats(page, limit);
    sendSuccess(res, stats);
  } catch {
    sendError(res, 500, "Failed to fetch usage data");
  }
};
