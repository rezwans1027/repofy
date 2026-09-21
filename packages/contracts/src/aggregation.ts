import { z } from "zod";
import { AnalysisRunIdSchema, AnalysisJobIdSchema, UserIdSchema, SnapshotIdSchema, RepositoryIdSchema, EvidenceIdSchema,
  KeySchema, ScoreSchema, SourceTypeSchema, VersionDependenciesSchema, VersionReferenceSchema, RoleTemplateReferenceSchema,
  Sha256Schema, CountSchema, uniqueArray } from "./primitives";
import { CoverageReasonSchema } from "./assessability";
import { ConfidenceLabelSchema, ClaimScopeSchema } from "./rubrics";
import { OwnerEvidenceSchema } from "./evidence";
import { ProvenanceAssessmentSchema } from "./provenance";

export const AggregationPolicyReferenceSchema = VersionReferenceSchema.extend({ id: z.literal("evidence_aggregation"), version: z.enum(["1.0.0", "1.1.0"]) });
export const AggregationUncertaintySchema = z.enum(["uncalibrated", "partial_coverage", "provenance_unknown", "provenance_not_applied",
  "static_only", "cross_repository_independence_unknown", "unlinked_context_not_corroboration", "invalid_evidence_excluded", "conflicting_metadata"]);
export const AggregationValidationCodeSchema = z.enum(["invalid_shape", "foreign_evidence", "duplicate_id_conflict", "version_mismatch",
  "quarantined_detector", "unsupported_mapping", "unassessable_source", "invalid_relation"]);
export const AggregationSupportSchema = z.strictObject({
  evidenceId: EvidenceIdSchema, snapshotId: SnapshotIdSchema, repositoryId: RepositoryIdSchema,
  clusterId: KeySchema, sourceType: SourceTypeSchema, basis: z.enum(["presence", "implementation", "corroboration"]),
  detector: VersionReferenceSchema,
  boundary: z.enum(["dependency_presence", "configuration_presence", "test_candidates_only", "documentation_only", "source_structure_only",
    "schema_structure_only", "exact_commit_result", "historical_context", "observed_control", "declared_constraint", "assertion_source"]),
});
export const CapabilityCoverageTraceSchema = z.strictObject({
  snapshotId: SnapshotIdSchema, repositoryId: RepositoryIdSchema,
  state: z.enum(["assessable", "partially_assessable", "not_assessable", "evidence_not_observed_within_assessed_scope"]),
  analyzedFiles: CountSchema, eligibleFiles: CountSchema, excludedFiles: CountSchema,
  metadataAssessed: z.boolean(), fraction: ScoreSchema, confidenceCeiling: ScoreSchema,
  reasons: uniqueArray(CoverageReasonSchema, 30),
});
export const ClusterCalculationSchema = z.strictObject({
  clusterId: KeySchema, repositoryId: RepositoryIdSchema, baseEvidenceId: EvidenceIdSchema,
  evidenceIds: uniqueArray(EvidenceIdSchema, 20000, 1), baseStrength: ScoreSchema, presenceCeiling: ScoreSchema,
  corroboration: z.array(z.strictObject({ sourceType: SourceTypeSchema, evidenceId: EvidenceIdSchema,
    rank: z.number().int().min(1).max(4), bonus: ScoreSchema })).max(4),
  strength: ScoreSchema,
});
export const AggregatedCapabilitySchema = z.strictObject({
  capabilityId: KeySchema, categoryId: KeySchema, state: z.enum(["assessed", "not_observed", "unknown"]),
  strength: ScoreSchema.nullable(), strengthBand: z.enum(["not_observed", "limited", "moderate", "strong", "very_strong", "unknown"]),
  confidence: ScoreSchema.nullable(), confidenceLabel: ConfidenceLabelSchema.nullable(),
  provenance: z.strictObject({ state: z.literal("unknown"), value: z.null(), policy: z.enum(["not_inferred_v1", "context_only_v1"]) }),
  evidenceIds: uniqueArray(EvidenceIdSchema, 20000), support: z.array(AggregationSupportSchema).max(40000),
  allowedClaimScopes: uniqueArray(ClaimScopeSchema, 5), uncertainty: uniqueArray(AggregationUncertaintySchema, 15),
  trace: z.strictObject({
    coverage: z.array(CapabilityCoverageTraceSchema).min(1).max(10), clusters: z.array(ClusterCalculationSchema).max(20000),
    selectedClusterId: KeySchema.nullable(), combination: z.literal("maximum_cluster_no_repository_bonus"),
    confidence: z.strictObject({ reliability: ScoreSchema, coverageFraction: ScoreSchema, coverageFactor: ScoreSchema,
      independentSupportBonus: ScoreSchema, ceiling: ScoreSchema, provenanceMultiplier: z.null() }).nullable(),
  }),
}).superRefine((v, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (v.state === "unknown" ? v.strength !== null || v.confidence !== null || v.confidenceLabel !== null || v.strengthBand !== "unknown"
    : v.strength === null || v.confidence === null || v.confidenceLabel === null) fail("Unknown values are not numeric zeros");
  if (v.state !== "assessed" && (v.evidenceIds.length || v.support.length || v.allowedClaimScopes.length || v.trace.clusters.length)) fail("Absence cannot cite invented evidence");
  if (v.state === "assessed" && (!v.evidenceIds.length || v.strength === null || v.strength <= 0 || !v.trace.selectedClusterId)) fail("Positive support is required");
  if (v.state === "not_observed" && (v.strength !== 0 || !v.trace.coverage.some(c => c.state !== "not_assessable"))) fail("Scoped absence requires assessed coverage");
  if (v.support.some(s => !v.evidenceIds.includes(s.evidenceId))) fail("Support must cite included evidence");
  if (new Set(v.trace.clusters.map(c => c.clusterId)).size !== v.trace.clusters.length ||
    v.trace.selectedClusterId && !v.trace.clusters.some(c => c.clusterId === v.trace.selectedClusterId)) fail("Invalid cluster selection");
  if (v.trace.clusters.some(c => !c.evidenceIds.includes(c.baseEvidenceId) || c.evidenceIds.some(id => !v.evidenceIds.includes(id)) ||
    c.corroboration.some(b => !v.evidenceIds.includes(b.evidenceId)))) fail("Invalid cluster evidence");
});
export const RequirementCalculationSchema = z.strictObject({
  requirementId: KeySchema, capabilityIds: uniqueArray(KeySchema, 10, 1), required: z.boolean(), weight: ScoreSchema.gt(0),
  minimumEvidence: ScoreSchema, minimumConfidence: ConfidenceLabelSchema,
  state: z.enum(["satisfied", "unmet", "unknown"]), strength: ScoreSchema.nullable(), confidence: ScoreSchema.nullable(),
  satisfaction: ScoreSchema, weightedContribution: ScoreSchema, assessableFraction: ScoreSchema,
  failures: z.array(z.strictObject({ capabilityId: KeySchema, reasons: uniqueArray(z.enum([
    "not_assessable", "not_observed", "insufficient_strength", "insufficient_confidence", "implementation_required", "independent_corroboration_required"]), 6, 1) })).max(10),
});
export const AggregatedRoleSchema = z.strictObject({
  template: RoleTemplateReferenceSchema, state: z.enum(["assessed", "unknown"]), coverage: ScoreSchema.nullable(), confidence: ScoreSchema.nullable(),
  denominator: z.number().positive().max(100), numerator: z.number().nonnegative().max(100),
  assessableFraction: ScoreSchema, unknownWeight: ScoreSchema,
  requirements: z.array(RequirementCalculationSchema).min(1).max(100),
  strongestCapabilityIds: uniqueArray(KeySchema, 5),
  gaps: z.array(z.strictObject({ requirementId: KeySchema, state: z.enum(["not_assessable", "not_observed", "limited_evidence"]),
    required: z.boolean(), impact: ScoreSchema, capabilityIds: uniqueArray(KeySchema, 10, 1) })).max(100),
  leadingRepositories: z.array(z.strictObject({ repositoryId: RepositoryIdSchema, contribution: ScoreSchema,
    capabilityIds: uniqueArray(KeySchema, 100, 1) })).max(10),
  limitations: uniqueArray(AggregationUncertaintySchema, 15),
}).refine(v => v.state === "unknown" ? v.coverage === null && v.confidence === null && v.unknownWeight === 1
  : v.coverage !== null && v.confidence !== null, "Entirely unknown roles have no score");
export const AggregationResultSchema = z.strictObject({
  contractVersion: z.literal("1.0.0"), policy: AggregationPolicyReferenceSchema, runId: AnalysisRunIdSchema,
  jobId: AnalysisJobIdSchema, ownerUserId: UserIdSchema, visibility: z.literal("owner_only"), versions: VersionDependenciesSchema,
  snapshotIds: uniqueArray(SnapshotIdSchema, 10, 1), inputHash: Sha256Schema,
  provenance: ProvenanceAssessmentSchema.optional(),
  capabilities: z.array(AggregatedCapabilitySchema).min(1).max(100), roles: z.array(AggregatedRoleSchema).length(5),
  validation: z.array(z.strictObject({ code: AggregationValidationCodeSchema, count: CountSchema.min(1) })).max(8),
  limitations: uniqueArray(AggregationUncertaintySchema, 15),
}).superRefine((v, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (v.versions.aggregationPolicy.id !== v.policy.id || v.versions.aggregationPolicy.version !== v.policy.version) fail("Aggregation dependency mismatch");
  if (v.policy.version === "1.1.0" ? !v.provenance || v.provenance.snapshots.length !== v.snapshotIds.length || new Set(v.provenance.snapshots.map(s => s.snapshotId)).size !== v.snapshotIds.length || v.provenance.snapshots.some(s => !v.snapshotIds.includes(s.snapshotId)) : !!v.provenance) fail("Provenance policy membership mismatch");
  if (v.capabilities.some(c => c.provenance.policy !== (v.policy.version === "1.1.0" ? "context_only_v1" : "not_inferred_v1"))) fail("Provenance policy mismatch");
  if (new Set(v.capabilities.map(c => c.capabilityId)).size !== v.capabilities.length || new Set(v.roles.map(r => r.template.roleId)).size !== 5) fail("Duplicate assessments");
  for (const c of v.capabilities) if (c.support.some(s => !v.snapshotIds.includes(s.snapshotId)) ||
    c.trace.coverage.length !== v.snapshotIds.length || new Set(c.trace.coverage.map(s => s.snapshotId)).size !== v.snapshotIds.length ||
    c.trace.coverage.some(s => !v.snapshotIds.includes(s.snapshotId))) fail("Foreign snapshot support");
  for (const r of v.roles) if (!v.versions.roleRubrics.some(t => t.roleId === r.template.roleId && t.version === r.template.version) ||
    r.requirements.some(q => q.capabilityIds.some(id => !v.capabilities.some(c => c.capabilityId === id)))) fail("Role dependency mismatch");
});
export const AggregationEvidenceQuerySchema = z.strictObject({
  repositoryId: RepositoryIdSchema.optional(), categoryId: KeySchema.optional(),
  roleId: RoleTemplateReferenceSchema.shape.roleId.optional(), requirementId: KeySchema.optional(),
  afterEvidenceId: EvidenceIdSchema.optional(), limit: z.number().int().min(1).max(100).default(50),
}).refine(v => !v.requirementId || !!v.roleId, "Requirement queries need a role");
export const AggregationEvidencePageSchema = z.strictObject({ items: z.array(z.strictObject({ evidence: OwnerEvidenceSchema,
  capabilityIds: uniqueArray(KeySchema, 100, 1), repositoryId: RepositoryIdSchema })).max(100), nextEvidenceId: EvidenceIdSchema.nullable() });
export type AggregationResult = z.infer<typeof AggregationResultSchema>;
export type AggregatedCapability = z.infer<typeof AggregatedCapabilitySchema>;
export type AggregatedRole = z.infer<typeof AggregatedRoleSchema>;
export type AggregationSupport = z.infer<typeof AggregationSupportSchema>;
export type ClusterCalculation = z.infer<typeof ClusterCalculationSchema>;
export type AggregationValidationCode = z.infer<typeof AggregationValidationCodeSchema>;
