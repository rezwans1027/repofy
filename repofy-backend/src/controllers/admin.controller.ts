import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendSuccess, sendError } from "../lib/response";

export const getUsageStats: RequestHandler = async (_req, res) => {
  const supabase = getSupabaseAdmin();

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from("api_usage")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("api_usage")
      .select("*", { count: "exact", head: true }),
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

  sendSuccess(res, {
    summary: {
      totalRequests: count ?? data.length,
      recentRequests: data.length,
      recentTokens,
      recentCost: `$${recentCost.toFixed(4)}`,
    },
    requests: data,
  });
};
