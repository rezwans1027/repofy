import { getSupabaseAdmin } from "../config/supabase";
import { logger } from "./logger";

interface TokenUsage {
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
