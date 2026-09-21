import { setTimeout as delay } from "node:timers/promises";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import { bounded } from "../ingestion/errors";
import type { WorkspaceManager } from "../ingestion/workspace";
import type { JobRepository } from "./repository";

export async function maintenance(jobs: JobRepository, workspaces: WorkspaceManager, db: FeatureOneRpcClient) {
  // Each operation proceeds even if another fails. Absolute filesystem TTL works during DB outage.
  const results = await Promise.allSettled([
    jobs.maintain(),
    bounded(db.rpc("feature_one_feedback_prune", {}), 5000, "DATABASE_FAILURE").then(result => { if (result.error) throw new Error("DATABASE_FAILURE"); }),
    workspaces.sweep(async attempt => {
      const result = await bounded(db.rpc("feature_one_ingestion_claim_expired", { p_attempt: attempt }), 5000, "DATABASE_FAILURE");
      if (result.error) throw new Error("DATABASE_FAILURE"); return result.data === true;
    }),
    bounded(db.rpc("feature_one_prune_retention", {}), 5000, "DATABASE_FAILURE").then(result => { if (result.error) throw new Error("DATABASE_FAILURE"); }),
  ]);
  return { failed: results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && typeof r.value === "object" && r.value && "failed" in r.value && r.value.failed > 0)).length };
}
export async function schedule(task: () => Promise<unknown>, intervalMs: number, signal: AbortSignal, failed: () => void) {
  while (!signal.aborted) {
    try { await task(); } catch { failed(); }
    await delay(intervalMs, undefined, { signal }).catch(() => undefined);
  }
}
