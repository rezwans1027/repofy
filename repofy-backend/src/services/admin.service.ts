import { getSupabaseAdmin } from "../config/supabase";

interface UsageRow {
  endpoint: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number | null;
  created_at: string;
}

export async function getUsageStats(page: number, limit: number) {
  const supabase = getSupabaseAdmin();
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
    throw new Error("Failed to fetch usage data");
  }

  const rows: UsageRow[] = Array.isArray(data) ? data : [];
  const recentCost = rows.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0);
  const recentTokens = rows.reduce((sum, row) => sum + row.total_tokens, 0);
  const totalCount = count ?? rows.length;

  return {
    summary: {
      totalRequests: totalCount,
      recentRequests: rows.length,
      recentTokens,
      recentCost: `$${recentCost.toFixed(4)}`,
    },
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
    requests: rows,
  };
}
