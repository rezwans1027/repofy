import { z } from "zod";
import { StructuralObservationSchema, structuralSourceMatches } from "./structural";
import { ImplementationObservationSchema, implementationSourceMatches } from "./implementation";
import {
  ContractVersionSchema, EvidenceIdSchema, ExplanationSchema, GitHubCommitShaSchema, KeySchema,
  LimitationsSchema, LineRangeSchema, RepositoryIdSchema, RepositoryVisibilitySchema, ScoreSchema,
  ShortTextSchema, SnapshotIdSchema, SourceTypeSchema, TimestampSchema, UnknownReasonsSchema,
  VersionReferenceSchema, uniqueArray,
} from "./primitives";

export const ContributionSignalSchema = z.enum(["fork", "template", "generated", "bulk_commit", "limited_history", "multiple_contributors", "history_consistent"]);
export const ContributionUncertaintySchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("assessed"), confidence: ScoreSchema, signals: uniqueArray(ContributionSignalSchema, 7), limitations: LimitationsSchema }),
  z.strictObject({ state: z.literal("unknown"), reasons: UnknownReasonsSchema, signals: uniqueArray(ContributionSignalSchema, 7), limitations: LimitationsSchema }),
]);

export const evidenceFields = {
  contractVersion: ContractVersionSchema,
  evidenceId: EvidenceIdSchema,
  snapshotId: SnapshotIdSchema,
  repositoryId: RepositoryIdSchema,
  commitSha: GitHubCommitShaSchema,
  sourceType: SourceTypeSchema,
  repositoryVisibility: RepositoryVisibilitySchema,
  visibility: z.literal("owner_only"),
  detector: VersionReferenceSchema,
  capabilityIds: uniqueArray(KeySchema, 30),
  observations: z.array(ExplanationSchema).min(1).max(20),
  // These independent measurements do not establish candidate skill or authorship.
  relevance: ScoreSchema,
  confidence: ScoreSchema,
  strength: ScoreSchema,
  contribution: ContributionUncertaintySchema,
  createdAt: TimestampSchema,
  structural: StructuralObservationSchema.optional(),
  implementation: ImplementationObservationSchema.optional(),
};

export const OwnerEvidenceLocationSchema = z.strictObject({ label: ShortTextSchema, lines: LineRangeSchema.optional() });
export const OwnerEvidenceSchema = z.strictObject({
  ...evidenceFields,
  location: OwnerEvidenceLocationSchema.optional(),
}).refine(structuralSourceMatches, "Structural observation must match its evidence source")
  .refine(implementationSourceMatches, "Implementation observation must match its evidence source");

// Reserved for a future audited disclosure transformation; never spread an internal object here.
export const GeneralizedEvidenceSchema = z.strictObject({
  contractVersion: ContractVersionSchema,
  projection: z.literal("generalized"),
  sourceType: SourceTypeSchema,
  capabilityIds: uniqueArray(KeySchema, 30, 1),
  summary: ExplanationSchema,
  confidence: ScoreSchema,
  strength: ScoreSchema,
});
export type ContributionUncertainty = z.infer<typeof ContributionUncertaintySchema>;
export type OwnerEvidence = z.infer<typeof OwnerEvidenceSchema>;
export type GeneralizedEvidence = z.infer<typeof GeneralizedEvidenceSchema>;
