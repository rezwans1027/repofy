import { z } from "zod";
import { AnalysisRunIdSchema, AnalysisJobIdSchema, UserIdSchema, VersionDependenciesSchema, SnapshotIdSchema,
  RepositoryIdSchema, GitHubCommitShaSchema, RepositoryVisibilitySchema, AnalyzerCoverageSchema, LocatorIdSchema,
  Sha256Schema, CountSchema, FileCoverageOutcomeSchema, RubricCatalogSchema, ProvenanceAssessmentSchema } from "@repofy/contracts";
import { createHash } from "node:crypto";

export const AggregationInputSchema = z.strictObject({
  runId: AnalysisRunIdSchema, jobId: AnalysisJobIdSchema, ownerUserId: UserIdSchema, versions: VersionDependenciesSchema,
  catalog: RubricCatalogSchema,
  provenance: ProvenanceAssessmentSchema.optional(),
  snapshots: z.array(z.strictObject({ snapshotId: SnapshotIdSchema, repositoryId: RepositoryIdSchema,
    commitSha: GitHubCommitShaSchema, repositoryVisibility: RepositoryVisibilitySchema, coverage: AnalyzerCoverageSchema,
    files: z.array(z.strictObject({ fileId: LocatorIdSchema, lines: CountSchema, analyzed: z.boolean(), classification: z.string().max(20),
      outcome: FileCoverageOutcomeSchema.optional() })).max(10000),
  })).min(1).max(10),
  // Parse each observation separately so rejected findings produce only closed validation codes.
  evidence: z.array(z.unknown()).max(20000),
});
export const AggregationEvidenceInputSchema = z.strictObject({ observation: z.unknown(),
  fileId: LocatorIdSchema.nullable(), contentFingerprint: Sha256Schema.nullable() });
export type AggregationInput = z.infer<typeof AggregationInputSchema>;
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const digest = (value: unknown) => `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
export const clusterKey = (keys: unknown) => `cluster.${digest(keys).slice(7)}`;
