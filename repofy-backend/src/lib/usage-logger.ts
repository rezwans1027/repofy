import { env } from "../config/env";
import { getSupabaseAdmin } from "../config/supabase";
import { logger } from "./logger";

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Pricing per 1M tokens (USD) — update when model pricing changes
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.2": { input: 1.75, output: 14 },
  "gpt-5.1": { input: 2, output: 12 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
};

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}

/* ------------------------------------------------------------------ */
/*  Spending-cap circuit breaker                                      */
/* ------------------------------------------------------------------ */

/** Rolling 24-hour cost cached in memory. Refreshed from Supabase periodically. */
let _rollingCost = 0;
let _rollingCostFetchedAt = 0;
const ROLLING_COST_TTL_MS = 60_000; // refresh from DB at most once per minute

async function fetchRolling24hCost(): Promise<number> {
  const now = Date.now();
  if (now - _rollingCostFetchedAt < ROLLING_COST_TTL_MS) return _rollingCost;

  try {
    const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await getSupabaseAdmin()
      .from("api_usage")
      .select("estimated_cost")
      .gte("created_at", since);

    if (error) {
      logger.error("Failed to fetch rolling 24h cost", error.message);
      return _rollingCost; // fallback to stale value
    }

    _rollingCost = (data ?? []).reduce(
      (sum, row) => sum + ((row as { estimated_cost: number | null }).estimated_cost ?? 0),
      0,
    );
    _rollingCostFetchedAt = now;
  } catch (err) {
    logger.error("Unhandled error fetching rolling 24h cost", err);
  }

  return _rollingCost;
}

/**
 * Check whether the daily AI spending cap has been exceeded.
 * Returns `true` if it's safe to proceed, `false` if the cap is breached.
 */
export async function checkSpendingCap(): Promise<boolean> {
  const cap = env.dailyAiSpendingCap;
  if (cap <= 0) return true; // cap disabled

  const rolling = await fetchRolling24hCost();
  if (rolling >= cap) {
    logger.warn(
      `AI spending cap breached — rolling 24h cost $${rolling.toFixed(4)} >= cap $${cap.toFixed(2)}. Rejecting engine call.`,
    );
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */

export function logTokenUsage(
  endpoint: string,
  model: string,
  usage: TokenUsage | undefined,
): void {
  if (!usage) {
    logger.warn(`[${endpoint}] OpenAI response missing usage data`);
    return;
  }

  const cost = estimateCost(model, usage.prompt_tokens, usage.completion_tokens);

  logger.info(
    `[${endpoint}] OpenAI usage — model: ${model}, ` +
      `prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, ` +
      `total: ${usage.total_tokens}` +
      (cost !== null ? `, est. cost: $${cost.toFixed(4)}` : ""),
  );

  // Update in-memory rolling cost immediately so back-to-back calls are aware
  if (cost !== null) _rollingCost += cost;

  // Persist to Supabase (fire-and-forget, never block the response)
  Promise.resolve(
    getSupabaseAdmin()
      .from("api_usage")
      .insert({
        endpoint,
        model,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
        estimated_cost: cost,
      })
      .then(({ error }) => {
        if (error) logger.error("Failed to persist usage data", error.message);
      }),
  ).catch((err: unknown) => {
    logger.error("Unhandled error persisting usage data", err);
  });
}
