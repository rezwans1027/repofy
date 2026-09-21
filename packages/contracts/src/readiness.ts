import { z } from "zod";
import {
  AnalysisJobIdSchema, AnalysisRunIdSchema, ClaimIdSchema, ContractVersionSchema, EvidenceIdSchema,
  ExplanationSchema, GapIdSchema, ImprovementIdSchema, KeySchema, LimitationsSchema,
  ReportIdSchema, RoleIdSchema, RoleTemplateReferenceSchema, ScoreSchema, ShortTextSchema,
  SnapshotIdSchema, TimestampSchema, UnknownReasonsSchema, UserIdSchema, VersionDependenciesSchema,
  VersionSchema, uniqueArray,
} from "./primitives";
import { AnalyzerCoverageSchema } from "./coverage";
import { OwnerEvidenceLocationSchema, OwnerEvidenceSchema } from "./evidence";
import { OwnerSnapshotSchema } from "./repositories";
import { NarrativeProvenanceSchema, ImprovementPriorityTraceSchema } from "./narrative";

export const ClaimSchema = z.discriminatedUnion("verification", [
  z.strictObject({
    verification: z.literal("verified"), claimId: ClaimIdSchema, text: ExplanationSchema,
    capabilityIds: uniqueArray(KeySchema, 30, 1), evidenceIds: uniqueArray(EvidenceIdSchema, 100, 1),
  }),
  z.strictObject({
    verification: z.literal("unverified"), claimId: ClaimIdSchema, text: ExplanationSchema,
    label: z.literal("Unverified"), basis: z.enum(["candidate_reported", "insufficient_evidence"]),
  }),
]);
export const CapabilityDefinitionSchema = z.strictObject({
  capabilityId: KeySchema, taxonomyVersion: VersionSchema, groupId: KeySchema,
  label: ShortTextSchema, description: ExplanationSchema,
});
export const CapabilityAssessmentSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("assessed"), capabilityId: KeySchema, strength: ScoreSchema.gt(0), confidence: ScoreSchema,
    evidenceIds: uniqueArray(EvidenceIdSchema, 100, 1), reasoning: ClaimSchema,
  }),
  z.strictObject({
    state: z.literal("not_observed"), capabilityId: KeySchema, confidence: ScoreSchema,
    coverageSnapshotIds: uniqueArray(SnapshotIdSchema, 10, 1), explanation: ExplanationSchema,
  }),
  z.strictObject({
    state: z.literal("unknown"), capabilityId: KeySchema, reasons: UnknownReasonsSchema, explanation: ExplanationSchema,
  }),
]);
export const RubricRequirementSchema = z.strictObject({
  capabilityId: KeySchema, weight: ScoreSchema.gt(0), minimumEvidence: ScoreSchema,
  required: z.boolean(),
});
export const RoleRubricSchema = z.strictObject({
  contractVersion: ContractVersionSchema, roleId: RoleIdSchema, version: VersionSchema,
  taxonomyVersion: VersionSchema, name: ShortTextSchema,
  requirements: z.array(RubricRequirementSchema).min(1).max(100),
}).refine((rubric) => Math.abs(rubric.requirements.reduce((total, req) => total + req.weight, 0) - 1) < 1e-6 &&
  new Set(rubric.requirements.map((req) => req.capabilityId)).size === rubric.requirements.length,
"Rubric weights must total one and capabilities must be unique");

export const RoleResultSchema = z.discriminatedUnion("state", [
  z.strictObject({
    state: z.literal("assessed"), template: RoleTemplateReferenceSchema,
    coverage: ScoreSchema, confidence: ScoreSchema,
    assessedRequirementIds: uniqueArray(KeySchema, 100, 1), unknownRequirementIds: uniqueArray(KeySchema, 100),
    limitations: LimitationsSchema,
  }).refine((value) => !value.assessedRequirementIds.some((id) => value.unknownRequirementIds.includes(id)) &&
    (value.unknownRequirementIds.length === 0 || value.limitations.length > 0),
  "Unknown requirements must remain separate and be described"),
  z.strictObject({ state: z.literal("unknown"), template: RoleTemplateReferenceSchema, reasons: UnknownReasonsSchema, limitations: LimitationsSchema }),
]);
export const GapSchema = z.strictObject({
  gapId: GapIdSchema, capabilityId: KeySchema,
  state: z.enum(["not_observed", "limited_evidence", "not_assessable"]),
  roleIds: uniqueArray(RoleIdSchema, 5, 1), explanation: ClaimSchema,
});
export const ImprovementSchema = z.strictObject({
  improvementId: ImprovementIdSchema, title: ShortTextSchema,
  gapIds: uniqueArray(GapIdSchema, 100, 1), capabilityIds: uniqueArray(KeySchema, 30, 1),
  roleIds: uniqueArray(RoleIdSchema, 5, 1), rationale: ClaimSchema,
  expectedProof: z.array(ExplanationSchema).min(1).max(20),
  acceptanceCriteria: z.array(ExplanationSchema).min(1).max(20),
  effort: z.enum(["small", "medium", "large", "unknown"]),
  priority: ScoreSchema,
  priorityReasons: z.array(ShortTextSchema).min(1).max(10),
  priorityTrace: ImprovementPriorityTraceSchema.optional(),
  // Future proof, never an existing achievement; absent on legacy reports.
  proofStatus: z.literal("proposed_not_observed").optional(),
  repositoryIds: uniqueArray(z.uuid(), 10).optional(),
  permittedLocations: z.array(z.strictObject({ snapshotId: SnapshotIdSchema, location: OwnerEvidenceLocationSchema })).max(20),
});

export const ReadinessReportResponseSchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  reportId: ReportIdSchema,
  analysisRunId: AnalysisRunIdSchema,
  jobId: AnalysisJobIdSchema,
  ownerUserId: UserIdSchema,
  visibility: z.literal("owner_only"),
  versions: VersionDependenciesSchema,
  narrative: NarrativeProvenanceSchema.optional(),
  createdAt: TimestampSchema,
  snapshots: z.array(OwnerSnapshotSchema).min(1).max(10),
  coverage: z.array(AnalyzerCoverageSchema).min(1).max(10),
  evidence: z.array(OwnerEvidenceSchema).max(2000),
  capabilityGroups: z.array(z.strictObject({ groupId: KeySchema, capabilities: z.array(CapabilityAssessmentSchema).min(1).max(100) })).min(1).max(30),
  roles: z.array(RoleResultSchema).length(5),
  claims: z.array(ClaimSchema).max(100),
  gaps: z.array(GapSchema).max(100),
  improvements: z.array(ImprovementSchema).max(100),
  limitations: LimitationsSchema,
}).superRefine((report, ctx) => {
  const check = (valid: boolean, message: string) => {
    if (!valid) ctx.addIssue({ code: "custom", message });
  };
  const snapshots = new Map(report.snapshots.map((snapshot) => [snapshot.snapshotId, snapshot]));
  const evidence = new Map(report.evidence.map((item) => [item.evidenceId, item]));
  const gapIds = new Set(report.gaps.map((gap) => gap.gapId));
  check(snapshots.size === report.snapshots.length, "Duplicate snapshots");
  check(evidence.size === report.evidence.length, "Duplicate evidence");
  check(gapIds.size === report.gaps.length, "Duplicate gaps");
  check(new Set(report.improvements.map((item) => item.improvementId)).size === report.improvements.length, "Duplicate improvements");
  check(new Set(report.roles.map((role) => role.template.roleId)).size === 5, "All five distinct roles are required");
  check(report.roles.every((role) => report.versions.roleRubrics.some((version) =>
    version.roleId === role.template.roleId && version.version === role.template.version)), "Role versions must match dependencies");
  check(report.coverage.length === snapshots.size && new Set(report.coverage.map((item) => item.snapshotId)).size === snapshots.size,
    "Every snapshot requires one coverage manifest");
  for (const manifest of report.coverage) {
    check(snapshots.has(manifest.snapshotId) && manifest.manifestVersion === report.versions.coverageManifest &&
      manifest.detectorBundle.id === report.versions.detectorBundle.id && manifest.detectorBundle.version === report.versions.detectorBundle.version,
    "Coverage must match included snapshots and version dependencies");
  }
  check(report.snapshots.every((snapshot) => snapshot.snapshotIdentityVersion === report.versions.snapshotIdentity &&
    snapshot.securityPolicyHash === report.versions.ingestionPolicyHash), "Snapshot identity and security policy must match dependencies");
  for (const item of report.evidence) {
    const snapshot = snapshots.get(item.snapshotId);
    check(!!snapshot && item.repositoryId === snapshot.repositoryId && item.commitSha === snapshot.commitSha &&
      item.repositoryVisibility === snapshot.repositoryVisibility, "Evidence must match an included snapshot");
  }
  const checkClaim = (claim: z.infer<typeof ClaimSchema>) => {
    if (claim.verification === "verified") check(claim.evidenceIds.every((id) => evidence.has(id)), "Claim cites missing evidence");
  };
  const capabilityIds = report.capabilityGroups.flatMap((group) => group.capabilities.map((capability) => capability.capabilityId));
  check(new Set(capabilityIds).size === capabilityIds.length, "Duplicate capability assessments");
  check(new Set(report.capabilityGroups.map((group) => group.groupId)).size === report.capabilityGroups.length, "Duplicate capability groups");
  for (const group of report.capabilityGroups) for (const capability of group.capabilities) {
    if (capability.state === "assessed") {
      check(capability.evidenceIds.every((id) => evidence.has(id)), "Capability cites missing evidence");
      checkClaim(capability.reasoning);
    } else if (capability.state === "not_observed") {
      check(capability.coverageSnapshotIds.every((id) => snapshots.has(id)), "Not-observed result requires included coverage");
    }
  }
  report.claims.forEach(checkClaim);
  report.gaps.forEach((gap) => checkClaim(gap.explanation));
  for (const improvement of report.improvements) {
    checkClaim(improvement.rationale);
    check(improvement.gapIds.every((id) => gapIds.has(id)), "Improvement cites missing gap");
    check(improvement.permittedLocations.every((location) => snapshots.has(location.snapshotId)), "Improvement location requires an included snapshot");
    check((improvement.repositoryIds ?? []).every(id => report.snapshots.some(s => s.repositoryId === id)), "Improvement repository must be included");
  }
});
export type Claim = z.infer<typeof ClaimSchema>;
export type CapabilityDefinition = z.infer<typeof CapabilityDefinitionSchema>;
export type CapabilityAssessment = z.infer<typeof CapabilityAssessmentSchema>;
export type RubricRequirement = z.infer<typeof RubricRequirementSchema>;
export type RoleRubric = z.infer<typeof RoleRubricSchema>;
export type RoleResult = z.infer<typeof RoleResultSchema>;
export type Gap = z.infer<typeof GapSchema>;
export type Improvement = z.infer<typeof ImprovementSchema>;
export type ReadinessReportResponse = z.infer<typeof ReadinessReportResponseSchema>;
