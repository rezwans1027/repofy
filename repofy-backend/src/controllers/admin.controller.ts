import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendSuccess, sendError } from "../lib/response";

export const getUsageStats: RequestHandler = async (req, res) => {
  const supabase = getSupabaseAdmin();

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("api_usage")
      .select("endpoint, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from("api_usage")
      .select("id", { count: "exact", head: true }),
  ]);

  if (error || countError) {
    sendError(res, 500, "Failed to fetch usage data");
    return;
  }

  const recentCost = data.reduce(
    (sum: number, row: { estimated_cost: number | null }) =>
      sum + (row.estimated_cost ?? 0),
    0,
  );
  const recentTokens = data.reduce(
    (sum: number, row: { total_tokens: number }) => sum + row.total_tokens,
    0,
  );

  const totalCount = count ?? data.length;
  sendSuccess(res, {
    summary: {
      totalRequests: totalCount,
      recentRequests: data.length,
      recentTokens,
      recentCost: `$${recentCost.toFixed(4)}`,
    },
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
    requests: data,
  });
};
