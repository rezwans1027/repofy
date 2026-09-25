import { z } from "zod";
import { AnalysisJobResponseSchema, MetadataOptionsSchema } from "./api";
import { IdempotencyKeySchema, KeySchema, RoleIdSchema, RoleTemplateReferenceSchema, TimestampSchema, VersionDependenciesSchema, uniqueArray } from "./primitives";

export const RoleFocusRequestSchema = z.strictObject({ role: RoleTemplateReferenceSchema.nullable() });
export const RoleFocusSchema = z.strictObject({ reportId: z.uuid(), role: RoleTemplateReferenceSchema.nullable(),
  policy: z.literal("recorded-role-order-1.0.0"), capabilityOrder: uniqueArray(KeySchema, 100),
  improvementOrder: uniqueArray(z.uuid(), 100), roleOrder: uniqueArray(RoleIdSchema, 5, 5), gapOrder: uniqueArray(KeySchema, 100),
});
export const RescanRequestSchema = z.strictObject({ repositoryIds: uniqueArray(z.uuid(), 10, 1),
  includeMetadata: MetadataOptionsSchema.default({ commits: false, pullRequests: false, ci: false }), idempotencyKey: IdempotencyKeySchema });
export const RescanResponseSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("unchanged"), reportId: z.uuid(), charge: z.literal("none") }),
  z.strictObject({ state: z.literal("queued"), job: AnalysisJobResponseSchema, charge: z.literal("internal_free_v1") }),
]);
export const RescanHistoryQuerySchema = z.strictObject({ afterId: z.uuid().optional(), limit: z.number().int().min(1).max(50).default(20) });
export const RescanHistorySchema = z.strictObject({ parent: z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("available"), reportId: z.uuid() }), z.strictObject({ state: z.enum(["none", "unavailable"]) }),
]), items: z.array(z.strictObject({ id: z.uuid(), createdAt: TimestampSchema, jobId: z.uuid().nullable(), reportId: z.uuid().nullable(),
  state: z.enum(["unchanged", "queued", "running", "completed", "failed", "canceled", "expired", "deleted"]),
})).max(50), nextId: z.uuid().nullable() });
export const EVIDENCE_CHANGES = ["gained", "lost", "changed", "relocated", "unchanged", "uncertain"] as const;
export const COMPARISON_CAUSES = ["commit_changed", "repository_added", "repository_removed", "security_policy_changed", "scope_changed", "scope_incomplete",
  "extractor_changed", "detector_changed", "coverage_policy_changed", "rubric_changed", "aggregation_changed", "narrative_policy_changed",
  "permission_unavailable", "metadata_permission_changed", "locator_unavailable"] as const;
export const ComparisonQuerySchema = z.strictObject({ targetReportId: z.uuid(), repositoryId: z.uuid().optional(),
  change: z.enum(EVIDENCE_CHANGES).optional(), capabilityId: KeySchema.optional(), offset: z.number().int().min(0).max(40000).default(0),
  limit: z.number().int().min(1).max(100).default(30) });
const side = z.strictObject({ reportId: z.uuid(), createdAt: TimestampSchema, versions: VersionDependenciesSchema });
const snapshot = z.strictObject({ snapshotId: z.uuid(), commitSha: z.string().regex(/^[a-f0-9]{40}$/), capturedAt: TimestampSchema,
  access: z.enum(["active", "revoked"]), visibility: z.enum(["public", "private"]) });
const measurement = z.strictObject({ state: z.string().min(1).max(32), strength: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1).nullable(), assessableFraction: z.number().min(0).max(1).nullable() });
export const ComparisonEvidenceSchema = z.strictObject({ repositoryId: z.uuid(), change: z.enum(EVIDENCE_CHANGES),
  baselineEvidenceId: z.uuid().nullable(), targetEvidenceId: z.uuid().nullable(), detector: KeySchema,
  sourceType: z.string().max(32), capabilityIds: uniqueArray(KeySchema, 100),
  basis: z.enum(["identity", "content_and_concept", "path_and_concept", "unmatched", "ambiguous"]),
  interpretation: z.enum(["comparable_observation", "limited_by_scope_or_versions", "uncertain_identity"]),
}).refine(v => !!(v.baselineEvidenceId || v.targetEvidenceId) && (v.change !== "gained" || !v.baselineEvidenceId) && (v.change !== "lost" || !v.targetEvidenceId));
export const ComparisonSchema = z.strictObject({ algorithm: z.enum(["evidence-diff-1.0.0", "evidence-diff-1.0.1", "evidence-diff-1.0.2", "evidence-diff-1.0.3"]), baseline: side, target: side,
  comparability: z.enum(["comparable", "limited"]), causes: uniqueArray(z.enum(COMPARISON_CAUSES), COMPARISON_CAUSES.length),
  notes: z.array(z.string().max(600)).min(1).max(25),
  repositories: z.array(z.strictObject({ repositoryId: z.uuid(), label: z.string().max(80), baseline: snapshot.nullable(), target: snapshot.nullable() })).max(20),
  counts: z.strictObject(Object.fromEntries(EVIDENCE_CHANGES.map(key => [key, z.number().int().nonnegative().max(40000)])) as Record<typeof EVIDENCE_CHANGES[number], z.ZodNumber>),
  capabilities: z.array(z.strictObject({ capabilityId: KeySchema, label: z.string().max(200), baseline: measurement.nullable(), target: measurement.nullable(),
    strengthDelta: z.number().min(-1).max(1).nullable(), confidenceDelta: z.number().min(-1).max(1).nullable(), assessabilityChanged: z.boolean() })).max(200),
  roles: z.array(z.strictObject({ roleId: RoleIdSchema, baseline: z.number().min(0).max(1).nullable(), target: z.number().min(0).max(1).nullable(),
    coverageDelta: z.number().min(-1).max(1).nullable(), confidenceDelta: z.number().min(-1).max(1).nullable(),
    baselineUnknownWeight: z.number().min(0).max(1).nullable(), targetUnknownWeight: z.number().min(0).max(1).nullable() })).max(5),
  evidence: z.array(ComparisonEvidenceSchema).max(100), filteredCount: z.number().int().min(0).max(40000), nextOffset: z.number().int().min(0).max(40000).nullable(),
});
export type RoleFocus = z.infer<typeof RoleFocusSchema>;
export type RescanRequest = z.infer<typeof RescanRequestSchema>;
export type RescanResponse = z.infer<typeof RescanResponseSchema>;
export type RescanHistory = z.infer<typeof RescanHistorySchema>;
export type Comparison = z.infer<typeof ComparisonSchema>;
export type ComparisonEvidence = z.infer<typeof ComparisonEvidenceSchema>;
export type ComparisonQuery = z.infer<typeof ComparisonQuerySchema>;
