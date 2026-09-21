import { z } from "zod";
import { CountSchema, GitHubCommitShaSchema, LimitationsSchema, LocatorIdSchema, TimestampSchema, uniqueArray } from "./primitives";

// Closed vocabularies: repository prose, package names, commands, URLs, identities and excerpts
// are never copied into these observations. Private locations remain encrypted separately.
export const TechnologySchema = z.enum(["react", "next", "express", "vue", "angular", "svelte", "nestjs", "react_native", "expo",
  "typescript", "jest", "vitest", "mocha", "playwright", "cypress", "pytest", "django", "fastapi", "flask", "junit", "spring", "prisma"]);
export const StructuralKindSchema = z.enum(["structure", "dependency", "configuration", "test_candidates", "workflow", "container",
  "deployment", "schema", "documentation", "commit", "pull_request", "check", "status", "action"]);
export const StructuralObservationSchema = z.strictObject({
  kind: StructuralKindSchema,
  confidenceBasis: z.enum(["parsed_declaration", "static_syntax", "filename_only", "provider_record"]),
  calibration: z.literal("uncalibrated"),
  claimBoundary: z.enum(["dependency_presence", "configuration_presence", "test_candidates_only", "documentation_only",
    "source_structure_only", "schema_structure_only", "exact_commit_result", "historical_context"]),
  limitations: LimitationsSchema,
  counts: z.partialRecord(z.enum(["production", "development", "optional", "peer", "transitive", "workspace", "unknown", "aliased",
    "packages", "workspacePatterns", "scripts", "suites", "tests", "assertions", "skipped", "imports", "exports", "jobs", "steps",
    "testCommands", "conditionalJobs", "stages", "instructions", "tables", "indexes", "alterations", "models", "headings", "links",
    "codeBlocks", "architectureHeadings", "parents", "additions", "deletions", "changedFiles", "commits",
    "modules", "functions", "classes", "methods", "interfaces", "annotations"]), CountSchema),
  technologies: uniqueArray(TechnologySchema, 30),
  associatedFileIds: uniqueArray(LocatorIdSchema, 100).optional(),
  provider: z.strictObject({
    retrievedAt: TimestampSchema,
    relationship: z.enum(["exact_commit", "ancestor", "repository_context"]),
    subjectSha: GitHubCommitShaSchema.optional(),
    occurredAt: TimestampSchema.optional(),
    result: z.enum(["success", "failure", "neutral", "cancelled", "skipped", "timed_out", "action_required", "stale", "startup_failure",
      "pending", "in_progress", "queued", "completed", "open", "closed", "merged", "unknown"]),
    authorMatch: z.enum(["connected_identity", "other_identity", "unavailable"]),
    authorType: z.enum(["User", "Bot", "unknown"]),
  }).optional(),
}).refine(v => ["commit", "pull_request", "check", "status", "action"].includes(v.kind) === !!v.provider,
  "Provider observations require provenance").refine(v => v.claimBoundary !== "exact_commit_result" || v.provider?.relationship === "exact_commit",
  "Only an exact commit result can support the analyzed commit").refine(v => {
    const boundaries: Record<string, readonly string[]> = { structure: ["source_structure_only"], dependency: ["dependency_presence"], configuration: ["configuration_presence"],
      test_candidates: ["test_candidates_only"], workflow: ["configuration_presence"], container: ["configuration_presence"], deployment: ["configuration_presence"],
      schema: ["schema_structure_only"], documentation: ["documentation_only"], commit: ["historical_context"], pull_request: ["historical_context"],
      check: ["exact_commit_result", "historical_context"], status: ["exact_commit_result", "historical_context"], action: ["exact_commit_result", "historical_context"] };
    return boundaries[v.kind].includes(v.claimBoundary) && (v.confidenceBasis === "provider_record") === !!v.provider;
  }, "Observation kind, basis and claim boundary must agree");

export function structuralSourceMatches(value: { sourceType: string; structural?: { kind: string } }) {
  if (!value.structural) return true;
  const sources: Record<string, string> = { structure: "code", dependency: "dependency", configuration: "config", test_candidates: "test", workflow: "ci",
    container: "config", deployment: "config", schema: "code", documentation: "docs", commit: "commit", pull_request: "pull_request", check: "ci", status: "ci", action: "ci" };
  return sources[value.structural.kind] === value.sourceType;
}

export const SOURCE_FAMILIES = ["manifests", "configuration", "tests", "ci", "schemas", "documentation", "source"] as const;
export const SourceProcessingSchema = z.strictObject({
  source: z.enum(SOURCE_FAMILIES), eligibleFiles: CountSchema, analyzedFiles: CountSchema,
  parseFailures: CountSchema, unsupportedFiles: CountSchema, limitedFiles: CountSchema, noSignalFiles: CountSchema,
}).refine(v => v.eligibleFiles === v.analyzedFiles + v.parseFailures + v.unsupportedFiles + v.limitedFiles && v.noSignalFiles <= v.analyzedFiles);
export const MetadataCoverageSchema = z.strictObject({
  source: z.enum(["commits", "pullRequests", "checks", "statuses", "actions"]),
  state: z.enum(["not_requested", "available", "no_signal", "permission_denied", "provider_unavailable", "truncated", "parse_failure", "processing_limit"]),
  records: CountSchema.max(100), exactCommitRecords: CountSchema.max(100),
  retrievedAt: TimestampSchema.optional(),
}).refine(v => v.exactCommitRecords <= v.records &&
  (!["not_requested", "no_signal", "permission_denied", "provider_unavailable", "parse_failure", "processing_limit"].includes(v.state) || v.records === 0)
  && (v.state !== "available" || v.records > 0) && (v.records === 0 || !!v.retrievedAt));
export const StructuralCoverageSchema = z.strictObject({
  sources: z.array(SourceProcessingSchema).length(7).refine(v => new Set(v.map(s => s.source)).size === 7),
  metadata: z.array(MetadataCoverageSchema).length(5).refine(v => new Set(v.map(s => s.source)).size === 5),
  evidenceTruncated: z.boolean(), disabledExtractors: z.array(z.enum(SOURCE_FAMILIES)).max(7),
});
export const ExclusionCountsSchema = z.strictObject({
  sensitive_path: CountSchema, dependency: CountSchema, generated: CountSchema, binary: CountSchema, oversized: CountSchema,
  unsupported_encoding: CountSchema, user_ignored: CountSchema, policy_file: CountSchema, secret_or_sensitive_data: CountSchema,
});
export const StructuralInventorySchema = z.strictObject({
  // Files excluded before extraction have no retained path or locator; all denominators retain them.
  exclusions: ExclusionCountsSchema, languageDenominator: z.literal("eligible_files_only"),
  textBytes: CountSchema, lines: CountSchema, projectManifests: CountSchema, nestedProjects: CountSchema,
  dependencyManifests: CountSchema, lockfiles: CountSchema,
});
export type StructuralObservation = z.infer<typeof StructuralObservationSchema>;
export type StructuralCoverage = z.infer<typeof StructuralCoverageSchema>;
export type MetadataCoverage = z.infer<typeof MetadataCoverageSchema>;
