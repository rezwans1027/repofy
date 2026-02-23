import { RequestHandler } from "express";
import { getSupabaseAdmin } from "../config/supabase";
import { sendSuccess, sendError } from "../lib/response";

export const getUsageStats: RequestHandler = async (_req, res) => {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("api_usage")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    sendError(res, 500, "Failed to fetch usage data");
    return;
  }

  const totalCost = data.reduce(
    (sum: number, row: { estimated_cost: number | null }) =>
      sum + (row.estimated_cost ?? 0),
    0,
  );
  const totalRequests = data.length;
  const totalTokens = data.reduce(
    (sum: number, row: { total_tokens: number }) => sum + row.total_tokens,
    0,
  );

  sendSuccess(res, {
    summary: {
      totalRequests,
      totalTokens,
      totalCost: `$${totalCost.toFixed(4)}`,
    },
    requests: data,
  });
};
