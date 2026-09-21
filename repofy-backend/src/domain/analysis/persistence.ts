import { z } from "zod";
import {
  AccessGrantIdSchema, AnalysisJobIdSchema, AnalysisRunIdSchema, AnalyzerCoverageSchema, AttestationIdSchema,
  CountSchema, GitHubProviderIdSchema, InventorySummarySchema, KeySchema, LocatorIdSchema, ReadinessReportResponseSchema, Sha256Schema,
  ReportIdSchema, RepositorySnapshotSchema, SnapshotIdSchema, TimestampSchema, UserIdSchema, VersionDependenciesSchema, VersionSchema,
  FileCoverageOutcomeSchema,
} from "@repofy/contracts";
import { InternalEvidenceObservationSchema, InternalLocatorSchema } from "@repofy/contracts/internal";
import { canonicalAnalysisRequest } from "./request";
import type { LocatorCrypto } from "../evidence/locator-crypto";
import { DETECTORS, implementationProfile } from "../detectors/registry";
import { coverageProfile } from "../coverage/manifest";
import { achievedCoverage } from "../coverage/achieved";

export interface FeatureOneRpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
}
const GrantFactsSchema = z.strictObject({
  providerUserId: GitHubProviderIdSchema, login: z.string().min(1).max(100),
  providerInstallationId: GitHubProviderIdSchema, providerOwnerId: GitHubProviderIdSchema,
  ownerType: z.enum(["User", "Organization"]), providerRepositoryId: GitHubProviderIdSchema,
  visibility: z.enum(["private", "public"]), verifiedAt: TimestampSchema,
  attestationId: AttestationIdSchema, statementVersion: VersionSchema, attestedAt: TimestampSchema,
});
const FileSchema = z.strictObject({
  locatorId: LocatorIdSchema, locator: InternalLocatorSchema.refine(value => value.kind === "file"),
  language: KeySchema, sizeBytes: CountSchema, classification: z.enum(["code", "test", "config", "docs", "ci", "other"]),
  eligible: z.boolean(), analyzed: z.boolean(), exclusionReason: z.string().regex(/^[a-z_]{1,64}$/).optional(),
  structure: z.strictObject({ lines: CountSchema, projectLocatorId: LocatorIdSchema.optional(),
    depth: z.enum(["inventory", "structural"]),
    generated: z.enum(["not_marked", "lockfile"]), dependency: z.literal("not_vendored"),
    processing: z.enum(["analyzed", "parse_failure", "unsupported", "limited"]), coverage: FileCoverageOutcomeSchema.optional() }).optional(),
}).refine(file => (!file.analyzed || file.eligible) && file.eligible === (file.exclusionReason === undefined));
export const SnapshotBundleSchema = z.strictObject({
  snapshot: RepositorySnapshotSchema, versions: VersionDependenciesSchema,
  inventorySummary: InventorySummarySchema, coverage: AnalyzerCoverageSchema,
  files: z.array(FileSchema).max(10000), evidence: z.array(InternalEvidenceObservationSchema).max(2000),
  artifactKey: Sha256Schema.optional(),
}).superRefine((bundle, ctx) => {
  const fail = () => ctx.addIssue({ code: "custom", message: "Inconsistent snapshot bundle" });
  const { snapshot, inventorySummary: inventory, coverage, versions } = bundle;
  const filesById = new Map(bundle.files.map(file => [file.locatorId, file]));
  const filesByPath = new Map(bundle.files.filter(file => file.locator.kind === "file").map(file => [(file.locator as {path:string}).path, file]));
    if (snapshot.securityPolicyHash !== versions.ingestionPolicyHash || inventory.snapshotId !== snapshot.snapshotId || coverage.snapshotId !== snapshot.snapshotId
    || snapshot.snapshotIdentityVersion !== versions.snapshotIdentity || coverage.manifestVersion !== versions.coverageManifest
    || JSON.stringify(inventory.extractorBundle) !== JSON.stringify(versions.extractorBundle)
    || JSON.stringify(coverage.detectorBundle) !== JSON.stringify(versions.detectorBundle)
    || inventory.totalFiles !== bundle.files.length + Object.values(inventory.structural?.exclusions ?? {}).reduce((a, b) => a + b, 0)
    || inventory.eligibleFiles !== bundle.files.filter(file => file.eligible).length
    || inventory.analyzedFiles !== bundle.files.filter(file => file.analyzed).length
    || filesByPath.size !== bundle.files.length
    || new Set(bundle.files.map(file => file.locatorId)).size !== bundle.files.length
    || new Set(bundle.evidence.map(item => item.evidenceId)).size !== bundle.evidence.length) fail();
  if (inventory.structural && (!bundle.artifactKey || !coverage.structural || inventory.excludedFiles !== Object.values(inventory.structural.exclusions).reduce((a, b) => a + b, 0)
    || bundle.files.some(f => !f.structure || !f.eligible || f.analyzed !== (f.structure.processing === "analyzed"))
    || inventory.languages.reduce((sum, item) => sum + item.files, 0) !== inventory.eligibleFiles
    || coverage.structural.sources.reduce((sum, item) => sum + item.eligibleFiles, 0) !== inventory.eligibleFiles
    || coverage.structural.sources.reduce((sum, item) => sum + item.analyzedFiles, 0) !== inventory.analyzedFiles)) fail();
  for (const file of bundle.files) if (file.structure?.projectLocatorId && !filesById.has(file.structure.projectLocatorId)) fail();
  const implementation = coverage.implementation;
  if (implementation) {
    const expected = coverage.assessment ? coverageProfile(coverage.assessment.declaration.disabledParsers, implementation.disabledDetectors) : implementationProfile(implementation.disabledDetectors);
    if (!inventory.structural || versions.taxonomy.id !== "engineering_capabilities" || versions.taxonomy.version !== "1.0.0"
      || JSON.stringify(implementation.bundle) !== JSON.stringify(expected.detectorBundle)
      || JSON.stringify(versions.detectorBundle) !== JSON.stringify(expected.detectorBundle) || versions.coverageManifest !== expected.coverageManifest
      || implementation.eligibleFiles !== bundle.files.filter(f => f.eligible && ["code", "test"].includes(f.classification) && ["typescript", "javascript"].includes(f.language)).length) fail();
    for (const row of implementation.detectors) {
      const definition = DETECTORS.find(d => d.kind === row.kind)!;
      if (JSON.stringify(row.capabilityIds) !== JSON.stringify(definition.capabilityIds)
        || row.observations !== bundle.evidence.filter(e => e.implementation?.kind === row.kind).length) fail();
    }
  } else if (bundle.evidence.some(e => e.implementation || e.detector.id.startsWith("tsjs.")) || versions.detectorBundle.id === "tsjs_implementation") fail();
  if (coverage.assessment) {
    if (!coverage.structural || !implementation || bundle.files.some(f => !f.structure?.coverage)) fail();
    else {
      const profile = coverageProfile(coverage.assessment.declaration.disabledParsers, implementation.disabledDetectors);
      if (JSON.stringify(versions.extractorBundle) !== JSON.stringify(profile.extractorBundle) || versions.coverageManifest !== profile.coverageManifest
        || JSON.stringify(coverage.assessment) !== JSON.stringify(achievedCoverage(bundle, profile))) fail();
      const states = { analyzedFiles: "analyzed", parseFailures: "parse_failure", limitedFiles: "limited", unsupportedFiles: "unsupported", generatedFiles: "generated" } as const;
      for (const [counter, state] of Object.entries(states)) if (implementation[counter as keyof typeof states] !== bundle.files.filter(f => f.structure?.coverage?.implementation === state).length) fail();
    }
  } else if (versions.extractorBundle.id === "language_inventory" || bundle.files.some(f => f.structure?.coverage)) fail();
  for (const item of bundle.evidence) {
    if (item.snapshotId !== snapshot.snapshotId || item.repositoryId !== snapshot.repositoryId || item.commitSha !== snapshot.commitSha
      || item.repositoryVisibility !== snapshot.repositoryVisibility) fail();
    if (item.locator.kind === "file") {
      const path = item.locator.path;
      if (!filesByPath.get(path)?.analyzed) fail();
    }
    if (item.structural?.associatedFileIds?.some(id => !filesById.get(id)?.eligible)) fail();
    if (item.structural?.provider && (item.locator.kind !== "provider_metadata" || item.structural.provider.relationship !== item.locator.commitRelationship
      || (item.structural.provider.relationship === "exact_commit" && item.structural.provider.subjectSha !== snapshot.commitSha))) fail();
    if (item.implementation) {
      const detail = item.implementation; const definition = DETECTORS.find(d => d.kind === detail.kind)!;
      const file = item.locator.kind === "file" && filesByPath.get(item.locator.path);
      const mocked = detail.testBoundary === "mocked_or_intercepted";
      if (!implementation || implementation.disabledDetectors.includes(detail.kind) || !file || !file.structure || !["typescript", "javascript"].includes(file.language)
        || detail.span.lines.end > file.structure.lines || item.locator.kind !== "file" || JSON.stringify(item.locator.lines) !== JSON.stringify(detail.span.lines)
        || item.detector.version !== definition.version || JSON.stringify(item.capabilityIds) !== JSON.stringify(definition.capabilityIds)
        || item.confidence > (mocked ? 0.4 : definition.confidence) || item.strength > (mocked ? 0.35 : definition.strength)) fail();
      for (const relation of detail.relations) {
        const target = filesById.get(relation.fileId);
        if (!target?.analyzed || !target.structure || target.classification !== "code" || relation.lines.end > target.structure.lines
          || (detail.kind === "asserted_call" ? relation.relationship !== "asserted_call" || relation.independence !== (mocked ? "mocked_test" : "separate_test")
            || relation.fileId === (file && file.locatorId) : relation.relationship !== "local_call" || relation.independence !== "same_source")) fail();
      }
      if (detail.kind === "asserted_call" && !detail.relations.length) fail();
    }
  }
});
export type SnapshotBundle = z.infer<typeof SnapshotBundleSchema>;

const exportKeys = ["githubAccounts", "installations", "repositories", "accessGrants", "snapshotReceipts", "snapshots", "files", "evidence", "jobs", "attempts", "runs", "runSnapshots", "reports", "auditEvents", "modelRuns", "githubConnections", "discoveredRepositories", "repositorySelections", "ingestionSnapshots", "ingestionAttempts", "ingestionFiles", "analysisExecutions", "analysisSettlements", "analysisLedger", "analysisDrafts", "aggregations", "reportPreferences", "reportRescans", "findingFeedback", "findingFeedbackHistory", "findingReviews", "provenance"] as const;
export type EvidenceDataExport = Record<(typeof exportKeys)[number], unknown[]>;

export class EvidencePersistenceError extends Error {
  constructor(readonly code: string) { super(`Evidence operation failed: ${code}`); this.name = "EvidencePersistenceError"; }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new EvidencePersistenceError("INVALID_REQUEST");
  return result.data;
}

/** Service-role access is restricted to RPCs that require a verified actor explicitly.
 * Routes must obtain the actor from requireAuth, never from browser JSON. No routes
 * are enabled by Run 02. Worker/provider/semantic validation belongs to later runs.
 */
export class EvidenceRepository {
  constructor(private readonly client: FeatureOneRpcClient) {}

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    let result;
    try { result = await this.client.rpc(`feature_one_${name}`, args); }
    catch { throw new EvidencePersistenceError("DATABASE_FAILURE"); }
    const { data, error } = result;
    if (error) {
      if (error.message === "IDENTITY_CONFLICT") throw new EvidencePersistenceError("NOT_AUTHORIZED");
      const known = ["NOT_FOUND", "NOT_AUTHORIZED", "ACCESS_REVOKED", "INVALID_REQUEST", "VERSION_MISMATCH", "FOREIGN_EVIDENCE",
        "IDEMPOTENCY_CONFLICT", "INVALID_TRANSITION", "ALREADY_FINALIZED", "INCOMPLETE_ANALYSIS", "UNSUPPORTED_CLAIM", "LEASE_LOST",
        "ANALYSIS_VALIDATION_FAILED", "REPOSITORY_ACCESS_REVOKED", "CONSENT_REQUIRED"];
      // Never forward/log PostgreSQL detail, hints, row contents, or raw JSON inputs.
      throw new EvidencePersistenceError(known.includes(error.message ?? "") ? error.message! :
        ["23503", "23505", "23514"].includes(error.code ?? "") ? "INVALID_MEMBERSHIP" : "DATABASE_FAILURE");
    }
    return data;
  }

  async bindVerifiedGrant(actor: string, facts: unknown, requestId: string) {
    return parse(z.strictObject({ githubAccountId: z.uuid(), installationId: z.uuid(), repositoryId: z.uuid(), grantId: AccessGrantIdSchema }),
      await this.call("bind_grant", { p_actor: parse(UserIdSchema, actor), p_facts: parse(GrantFactsSchema, facts), p_request_id: parse(z.uuid(), requestId) }));
  }

  async storeSnapshot(actor: string, grantId: string, input: unknown, crypto: LocatorCrypto) {
    const bundle = parse(SnapshotBundleSchema, input);
    const { branch, ...snapshot } = bundle.snapshot;
    const context = { repositoryId: snapshot.repositoryId, snapshotId: snapshot.snapshotId };
    const filesByPath = new Map(bundle.files.map(file => [(file.locator as {path:string}).path, file.locatorId]));
    const files = bundle.files.map(({ locator, ...file }) => ({ ...file, ...crypto.protectLocator(locator, { ...context, locatorId: file.locatorId }) }));
    const evidence = bundle.evidence.map(({ locator, locatorId, fingerprint, ...observation }) => ({
      observation, locatorId, locatorKind: locator.kind,
      // Never persist caller-selected hashes as trusted lookup keys. Structural
      // content HMACs are re-keyed by this boundary; legacy payloads stay unchanged.
      ...(bundle.inventorySummary.structural ? { contentFingerprint: crypto.fingerprintContent(JSON.stringify(["structural-content-v1", fingerprint]), snapshot.repositoryId) } : {}),
      fileLocatorId: locator.kind === "file" ? filesByPath.get(locator.path)! : null,
      ...crypto.protectLocator(locator, { ...context, locatorId }),
    }));
    return parse(SnapshotIdSchema, await this.call("store_snapshot", {
      p_actor: parse(UserIdSchema, actor), p_grant: parse(AccessGrantIdSchema, grantId),
      p_bundle: { ...bundle, snapshot, files, evidence, branchEncrypted: crypto.encryptBranch(branch, { ...context, locatorId: snapshot.snapshotId }) },
    }));
  }

  async createJob(actor: string, input: unknown, grantIds: string[], requestId: string) {
    let canonical;
    try { canonical = canonicalAnalysisRequest(input); } catch { throw new EvidencePersistenceError("INVALID_REQUEST"); }
    return parse(AnalysisJobIdSchema, await this.call("create_job", {
      p_actor: parse(UserIdSchema, actor), p_request: canonical.request, p_request_hash: canonical.requestHash,
      p_grant_ids: parse(z.array(AccessGrantIdSchema).min(1).max(10), grantIds), p_request_id: parse(z.uuid(), requestId),
    }));
  }

  async createRun(actor: string, jobId: string, versions: unknown, snapshotIds: string[], requestId: string) {
    return parse(z.strictObject({ runId: AnalysisRunIdSchema, attemptId: z.uuid() }), await this.call("create_run", {
      p_actor: parse(UserIdSchema, actor), p_job: parse(AnalysisJobIdSchema, jobId), p_versions: parse(VersionDependenciesSchema, versions),
      p_snapshot_ids: parse(z.array(SnapshotIdSchema).min(1).max(10), snapshotIds), p_request_id: parse(z.uuid(), requestId),
    }));
  }

  /** Strict contract + transactional referential validation. Semantic/model quality
   * gates are still required before calling this from the future production worker. */
  async finalizeReport(actor: string, input: unknown, requestId: string) {
    const report = parse(ReadinessReportResponseSchema, input);
    if (report.ownerUserId !== parse(UserIdSchema, actor)) throw new EvidencePersistenceError("NOT_FOUND");
    return parse(ReportIdSchema, await this.call("finalize_report", { p_actor: actor, p_report: report, p_request_id: parse(z.uuid(), requestId) }));
  }

  async readReport(actor: string, reportId: string) {
    const result = await this.call("read_report", { p_actor: parse(UserIdSchema, actor), p_report: parse(ReportIdSchema, reportId) });
    return result === null ? null : parse(ReadinessReportResponseSchema, result);
  }
  async listReports(actor: string) {
    return parse(z.array(z.strictObject({ reportId: ReportIdSchema, runId: AnalysisRunIdSchema, jobId: AnalysisJobIdSchema, createdAt: z.iso.datetime({ offset: true }) })),
      await this.call("list_reports", { p_actor: parse(UserIdSchema, actor) }));
  }
  async revokeGrant(actor: string, grantId: string, requestId: string) {
    await this.call("revoke_grant", { p_actor: parse(UserIdSchema, actor), p_grant: parse(AccessGrantIdSchema, grantId), p_request_id: parse(z.uuid(), requestId) });
  }
  async cancelJob(actor: string, jobId: string, requestId: string) { await this.jobMutation("cancel_job", actor, jobId, requestId); }
  async deleteAnalysis(actor: string, jobId: string, requestId: string) { await this.jobMutation("delete_analysis", actor, jobId, requestId); }
  private async jobMutation(name: string, actor: string, jobId: string, requestId: string) {
    await this.call(name, { p_actor: parse(UserIdSchema, actor), p_job: parse(AnalysisJobIdSchema, jobId), p_request_id: parse(z.uuid(), requestId) });
  }
  async exportUserData(actor: string): Promise<EvidenceDataExport> {
    const result = await this.call("export_v8", { p_actor: parse(UserIdSchema, actor) });
    const shape = Object.fromEntries(exportKeys.map(key => [key, z.array(z.unknown())]));
    return parse(z.strictObject(shape), result) as EvidenceDataExport;
  }
}
