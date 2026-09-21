import { z } from "zod";
import { SnapshotIdSchema, RepositoryIdSchema, GitHubCommitShaSchema, TimestampSchema, uniqueArray } from "./primitives";
export const PROVENANCE_SIGNALS = ["provider_fork", "provider_template_origin", "generated_files", "vendor_files", "possible_bulk_initial_commit", "limited_history", "multiple_linked_identities", "connected_identity_association", "other_identity_association", "unlinked_commit_author", "history_unavailable"] as const;
export const PROVENANCE_LIMITS = ["not_authorship", "not_legal_ownership", "not_ai_detection", "not_skill", "no_numeric_modifier", "history_bounded", "squash_or_import_possible", "provider_context_current", "file_classification_heuristic", "identity_association_only"] as const;
export const SnapshotProvenanceSchema = z.strictObject({ snapshotId: SnapshotIdSchema, repositoryId: RepositoryIdSchema, commitSha: GitHubCommitShaSchema,
  detector: z.strictObject({ id: z.literal("provenance_context"), version: z.literal("1.0.0") }), observedAt: TimestampSchema,
  provider: z.strictObject({ state: z.enum(["available", "unavailable"]), fork: z.boolean().nullable(), templateOrigin: z.enum(["declared", "unknown"]), relationship: z.literal("current_repository_context") }),
  history: z.strictObject({ state: z.enum(["available", "no_signal", "truncated", "not_requested", "permission_denied", "provider_unavailable", "processing_limit", "parse_failure"]),
    records: z.number().int().min(0).max(100), linkedToConnected: z.number().int().min(0).max(100), linkedToOthers: z.number().int().min(0).max(100), unlinked: z.number().int().min(0).max(100),
    headIsOnlyRoot: z.boolean(), relationship: z.literal("pinned_head_and_bounded_ancestors") }),
  files: z.strictObject({ total: z.number().int().nonnegative(), generatedExcluded: z.number().int().nonnegative(), generatedMarked: z.number().int().nonnegative(), vendorExcluded: z.number().int().nonnegative() }),
  signals: uniqueArray(z.enum(PROVENANCE_SIGNALS), PROVENANCE_SIGNALS.length), limitations: uniqueArray(z.enum(PROVENANCE_LIMITS), PROVENANCE_LIMITS.length),
  contribution: z.strictObject({ state: z.literal("unknown"), confidence: z.null(), strengthModifier: z.null(), confidenceModifier: z.null(), basis: z.literal("context_only_uncalibrated") }),
}).refine(v => v.history.linkedToConnected + v.history.linkedToOthers + v.history.unlinked === v.history.records && v.files.generatedExcluded + v.files.generatedMarked + v.files.vendorExcluded <= v.files.total
  && (v.provider.state !== "unavailable" || v.provider.fork === null && v.provider.templateOrigin === "unknown"));
export const ProvenanceAssessmentSchema = z.strictObject({ policy: z.strictObject({ id: z.literal("provenance_context"), version: z.literal("1.0.0") }),
  snapshots: z.array(SnapshotProvenanceSchema).min(1).max(10) }).refine(v => new Set(v.snapshots.map(s => s.snapshotId)).size === v.snapshots.length);
export type SnapshotProvenance = z.infer<typeof SnapshotProvenanceSchema>;
export type ProvenanceAssessment = z.infer<typeof ProvenanceAssessmentSchema>;
