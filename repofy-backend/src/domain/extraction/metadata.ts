import { z } from "zod";
import { GitHubCommitShaSchema, MetadataCoverageSchema, RepositoryIdSchema, StructuralObservationSchema,
  type MetadataCoverage, type StructuralObservation } from "@repofy/contracts";

export const METADATA_SOURCES = ["commits", "pullRequests", "checks", "statuses", "actions"] as const;
export type MetadataSource = typeof METADATA_SOURCES[number];
export const MetadataRecordSchema = z.strictObject({
  objectId: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  detail: StructuralObservationSchema,
}).refine(r => !!r.detail.provider);
export const MetadataBatchSchema = z.strictObject({
  repositoryId: RepositoryIdSchema, commitSha: GitHubCommitShaSchema,
  groups: z.array(z.strictObject({ coverage: MetadataCoverageSchema, records: z.array(MetadataRecordSchema).max(100) })
    .refine(g => g.coverage.records === g.records.length && g.coverage.exactCommitRecords === g.records.filter(r => r.detail.provider!.relationship === "exact_commit").length
      && new Set(g.records.map(r => r.objectId)).size === g.records.length)).length(5)
    .refine(groups => new Set(groups.map(g => g.coverage.source)).size === 5),
}).superRefine((batch, ctx) => {
  const kind = { commits: "commit", pullRequests: "pull_request", checks: "check", statuses: "status", actions: "action" };
  for (const group of batch.groups) for (const record of group.records) {
    if (record.detail.kind !== kind[group.coverage.source] || (record.detail.provider!.relationship === "exact_commit" && record.detail.provider!.subjectSha !== batch.commitSha)) {
      ctx.addIssue({ code: "custom", message: "Metadata is not bound to its source and commit" });
    }
  }
});
export type MetadataBatch = z.infer<typeof MetadataBatchSchema>;
export type MetadataOptions = { commits: boolean; pullRequests: boolean; ci: boolean };
export function requested(source: MetadataSource, options: MetadataOptions) { return source === "commits" ? options.commits : source === "pullRequests" ? options.pullRequests : options.ci; }
export function emptyMetadata(repositoryId: string, commitSha: string, options: MetadataOptions): MetadataBatch {
  return MetadataBatchSchema.parse({ repositoryId, commitSha, groups: METADATA_SOURCES.map(source => ({
    coverage: { source, state: requested(source, options) ? "provider_unavailable" : "not_requested", records: 0, exactCommitRecords: 0 }, records: [],
  })) });
}
export function providerDetail(kind: StructuralObservation["kind"], provider: NonNullable<StructuralObservation["provider"]>, counts = {}): StructuralObservation {
  return StructuralObservationSchema.parse({ kind, confidenceBasis: "provider_record", calibration: "uncalibrated",
    claimBoundary: ["check", "status", "action"].includes(kind) && provider.relationship === "exact_commit" ? "exact_commit_result" : "historical_context",
    counts, technologies: [], provider, limitations: ["Provider metadata does not establish individual authorship, complete history, test coverage or deployment correctness.",
      ...(provider.relationship !== "exact_commit" ? ["This record is historical context and is not a result for the analyzed commit."] : []),
      "Names, descriptions, messages, URLs and source excerpts are omitted."] });
}
export type MetadataState = MetadataCoverage["state"];
