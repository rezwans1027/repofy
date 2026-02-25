import { createHash } from "crypto";
import { getSupabaseAdmin } from "../config/supabase";
import { logger } from "../lib/logger";
import type { GitHubUserData, ScorerResponse, ScoringResult } from "../types";

export interface CachedAnalysis {
  scorerResponse: ScorerResponse;
  scoringResult: ScoringResult;
  narrativeReport: string;
}

export function computeSnapshotHash(githubData: GitHubUserData): string {
  const payload = JSON.stringify({
    snapshots: githubData.repoSnapshots,
    topRepoNames: githubData.topRepositories.map((r) => r.name),
    stats: githubData.stats,
    languages: githubData.languages.slice(0, 8),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function buildCacheKey(model: string, rubricVersion: string, snapshotHash: string): string {
  return createHash("sha256")
    .update(`${model}:${rubricVersion}:${snapshotHash}`)
    .digest("hex");
}

export async function getCachedAnalysis(cacheKey: string): Promise<CachedAnalysis | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("analysis_cache")
      .select("scorer_response, scoring_result, narrative_report, expires_at")
      .eq("cache_key", cacheKey)
      .single();

    if (error || !data) return null;

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      return null;
    }

    return {
      scorerResponse: data.scorer_response as ScorerResponse,
      scoringResult: data.scoring_result as ScoringResult,
      narrativeReport: data.narrative_report as string,
    };
  } catch (err) {
    logger.warn("Cache lookup failed:", err);
    return null;
  }
}

export async function setCachedAnalysis(
  cacheKey: string,
  snapshotHash: string,
  model: string,
  rubricVersion: string,
  analysis: CachedAnalysis,
): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("analysis_cache")
      .upsert(
        {
          cache_key: cacheKey,
          snapshot_hash: snapshotHash,
          model,
          rubric_version: rubricVersion,
          scorer_response: analysis.scorerResponse,
          scoring_result: analysis.scoringResult,
          narrative_report: analysis.narrativeReport,
        },
        { onConflict: "cache_key" },
      );

    if (error) {
      logger.error("Failed to write analysis cache:", error.message);
    }
  } catch (err) {
    logger.warn("Cache write failed:", err);
  }
}

export async function cleanExpiredCache(): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("analysis_cache")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (error) {
      logger.error("Failed to clean expired cache:", error.message);
    }
  } catch (err) {
    logger.warn("Cache cleanup failed:", err);
  }
}
