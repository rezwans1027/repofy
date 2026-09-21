import { SnapshotProvenanceSchema, type SnapshotProvenance } from "@repofy/contracts";
import { z } from "zod";
export const ProvenanceContextSchema = z.strictObject({ snapshotId: z.uuid(), repositoryId: z.uuid(), commitSha: z.string().regex(/^[a-f0-9]{40}$/), providerRepositoryId: z.string(),
  visibility: z.enum(["private", "public"]), accountId: z.uuid(), installationId: z.uuid(), totalFiles: z.number().int().nonnegative(), generatedMarked: z.number().int().nonnegative(),
  exclusions: z.record(z.string(), z.number().int().nonnegative()).nullable(),
  history: z.object({ state: SnapshotProvenanceSchema.shape.history.shape.state, records: z.number().int().min(0).max(100) }).nullable(),
  commits: z.array(z.strictObject({ match: z.enum(["connected_identity", "other_identity", "unavailable"]).nullable(), relationship: z.enum(["exact_commit", "ancestor", "repository_context"]), parents: z.number().int().min(0).max(100).nullable() })).max(100),
});
export type ProvenanceContext = z.infer<typeof ProvenanceContextSchema>;
export function observeProvenance(raw: ProvenanceContext, provider: SnapshotProvenance["provider"], observedAt: string): SnapshotProvenance {
  const input = ProvenanceContextSchema.parse(raw), commits = input.commits;
  const history = { state: input.history?.state ?? "not_requested", records: commits.length,
    linkedToConnected: commits.filter(c => c.match === "connected_identity").length, linkedToOthers: commits.filter(c => c.match === "other_identity").length,
    unlinked: commits.filter(c => !c.match || c.match === "unavailable").length,
    headIsOnlyRoot: input.history?.state === "available" && input.history.records === 1 && commits.length === 1 && commits[0].parents === 0 && commits[0].relationship === "exact_commit",
    relationship: "pinned_head_and_bounded_ancestors" as const };
  if (input.history && input.history.records !== commits.length) history.state = "truncated";
  const files = { total: input.totalFiles, generatedExcluded: input.exclusions?.generated ?? 0, generatedMarked: input.generatedMarked, vendorExcluded: input.exclusions?.dependency ?? 0 };
  const signals: SnapshotProvenance["signals"] = [];
  if (provider.fork === true) signals.push("provider_fork");
  if (provider.templateOrigin === "declared") signals.push("provider_template_origin");
  if (files.generatedExcluded || files.generatedMarked) signals.push("generated_files"); if (files.vendorExcluded) signals.push("vendor_files");
  if (history.headIsOnlyRoot && files.total >= 100) signals.push("possible_bulk_initial_commit");
  if (history.state === "truncated" || history.records <= 1) signals.push("limited_history");
  if (history.linkedToConnected && history.linkedToOthers) signals.push("multiple_linked_identities");
  if (history.linkedToConnected) signals.push("connected_identity_association"); if (history.linkedToOthers) signals.push("other_identity_association");
  if (history.unlinked) signals.push("unlinked_commit_author");
  if (!["available", "truncated"].includes(history.state)) signals.push("history_unavailable");
  return SnapshotProvenanceSchema.parse({ snapshotId: input.snapshotId, repositoryId: input.repositoryId, commitSha: input.commitSha,
    detector: { id: "provenance_context", version: "1.0.0" }, observedAt, provider, history, files, signals,
    limitations: ["not_authorship", "not_legal_ownership", "not_ai_detection", "not_skill", "no_numeric_modifier", "history_bounded", "squash_or_import_possible", "provider_context_current", "file_classification_heuristic", "identity_association_only"],
    contribution: { state: "unknown", confidence: null, strengthModifier: null, confidenceModifier: null, basis: "context_only_uncalibrated" } });
}
