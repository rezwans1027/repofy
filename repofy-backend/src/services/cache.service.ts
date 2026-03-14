import { createHash } from "crypto";
import { getSupabaseAdmin } from "../config/supabase";
import { logger } from "../lib/logger";
import { expiresInDays } from "../lib/date-utils";
import type { GitHubUserData, ScorerResponse, ScoringResult } from "../types";

export interface CachedAnalysis {
  scorerResponse: ScorerResponse;
  scoringResult: ScoringResult;
  narrativeReport: string;
}

/**
 * Simple in-memory LRU cache to avoid hitting Supabase on repeated lookups.
 * Entries are evicted after MEM_MAX_AGE_MS or when the cache exceeds
 * MEM_MAX_ENTRIES. A periodic sweep removes expired entries proactively
 * so stale data doesn't linger between access-time checks.
 *
 * This is per-process only, which is fine for a single Railway instance.
 *
 * TODO(scaling): For multi-replica deployments, consider a shared Redis
 * cache to improve cross-instance hit rates. The Supabase DB layer already
 * provides shared persistence, so this is an optimisation, not a correctness
 * concern.
 */
const MEM_MAX_ENTRIES = 64;
const MEM_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

interface MemEntry {
  data: CachedAnalysis;
  storedAt: number;
}

const memCache = new Map<string, MemEntry>();

// Periodic sweep of expired in-memory entries.
// Unref'd so it won't keep the process alive during shutdown.
const memCacheSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memCache) {
    if (now - entry.storedAt > MEM_MAX_AGE_MS) memCache.delete(key);
  }
}, MEM_MAX_AGE_MS);
memCacheSweepInterval.unref();

/** Clear the in-memory cache. Exposed for test isolation. */
export function clearMemCache(): void {
  memCache.clear();
}

function memGet(key: string): CachedAnalysis | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > MEM_MAX_AGE_MS) {
    memCache.delete(key);
    return null;
  }
  // Move to end for LRU ordering
  memCache.delete(key);
  memCache.set(key, entry);
  return entry.data;
}

function memSet(key: string, data: CachedAnalysis): void {
  if (memCache.size >= MEM_MAX_ENTRIES) {
    // Evict oldest entry (first key in Map iteration order)
    const oldest = memCache.keys().next().value;
    if (oldest !== undefined) memCache.delete(oldest);
  }
  memCache.set(key, { data, storedAt: Date.now() });
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
  // Check in-memory cache first to avoid a Supabase round-trip
  const cached = memGet(cacheKey);
  if (cached) return cached;

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

    const result: CachedAnalysis = {
      scorerResponse: data.scorer_response as ScorerResponse,
      scoringResult: data.scoring_result as ScoringResult,
      narrativeReport: data.narrative_report as string,
    };

    memSet(cacheKey, result);
    return result;
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
    const expiresAt = expiresInDays(1);

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
          expires_at: expiresAt,
        },
        { onConflict: "cache_key" },
      );

    if (error) {
      logger.error("Failed to write analysis cache:", error.message);
    } else {
      memSet(cacheKey, analysis);
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
