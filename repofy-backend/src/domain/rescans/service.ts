import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ComparisonQuerySchema, RescanRequestSchema, RescanResponseSchema, RescanHistorySchema, RescanHistoryQuerySchema,
  RoleFocusRequestSchema, RoleTemplateReferenceSchema, type ReportView } from "@repofy/contracts";
import type { FeatureOneRpcClient } from "../analysis/persistence";
import type { SnapshotSource } from "../ingestion/source";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import { bounded } from "../ingestion/errors";
import { canonical } from "../aggregation/input";
import { JobRepository } from "../jobs/repository";
import { JobError, JOB_CODES, jobError, ExecutionPolicySchema, type ExecutionPolicy, type JobCode } from "../jobs/policy";
import { projectReportView, type ReadinessReader } from "../readiness/reader";
import { roleFocus } from "./focus";
import { ComparisonFactSchema, compareReports } from "./comparison";

const accessSchema = z.strictObject({ repositoryId: z.uuid(), grantId: z.uuid(), accountId: z.uuid(), installationId: z.uuid(), accessRevision: z.uuid(),
  providerRepositoryId: z.string(), repositoryVisibility: z.enum(["public", "private"]) });
const receipt = z.strictObject({ state: z.enum(["queued", "unchanged"]), jobId: z.uuid().nullable(), reportId: z.uuid() });
const contextSchema = z.union([receipt, z.strictObject({ state: z.literal("prepare"), access: z.array(accessSchema).min(1).max(10) })]);
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const parsed = schema.safeParse(value); if (!parsed.success) throw new JobError("INVALID_REQUEST"); return parsed.data; }
export class RescanService {
  constructor(private readonly db: FeatureOneRpcClient, private readonly reader: ReadinessReader, private readonly source: Pick<SnapshotSource, "resolve">,
    private readonly crypto: () => LocatorCrypto) {}
  private async call(name: string, args: Record<string, unknown>) {
    let result;
    try { result = await bounded(this.db.rpc(`feature_one_${name}`, args), 10000, "DATABASE_FAILURE"); }
    catch { throw new JobError("DATABASE_FAILURE"); }
    if (result.error) throw new JobError(result.error.message === "ACCESS_REVOKED" ? "REPOSITORY_ACCESS_REVOKED"
      : JOB_CODES.includes(result.error.message as JobCode) ? result.error.message as JobCode : "DATABASE_FAILURE");
    return result.data;
  }
  async focus(actor: string, report: string, change?: unknown) {
    parse(z.uuid(), actor); parse(z.uuid(), report);
    const role = RoleTemplateReferenceSchema.nullable().parse(await this.call("focus", { p_actor: actor, p_report: report,
      ...(change === undefined ? {} : { p_change: parse(RoleFocusRequestSchema, change) }) }));
    return roleFocus(await this.reader.view(actor, report), role);
  }
  async start(actor: string, baseline: string, value: unknown, suppliedPolicy: ExecutionPolicy, maxRepositories: number) {
    parse(z.uuid(), actor); parse(z.uuid(), baseline);
    const body = parse(RescanRequestSchema, value), policy = parse(ExecutionPolicySchema, suppliedPolicy);
    if (body.repositoryIds.length > maxRepositories || policy.billing !== "internal_free_v1") throw new JobError("INVALID_REQUEST");
    const request = { contractVersion: "1.0.0", ...body, repositoryIds: [...body.repositoryIds].sort(), failurePolicy: "fail_all_v1" };
    const hash = `sha256:${createHash("sha256").update(canonical({ baseline, repositoryIds: request.repositoryIds, metadata: request.includeMetadata })).digest("hex")}`;
    const args = { p_actor: actor, p_baseline: baseline, p_request: request, p_hash: hash };
    let context = contextSchema.parse(await this.call("rescan_context", args));
    if (context.state === "prepare") {
      const resolutions = [];
      for (const access of context.access) {
        const pinId = randomUUID();
        let pin;
        try { pin = await bounded(this.source.resolve({ actor, repositoryId: access.repositoryId, jobId: pinId }, access), 15000); }
        catch (error) { throw jobError(error); }
        if (pin.providerRepositoryId !== access.providerRepositoryId || pin.repositoryVisibility !== access.repositoryVisibility) throw new JobError("REPOSITORY_ACCESS_REVOKED");
        resolutions.push({ ...access, pinId, commitSha: pin.commitSha, resolvedAt: new Date().toISOString(),
          branchEncrypted: this.crypto().encryptBranch(pin.branch, { repositoryId: access.repositoryId, snapshotId: pinId, locatorId: pinId }) });
      }
      context = receipt.parse(await this.call("rescan_start", { ...args, p_policy: policy, p_limit: maxRepositories, p_resolutions: resolutions, p_request_id: randomUUID() }));
    }
    return RescanResponseSchema.parse(context.state === "unchanged" ? { state: "unchanged", reportId: context.reportId, charge: "none" }
      : { state: "queued", job: await new JobRepository(this.db).read(actor, context.jobId!), charge: "internal_free_v1" });
  }
  async history(actor: string, report: string, query: unknown) {
    return RescanHistorySchema.parse(await this.call("rescan_history", { p_actor: parse(z.uuid(), actor), p_report: parse(z.uuid(), report), p_query: parse(RescanHistoryQuerySchema, query) }));
  }
  async compare(actor: string, report: string, query: unknown) {
    const parsed = parse(ComparisonQuerySchema, query);
    const raw = await this.call("comparison_input", { p_actor: parse(z.uuid(), actor), p_baseline: parse(z.uuid(), report), p_target: parsed.targetReportId }) as {
      baseline: ReportView; target: ReportView; baselineFacts: unknown; targetFacts: unknown; baselineInventory: unknown; targetInventory: unknown };
    const inventory = z.array(z.strictObject({ snapshotId: z.uuid(), exclusions: z.unknown() })).max(10);
    return compareReports({ baseline: projectReportView(raw.baseline), target: projectReportView(raw.target),
      baselineFacts: z.array(ComparisonFactSchema).max(20000).parse(raw.baselineFacts), targetFacts: z.array(ComparisonFactSchema).max(20000).parse(raw.targetFacts),
      baselineInventory: inventory.parse(raw.baselineInventory), targetInventory: inventory.parse(raw.targetInventory) }, parsed);
  }
}
