import { z } from "zod";
import { ProvenanceAssessmentSchema, type SnapshotProvenance } from "@repofy/contracts";
import type { StageContext } from "../jobs/worker";
import type { JobRepository } from "../jobs/repository";
import { JobError } from "../jobs/policy";
import { GitHubAppError } from "../github-app/errors";
import type { GitHubConnectionService } from "../github-app/service";
import { bounded } from "../ingestion/errors";
import { observeProvenance, ProvenanceContextSchema } from "./policy";
export class ProvenanceService {
  constructor(private readonly jobs: JobRepository, private readonly provider?: Pick<GitHubConnectionService, "verifyRepository">) {}
  async collect(context: StageContext) {
    const args = { ...this.jobs.args(context.claim), p_run: context.runId };
    await context.checkpoint();
    const input = z.strictObject({ prior: ProvenanceAssessmentSchema.nullable(), snapshots: z.array(ProvenanceContextSchema).min(1).max(10) }).parse(await this.jobs.call("provenance_context", args));
    if (input.prior) return;
    const snapshots: SnapshotProvenance[] = [];
    for (const snapshot of input.snapshots) {
      let provider: SnapshotProvenance["provider"] = { state: "unavailable", fork: null, templateOrigin: "unknown", relationship: "current_repository_context" };
      await context.checkpoint();
      if (this.provider) try {
        const { item } = await bounded(this.provider.verifyRepository(context.claim.actor, snapshot.accountId, snapshot.installationId, snapshot.repositoryId), 15000);
        if (item.id !== snapshot.providerRepositoryId || (item.private ? "private" : "public") !== snapshot.visibility || item.archived) throw new JobError("REPOSITORY_ACCESS_REVOKED");
        provider = { state: "available", fork: item.fork ?? null, templateOrigin: item.template_repository ? "declared" : "unknown", relationship: "current_repository_context" };
      } catch (error) {
        if (error instanceof JobError) throw error;
        if (error instanceof GitHubAppError && error.code === "database_failure") throw new JobError("DATABASE_FAILURE");
        if (error instanceof GitHubAppError && ["access_changed", "reconnect_required", "identity_conflict", "installation_missing", "installation_suspended", "insufficient_permissions", "pending_approval", "not_found"].includes(error.code)) throw new JobError("REPOSITORY_ACCESS_REVOKED");
      }
      await context.checkpoint(); snapshots.push(observeProvenance(snapshot, provider, new Date().toISOString()));
    }
    const result = ProvenanceAssessmentSchema.parse({ policy: { id: "provenance_context", version: "1.0.0" }, snapshots });
    await context.checkpoint(); ProvenanceAssessmentSchema.parse(await this.jobs.call("provenance_store", { ...args, p_result: result }));
  }
}
