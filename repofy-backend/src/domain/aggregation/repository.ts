import { z } from "zod";
import { AggregationResultSchema, AggregationEvidenceQuerySchema, AggregationEvidencePageSchema } from "@repofy/contracts";
import { JobRepository } from "../jobs/repository";
import { JobError } from "../jobs/policy";
import type { StageContext } from "../jobs/worker";
import { AggregationInputSchema, canonical } from "./input";
import { aggregateEvidence } from "./engine";
import { AGGREGATION_POLICY } from "./policy";
import { ProvenanceService } from "../provenance/service";

export class AggregationRepository {
  constructor(private readonly jobs: JobRepository, private readonly provenance = new ProvenanceService(jobs)) {}
  async aggregate(context: StageContext): Promise<void> {
    await context.checkpoint();
    if (context.claim.policy.versions.aggregationPolicy.version === "1.1.0") await this.provenance.collect(context);
    const args = { ...this.jobs.args(context.claim), p_run: z.uuid().parse(context.runId) };
    const input = AggregationInputSchema.parse(await this.jobs.call("aggregation_input", args));
    if (input.runId !== context.runId || input.jobId !== context.claim.jobId || input.ownerUserId !== context.claim.actor ||
      canonical(input.versions) !== canonical(context.claim.policy.versions) ||
      canonical(input.snapshots.map(s => s.snapshotId).sort()) !== canonical([...context.snapshotIds].sort())) throw new JobError("ANALYSIS_VALIDATION_FAILED");
    const result = aggregateEvidence(input);
    await context.checkpoint();
    // Callers cannot submit their own scores. Recompute exclusively from fenced canonical database inputs.
    const saved = AggregationResultSchema.parse(await this.jobs.call("aggregation_store", { ...args, p_result: result }));
    if (canonical(saved) !== canonical(result)) throw new JobError("ANALYSIS_VALIDATION_FAILED");
  }
  async read(actor: string, runId: string) {
    const result = await this.jobs.call("aggregation_read", { p_actor: z.uuid().parse(actor), p_run: z.uuid().parse(runId) });
    return result === null ? null : AggregationResultSchema.parse(result);
  }
  async evidence(actor: string, runId: string, query: unknown = {}) {
    return AggregationEvidencePageSchema.parse(await this.jobs.call("aggregation_evidence", {
      p_actor: z.uuid().parse(actor), p_run: z.uuid().parse(runId), p_query: AggregationEvidenceQuerySchema.parse(query),
    }));
  }
}
export function createAggregation(jobs: JobRepository, provenance?: ProvenanceService) {
  const repository = new AggregationRepository(jobs, provenance);
  return { policy: { id: AGGREGATION_POLICY.id, version: AGGREGATION_POLICY.version }, aggregate: (context: StageContext) => repository.aggregate(context) };
}
