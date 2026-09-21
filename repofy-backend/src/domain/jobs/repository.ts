import { z } from "zod";
import { AnalysisJobResponseSchema, ReadinessReportResponseSchema, StartAnalysisRequestSchema } from "@repofy/contracts";
import { EvidenceRepository, type FeatureOneRpcClient, type SnapshotBundle } from "../analysis/persistence";
import { canonicalAnalysisRequest } from "../analysis/request";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import { bounded } from "../ingestion/errors";
import { ExecutionPolicySchema, JOB_CODES, JobError, type ExecutionPolicy, type JobCode, type WorkStage } from "./policy";

export const ClaimSchema = z.strictObject({ jobId: z.uuid(), actor: z.uuid(), token: z.uuid(), attemptId: z.uuid(),
  request: StartAnalysisRequestSchema, policy: ExecutionPolicySchema });
export type Claim = z.infer<typeof ClaimSchema>;
const synthesisSchema = z.discriminatedUnion("state", [z.strictObject({ state: z.literal("reserved") }),
  z.strictObject({ state: z.literal("uncertain") }), z.strictObject({ state: z.literal("ready"), draft: ReadinessReportResponseSchema })]);
export class JobRepository {
  constructor(readonly db: FeatureOneRpcClient) {}
  async call(name: string, args: Record<string, unknown> = {}) {
    let result;
    try { result = await bounded(this.db.rpc(`feature_one_job_${name}`, args), 5000, "DATABASE_FAILURE"); }
    catch { throw new JobError("DATABASE_FAILURE"); }
    if (result.error) {
      const code = result.error.message;
      if (["VERSION_MISMATCH", "FOREIGN_EVIDENCE", "INCOMPLETE_ANALYSIS", "UNSUPPORTED_CLAIM", "INVALID_TRANSITION"].includes(code ?? "")
        || ["23503", "23505", "23514"].includes(result.error.code ?? "")) throw new JobError("ANALYSIS_VALIDATION_FAILED");
      throw new JobError(JOB_CODES.includes(code as JobCode) ? code as JobCode : "DATABASE_FAILURE");
    }
    return result.data;
  }
  async start(actor: string, input: unknown, policy: ExecutionPolicy, limit: number, requestId: string) {
    let canonical;
    try { canonical = canonicalAnalysisRequest(input); policy = ExecutionPolicySchema.parse(policy); }
    catch { throw new JobError("INVALID_REQUEST"); }
    const role = canonical.request.targetRoleTemplate;
    if (role && !policy.versions.roleRubrics.some(r => r.roleId === role.roleId && r.version === role.version)) throw new JobError("INVALID_REQUEST");
    const jobId = z.uuid().parse(await this.call("start", { p_actor: actor, p_request: canonical.request, p_hash: canonical.requestHash,
      p_policy: policy, p_limit: limit, p_request_id: requestId }));
    return this.read(actor, jobId);
  }
  async read(actor: string, jobId: string) {
    const data = await this.call("read", { p_actor: actor, p_job: jobId });
    if (data === null) throw new JobError("NOT_FOUND");
    return AnalysisJobResponseSchema.parse(data);
  }
  async list(actor: string) { return z.array(AnalysisJobResponseSchema).parse(await this.call("list", { p_actor: actor })); }
  async retry(actor: string, jobId: string) { await this.call("retry", { p_actor: actor, p_job: jobId }); return this.read(actor, jobId); }
  async cancel(actor: string, jobId: string, requestId: string) {
    await this.read(actor, jobId);
    await new EvidenceRepository(this.db).cancelJob(actor, jobId, requestId);
    return this.read(actor, jobId);
  }
  async delete(actor: string, jobId: string, requestId: string) { await new EvidenceRepository(this.db).deleteAnalysis(actor, jobId, requestId); }
  async claim() { const raw = await this.call("claim"); return raw === null ? null : ClaimSchema.parse(raw); }
  args(c: Claim) { return { p_job: c.jobId, p_token: c.token }; }
  async heartbeat(c: Claim) { await this.call("heartbeat", this.args(c)); }
  async stage(c: Claim, stage: WorkStage) { await this.call("stage", { ...this.args(c), p_stage: stage }); }
  async fail(c: Claim, code: JobCode) { await this.call("fail", { ...this.args(c), p_code: code }); }
  async maintain() { return z.number().int().parse(await this.call("maintain")); }
  async snapshot(c: Claim, repositoryId: string) {
    return z.uuid().nullable().parse(await this.call("snapshot", { ...this.args(c), p_repository: repositoryId }));
  }
  async reuseSnapshot(c: Claim, repositoryId: string, apply = false) {
    return z.uuid().nullable().parse(await this.call("reuse_snapshot", { ...this.args(c), p_repository: repositoryId, p_apply: apply }));
  }
  async storeSnapshot(c: Claim, bundle: SnapshotBundle, crypto: LocatorCrypto) {
    // Reuse the existing strict validation/encryption boundary; SQL derives the authorized grant.
    const scoped: FeatureOneRpcClient = { rpc: async (name, args) => {
      if (name !== "feature_one_store_snapshot") throw new JobError("INVALID_REQUEST");
      try {
        const data = await this.call("snapshot", { ...this.args(c), p_repository: bundle.snapshot.repositoryId, p_bundle: args.p_bundle });
        return { data, error: null };
      } catch (error) { return { data: null, error: { message: error instanceof JobError ? error.code : "DATABASE_FAILURE" } }; }
    } };
    return new EvidenceRepository(scoped).storeSnapshot(c.actor, c.jobId, bundle, crypto);
  }
  async run(c: Claim, snapshots: string[]) {
    return z.strictObject({ runId: z.uuid(), attemptId: z.uuid() }).parse(await this.call("run", { ...this.args(c), p_snapshots: snapshots }));
  }
  async synthesis(c: Claim, inputHash: string, draft?: unknown) {
    return synthesisSchema.parse(await this.call("synthesis", { ...this.args(c), p_hash: inputHash,
      ...(draft === undefined ? {} : { p_draft: ReadinessReportResponseSchema.parse(draft) }) }));
  }
  async complete(c: Claim) { return z.uuid().parse(await this.call("complete", this.args(c))); }
  ingestionClient(c: Claim): FeatureOneRpcClient {
    return { rpc: async (name, args) => {
      const operation = name.replace(/^feature_one_ingestion_/, "");
      // Disposal is confined to the caller's ingestion UUID/token and must work after cancellation.
      if (operation === "dispose") return this.db.rpc(name, args);
      if (!["access", "read", "pin", "begin", "checkpoint", "ready"].includes(operation)) throw new JobError("INVALID_REQUEST");
      try { return { data: await this.call("ingestion", { ...this.args(c), p_operation: operation, p_args: args }), error: null }; }
      catch (error) { return { data: null, error: { message: error instanceof JobError && error.code === "REPOSITORY_ACCESS_REVOKED" ? "ACCESS_REVOKED" : error instanceof JobError ? error.code : "DATABASE_FAILURE" } }; }
    } };
  }
}
