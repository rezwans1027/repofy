import { createHash } from "node:crypto";
import { ReadinessReportResponseSchema, type ReadinessReportResponse } from "@repofy/contracts";
import type { SnapshotBundle } from "../analysis/persistence";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import type { SafeSnapshotContext, SnapshotIngestionService } from "../ingestion/service";
import type { PinnedSnapshot } from "../ingestion/repository";
import { IngestionError } from "../ingestion/errors";
import { JobError, jobError, ExecutionPolicySchema, type ExecutionPolicy } from "./policy";
import { JobRepository, type Claim } from "./repository";

export interface StageContext {
  readonly claim: Claim; readonly runId: string; readonly snapshotIds: readonly string[]; readonly signal: AbortSignal;
  /** Each handler must call before additional provider work and use signal to cancel it. */
  checkpoint(): Promise<void>;
}
/** Checked-in trusted handlers only. No repository code, plugins, or input-selected imports. */
export interface AnalysisHandlers {
  readonly policy: ExecutionPolicy;
  extract(snapshot: SafeSnapshotContext, claim: Claim, signal: AbortSignal, pin: Readonly<PinnedSnapshot>): Promise<SnapshotBundle>;
  /** Persist deterministic, source-free run evidence via fenced RPCs. Must be idempotent. */
  aggregate(context: StageContext): Promise<void>;
  /** Return only a strict source-free report draft. Raw model output is never persisted. */
  synthesize(context: StageContext): Promise<ReadinessReportResponse>;
  validate(draft: ReadinessReportResponse, context: StageContext): Promise<void>;
}
export function handlersComplete(handlers: AnalysisHandlers | null): handlers is AnalysisHandlers {
  return !!handlers && ExecutionPolicySchema.safeParse(handlers.policy).success
    && [handlers.extract, handlers.aggregate, handlers.synthesize, handlers.validate].every(fn => typeof fn === "function");
}
export class AnalysisWorker {
  constructor(private readonly jobs: JobRepository, private readonly handlers: AnalysisHandlers | null | ((claim: Claim) => AnalysisHandlers | null),
    private readonly ingestion: (claim: Claim) => SnapshotIngestionService, private readonly crypto: () => LocatorCrypto) {}
  async once(shutdown?: AbortSignal): Promise<boolean> {
    if (shutdown?.aborted) return false;
    const claim = await this.jobs.claim(); if (!claim) return false;
    const controller = new AbortController(); const signal = controller.signal;
    const stop = () => controller.abort(new JobError("WORKER_EXPIRED"));
    shutdown?.addEventListener("abort", stop, { once: true }); if (shutdown?.aborted) stop();
    let timer: NodeJS.Timeout | undefined; let closed = false;
    const checkpoint = async () => { signal.throwIfAborted(); await this.jobs.heartbeat(claim); signal.throwIfAborted(); };
    const beat = async () => {
      try { await checkpoint(); if (!closed) timer = setTimeout(() => { void beat(); }, 15000); }
      catch (error) { controller.abort(jobError(error)); }
    };
    const deadline = setTimeout(stop, 15 * 60 * 1000); deadline.unref();
    try {
      const handlers = typeof this.handlers === "function" ? this.handlers(claim) : this.handlers;
      if (!handlersComplete(handlers) || JSON.stringify(ExecutionPolicySchema.parse(handlers.policy)) !== JSON.stringify(claim.policy)) throw new JobError("FEATURE_NOT_IMPLEMENTED");
      const ingestion = this.ingestion(claim);
      await checkpoint(); timer = setTimeout(() => { void beat(); }, 15000);
      const pins = new Map<string, PinnedSnapshot>();
      // Pin the complete selection before any extraction. No repository is silently omitted.
      for (const repositoryId of claim.request.repositoryIds) {
        await checkpoint(); pins.set(repositoryId, await ingestion.resolveSnapshot({ actor: claim.actor, jobId: claim.jobId, repositoryId }));
      }
      const snapshots: string[] = [];
      for (const repositoryId of claim.request.repositoryIds) {
        await checkpoint(); let snapshotId = await this.jobs.snapshot(claim, repositoryId);
        if (!snapshotId && await this.jobs.reuseSnapshot(claim, repositoryId)) {
          await ingestion.reauthorize({ actor: claim.actor, jobId: claim.jobId, repositoryId }, pins.get(repositoryId)!);
          await checkpoint(); snapshotId = await this.jobs.reuseSnapshot(claim, repositoryId, true);
        }
        if (!snapshotId) {
          const request = { actor: claim.actor, jobId: claim.jobId, repositoryId };
          snapshotId = await ingestion.withSafeSnapshot(request, async snapshot => {
            await checkpoint();
            await this.jobs.stage(claim, "extracting");
            const pin = Object.freeze(pins.get(repositoryId)!);
            const bundle = await handlers.extract(snapshot, claim, signal, pin);
            if (bundle.snapshot.repositoryId !== repositoryId || bundle.snapshot.branch !== pin.branch
              || bundle.snapshot.commitSha !== pin.commitSha || bundle.snapshot.providerRepositoryId !== pin.providerRepositoryId
              || bundle.snapshot.repositoryVisibility !== pin.repositoryVisibility) throw new JobError("ANALYSIS_VALIDATION_FAILED");
            await checkpoint(); return this.jobs.storeSnapshot(claim, bundle, this.crypto());
          }, signal, async stage => {
            try { await this.jobs.stage(claim, stage); }
            catch (error) { const code = jobError(error).code;
              throw new IngestionError(code === "REPOSITORY_ACCESS_REVOKED" ? "ACCESS_REVOKED" : code === "LEASE_LOST" ? "LEASE_LOST" : "DATABASE_FAILURE"); }
          });
        }
        snapshots.push(snapshotId);
      }
      const { runId } = await this.jobs.run(claim, snapshots);
      const context: StageContext = { claim, runId, snapshotIds: Object.freeze(snapshots), signal, checkpoint };
      // Identity is private and scoped to the logical job; never a cross-owner result cache.
      const inputHash = `sha256:${createHash("sha256").update(JSON.stringify({ job: claim.jobId, snapshots: [...snapshots].sort(),
        policy: claim.policy, options: { metadata: claim.request.includeMetadata, role: claim.request.targetRoleTemplate ?? null } })).digest("hex")}`;
      await this.jobs.stage(claim, "aggregating"); await handlers.aggregate(context); await checkpoint();
      await this.jobs.stage(claim, "synthesizing");
      let result = await this.jobs.synthesis(claim, inputHash);
      if (result.state === "uncertain") throw new JobError("MODEL_OUTCOME_UNKNOWN");
      if (result.state === "reserved") {
        const draft = ReadinessReportResponseSchema.parse(await handlers.synthesize(context));
        await checkpoint(); result = await this.jobs.synthesis(claim, inputHash, draft);
      }
      if (result.state !== "ready") throw new JobError("MODEL_OUTCOME_UNKNOWN");
      await this.jobs.stage(claim, "validating"); await handlers.validate(result.draft, context); await checkpoint();
      await this.jobs.complete(claim);
    } catch (error) {
      // Unknown exceptions never carry source/provider/model text into storage or telemetry.
      const safe = jobError(signal.aborted ? signal.reason : error);
      await this.jobs.fail(claim, safe.code).catch(() => undefined); // DB outage/lost lease: scheduled recovery owns it.
    } finally { closed = true; clearTimeout(timer); clearTimeout(deadline); controller.abort(); shutdown?.removeEventListener("abort", stop); }
    return true;
  }
}
